/**
 * Credenciales propias: las que cada persona gestiona sobre sí misma.
 *
 * Separadas de `rutas/usuarios.ts` a propósito: ahí dirección da de alta y
 * edita a otras personas, acá cada quien toca lo suyo. Mezclarlas abriría la
 * puerta a que una edición de perfil termine cambiando una contraseña ajena.
 *
 * Por qué existen: sin esto, la contraseña de cada persona la fija un
 * administrador y esa persona no puede cambiarla nunca, así que el
 * administrador conoce para siempre la credencial de todos. Con eso, la línea
 * "Fulana modificó X" de la bitácora deja de ser prueba de que lo hizo Fulana,
 * y el registro de auditoría —que es el producto de EFFORT— pierde su valor.
 * Ver `docs/DISCREPANCIAS.md`, punto 16.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import {
  ErrorDeAplicacion,
  exigirSesion,
  exigirSesionEnConfiguracion,
  type Dependencias,
} from '../servidor.js';
import {
  ErrorDeCredenciales,
  LARGO_MINIMO_CONTRASENA,
  generarSecretoTotp,
  hashearContrasena,
  urlDeConfiguracionTotp,
  verificarCodigoTotp,
  verificarContrasena,
} from '../seguridad/credenciales.js';
import {
  claveDeIntento,
  registrarExito,
  registrarFallo,
  verificarIntento,
} from '../seguridad/limites.js';
import { nombreCookieSesion, opcionesDeCookie } from '../seguridad/sesiones.js';
import { truncarIp } from '../seguridad/privacidad.js';
import { esProduccion } from '../configuracion.js';

const codigoSchema = z.object({ codigo: z.string().min(6).max(10) }).strict();

const cambioDeContrasenaSchema = z
  .object({
    contrasenaActual: z.string().min(1).max(200),
    contrasenaNueva: z.string().min(LARGO_MINIMO_CONTRASENA).max(200),
  })
  .strict();

export async function registrarRutasDeMiCuenta(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  const produccion = esProduccion(deps.configuracion);
  const nombreCookie = nombreCookieSesion(produccion);

  /* --- Alta del segundo factor -------------------------------------------- */

  /**
   * Entrega el secreto una única vez.
   *
   * Acepta una sesión con el segundo factor pendiente: es el único caso que
   * puede atender: quien todavía no lo configuró no tiene otra forma de llegar
   * acá. Esa sesión no habilita ninguna otra ruta (ver `servidor.ts`).
   */
  app.post('/api/v1/mi/segundo-factor', async (peticion, respuesta) => {
    const { usuarioId } = exigirSesionEnConfiguracion(peticion);

    const usuario = await deps.usuarios.buscarPorId(usuarioId);
    if (!usuario) {
      throw new ErrorDeAplicacion(401, 'Necesitás iniciar sesión.', 'sin_sesion');
    }

    // Un secreto ya configurado no se vuelve a entregar ni se regenera desde
    // acá. Si alguien perdió su dispositivo, es un procedimiento con dirección
    // de por medio, no un botón: regenerarlo con la sesión de la víctima es
    // exactamente el ataque que el segundo factor debería frenar.
    if (usuario.secretoTotp) {
      throw new ErrorDeAplicacion(
        409,
        'Ya tenés un segundo factor configurado.',
        'segundo_factor_ya_configurado',
      );
    }

    const secreto = generarSecretoTotp();
    await deps.usuarios.guardarSecretoTotp(usuario.id, secreto);

    // El secreto NO va a la bitácora: quedaría guardado en claro y convertiría
    // el registro de auditoría en el lugar más peligroso de la base.
    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: usuario.id,
      accion: ACCIONES.SEGUNDO_FACTOR_INICIADO,
      entidad: 'usuario',
      entidadId: usuario.id,
      clienteId: null,
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(200).send({
      secreto,
      url: urlDeConfiguracionTotp(usuario.email, secreto),
    });
  });

  /**
   * Confirma el alta con un código real del dispositivo.
   *
   * Recién acá `segundoFactorActivo` pasa a `true`: guardar el secreto no
   * alcanza como prueba de que la persona llegó a cargarlo en su aplicación.
   * Si se activara al entregarlo, alguien que cierra la pantalla a mitad de
   * camino quedaría bloqueado con un secreto que nadie tiene.
   */
  app.post('/api/v1/mi/segundo-factor/confirmar', async (peticion, respuesta) => {
    const { codigo } = codigoSchema.parse(peticion.body);
    const { usuarioId, sesionId } = exigirSesionEnConfiguracion(peticion);

    const usuario = await deps.usuarios.buscarPorId(usuarioId);
    if (!usuario?.secretoTotp) {
      throw new ErrorDeAplicacion(
        409,
        'Primero tenés que empezar el alta del segundo factor.',
        'segundo_factor_no_iniciado',
      );
    }

    const momento = deps.ahora();
    const ip = truncarIp(peticion.ip) ?? 'desconocida';
    const clave = claveDeIntento(ip, `alta2fa:${usuario.email}`);

    const limite = verificarIntento(deps.intentosDeAcceso, clave, momento);
    if (!limite.permitido) {
      return respuesta.code(429).send({
        error: 'demasiados_intentos',
        mensaje: `Demasiados intentos. Probá de nuevo en ${limite.segundosParaReintentar} segundos.`,
      });
    }

    if (!verificarCodigoTotp(codigo, usuario.secretoTotp)) {
      registrarFallo(deps.intentosDeAcceso, clave, momento);

      await registrarEvento(deps.bitacora, peticion.log, {
        usuarioId: usuario.id,
        accion: ACCIONES.SEGUNDO_FACTOR_FALLIDO,
        entidad: 'usuario',
        entidadId: usuario.id,
        clienteId: null,
        ip: peticion.ip,
        agenteUsuario: peticion.headers['user-agent'] ?? null,
        peticionId: String(peticion.id),
      });

      return respuesta.code(401).send({ error: 'codigo_invalido', mensaje: 'Código incorrecto.' });
    }

    registrarExito(deps.intentosDeAcceso, clave);
    await deps.usuarios.activarSegundoFactor(usuario.id);

    // La sesión con la que vino queda habilitada: ya probó contraseña y
    // segundo factor, que es exactamente lo que se le pide a cualquiera.
    await deps.sesiones.marcarSegundoFactorSuperado(sesionId);
    await deps.usuarios.registrarAcceso(usuario.id, momento);

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: usuario.id,
      accion: ACCIONES.SEGUNDO_FACTOR_ACTIVADO,
      entidad: 'usuario',
      entidadId: usuario.id,
      clienteId: null,
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(200).send({ segundoFactorActivo: true });
  });

  /* --- Cambio de contraseña propia ---------------------------------------- */

  /**
   * Cambia la contraseña propia y cierra TODAS las sesiones, incluida la actual.
   *
   * Cerrar solo las demás dejaría viva la sesión desde la que se hizo el
   * cambio, que es cómoda pero no es la que importa: si alguien más conocía la
   * contraseña vieja y tenía una sesión abierta, cambiarla tiene que echarlo.
   * El precio es volver a entrar una vez.
   */
  app.post('/api/v1/mi/contrasena', async (peticion, respuesta) => {
    const { contrasenaActual, contrasenaNueva } = cambioDeContrasenaSchema.parse(peticion.body);
    const sujeto = exigirSesion(peticion);

    const usuario = await deps.usuarios.buscarPorId(sujeto.usuarioId);
    if (!usuario) {
      throw new ErrorDeAplicacion(401, 'Necesitás iniciar sesión.', 'sin_sesion');
    }

    const momento = deps.ahora();
    const ip = truncarIp(peticion.ip) ?? 'desconocida';
    const clave = claveDeIntento(ip, `contrasena:${usuario.email}`);

    // La contraseña actual es un secreto más que se puede adivinar por fuerza
    // bruta, así que se limita igual que el acceso.
    const limite = verificarIntento(deps.intentosDeAcceso, clave, momento);
    if (!limite.permitido) {
      return respuesta.code(429).send({
        error: 'demasiados_intentos',
        mensaje: `Demasiados intentos. Probá de nuevo en ${limite.segundosParaReintentar} segundos.`,
      });
    }

    if (!(await verificarContrasena(contrasenaActual, usuario.hashContrasena))) {
      registrarFallo(deps.intentosDeAcceso, clave, momento);
      return respuesta
        .code(401)
        .send({ error: 'credenciales_invalidas', mensaje: 'La contraseña actual no es correcta.' });
    }

    registrarExito(deps.intentosDeAcceso, clave);

    if (await verificarContrasena(contrasenaNueva, usuario.hashContrasena)) {
      throw new ErrorDeAplicacion(
        400,
        'La contraseña nueva tiene que ser distinta de la actual.',
        'contrasena_sin_cambio',
      );
    }

    let hash: string;
    try {
      hash = await hashearContrasena(contrasenaNueva);
    } catch (error) {
      if (error instanceof ErrorDeCredenciales) {
        throw new ErrorDeAplicacion(400, error.message, 'contrasena_debil');
      }
      throw error;
    }

    await deps.usuarios.cambiarContrasena(usuario.id, hash, momento);

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: usuario.id,
      accion: ACCIONES.CONTRASENA_CAMBIADA,
      entidad: 'usuario',
      entidadId: usuario.id,
      clienteId: null,
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    await deps.sesiones.revocarTodasDelUsuario(usuario.id, momento, 'contrasena_cambiada');
    respuesta.clearCookie(nombreCookie, opcionesDeCookie(produccion));

    return respuesta.code(200).send({ contrasenaCambiada: true, sesionCerrada: true });
  });
}
