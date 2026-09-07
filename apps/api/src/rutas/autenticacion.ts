/**
 * Acceso al sistema.
 *
 * El ingreso tiene dos pasos separados a propósito: contraseña primero, segundo
 * factor después, con una sesión que existe pero todavía no habilita nada entre
 * medio. Resolverlo en un solo paso obligaría a mantener el estado intermedio
 * en algún lado peor (un token temporal, la contraseña en memoria del cliente).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { emailSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import { ErrorDeAplicacion, exigirSesion, type Dependencias } from '../servidor.js';
import { verificarCodigoTotp, verificarContrasena } from '../seguridad/credenciales.js';
import {
  claveDeIntento,
  registrarExito,
  registrarFallo,
  verificarIntento,
} from '../seguridad/limites.js';
import { requiereSegundoFactor } from '../seguridad/rbac.js';
import {
  generarTokenDeSesion,
  hashDelToken,
  nombreCookieSesion,
  opcionesDeCookie,
} from '../seguridad/sesiones.js';
import { truncarIp } from '../seguridad/privacidad.js';
import { esProduccion } from '../configuracion.js';

const accesoSchema = z
  .object({
    email: emailSchema,
    contrasena: z.string().min(1).max(200),
  })
  .strict();

const segundoFactorSchema = z
  .object({
    codigo: z.string().min(6).max(10),
  })
  .strict();

/**
 * Mensaje único para cualquier fallo de credenciales.
 *
 * No distingue "ese correo no existe" de "la contraseña es incorrecta": esa
 * diferencia permite averiguar qué correos están registrados, que es el primer
 * paso de un ataque dirigido.
 */
const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';

export async function registrarRutasDeAutenticacion(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  const produccion = esProduccion(deps.configuracion);
  const nombreCookie = nombreCookieSesion(produccion);

  app.post('/api/v1/acceso', async (peticion, respuesta) => {
    const { email, contrasena } = accesoSchema.parse(peticion.body);
    const momento = deps.ahora();
    const ip = truncarIp(peticion.ip) ?? 'desconocida';
    const clave = claveDeIntento(ip, email);

    const limite = verificarIntento(deps.intentosDeAcceso, clave, momento);
    if (!limite.permitido) {
      await registrarEvento(deps.bitacora, peticion.log, {
        usuarioId: null,
        accion: ACCIONES.ACCESO_BLOQUEADO,
        entidad: 'sesion',
        entidadId: null,
        clienteId: null,
        datosDespues: { email, segundosParaReintentar: limite.segundosParaReintentar },
        ip: peticion.ip,
        agenteUsuario: peticion.headers['user-agent'] ?? null,
        peticionId: String(peticion.id),
      });

      return respuesta.code(429).send({
        error: 'demasiados_intentos',
        mensaje: `Demasiados intentos fallidos. Probá de nuevo en ${limite.segundosParaReintentar} segundos.`,
      });
    }

    const usuario = await deps.usuarios.buscarPorEmail(email);

    // La contraseña se verifica incluso cuando el usuario no existe, contra un
    // hash de descarte. Sin esto, la respuesta para un correo inexistente
    // vuelve mucho más rápido y eso ya delata qué correos están registrados.
    const hashParaComparar = usuario?.hashContrasena ?? HASH_DE_DESCARTE;
    const contrasenaCorrecta = await verificarContrasena(contrasena, hashParaComparar);

    if (!usuario || !usuario.activo || !contrasenaCorrecta) {
      registrarFallo(deps.intentosDeAcceso, clave, momento);

      await registrarEvento(deps.bitacora, peticion.log, {
        usuarioId: usuario?.id ?? null,
        accion: ACCIONES.ACCESO_FALLIDO,
        entidad: 'sesion',
        entidadId: null,
        clienteId: null,
        datosDespues: { email },
        ip: peticion.ip,
        agenteUsuario: peticion.headers['user-agent'] ?? null,
        peticionId: String(peticion.id),
      });

      return respuesta.code(401).send({ error: 'credenciales_invalidas', mensaje: CREDENCIALES_INVALIDAS });
    }

    registrarExito(deps.intentosDeAcceso, clave);

    const necesitaSegundoFactor =
      requiereSegundoFactor(usuario.rol) || usuario.segundoFactorActivo;

    // Dirección y responsable no pueden entrar sin segundo factor configurado:
    // son los roles que ven toda la cartera.
    if (requiereSegundoFactor(usuario.rol) && !usuario.secretoTotp) {
      return respuesta.code(403).send({
        error: 'segundo_factor_no_configurado',
        mensaje: 'Tu rol requiere segundo factor. Configuralo antes de acceder.',
      });
    }

    const token = generarTokenDeSesion();
    const sesion = await deps.sesiones.crear({
      hashDelToken: hashDelToken(token),
      usuarioId: usuario.id,
      segundoFactorSuperado: !necesitaSegundoFactor,
      ipTruncada: truncarIp(peticion.ip),
      agenteUsuario: peticion.headers['user-agent']?.slice(0, 300) ?? null,
    });

    respuesta.setCookie(nombreCookie, token, opcionesDeCookie(produccion));

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: usuario.id,
      accion: ACCIONES.ACCESO_EXITOSO,
      entidad: 'sesion',
      entidadId: sesion.id,
      clienteId: null,
      datosDespues: { segundoFactorPendiente: necesitaSegundoFactor },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    if (!necesitaSegundoFactor) {
      await deps.usuarios.registrarAcceso(usuario.id, momento);
    }

    return respuesta.code(200).send({
      segundoFactorRequerido: necesitaSegundoFactor,
      debeCambiarContrasena: usuario.debeCambiarContrasena,
    });
  });

  app.post('/api/v1/acceso/segundo-factor', async (peticion, respuesta) => {
    const { codigo } = segundoFactorSchema.parse(peticion.body);
    const token = peticion.cookies[nombreCookie];

    if (!token) {
      throw new ErrorDeAplicacion(401, 'No hay un acceso en curso.', 'sin_sesion');
    }

    const sesion = await deps.sesiones.buscarPorHash(hashDelToken(token));
    if (!sesion || sesion.revocadaEn) {
      throw new ErrorDeAplicacion(401, 'No hay un acceso en curso.', 'sin_sesion');
    }

    const usuario = await deps.usuarios.buscarPorId(sesion.usuarioId);
    if (!usuario?.secretoTotp) {
      throw new ErrorDeAplicacion(401, 'No hay un acceso en curso.', 'sin_sesion');
    }

    const momento = deps.ahora();
    const ip = truncarIp(peticion.ip) ?? 'desconocida';
    const clave = claveDeIntento(ip, `2fa:${usuario.email}`);

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
        entidad: 'sesion',
        entidadId: sesion.id,
        clienteId: null,
        ip: peticion.ip,
        agenteUsuario: peticion.headers['user-agent'] ?? null,
        peticionId: String(peticion.id),
      });

      return respuesta.code(401).send({ error: 'codigo_invalido', mensaje: 'Código incorrecto.' });
    }

    registrarExito(deps.intentosDeAcceso, clave);
    await deps.sesiones.marcarSegundoFactorSuperado(sesion.id);
    await deps.usuarios.registrarAcceso(usuario.id, momento);

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: usuario.id,
      accion: ACCIONES.SEGUNDO_FACTOR_SUPERADO,
      entidad: 'sesion',
      entidadId: sesion.id,
      clienteId: null,
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(200).send({ acceso: 'concedido' });
  });

  app.post('/api/v1/salida', async (peticion, respuesta) => {
    const sujeto = peticion.sujeto;

    if (peticion.sesionId) {
      await deps.sesiones.revocar(peticion.sesionId, deps.ahora(), 'salida_voluntaria');

      await registrarEvento(deps.bitacora, peticion.log, {
        usuarioId: sujeto?.usuarioId ?? null,
        accion: ACCIONES.SESION_CERRADA,
        entidad: 'sesion',
        entidadId: peticion.sesionId,
        clienteId: null,
        ip: peticion.ip,
        agenteUsuario: peticion.headers['user-agent'] ?? null,
        peticionId: String(peticion.id),
      });
    }

    // La cookie se borra siempre, haya o no sesión: si el navegador quedó con
    // una cookie inválida, cerrar sesión tiene que limpiarla igual.
    respuesta.clearCookie(nombreCookie, { path: '/' });
    return respuesta.code(200).send({ salida: 'ok' });
  });

  app.get('/api/v1/yo', async (peticion) => {
    const sujeto = exigirSesion(peticion);
    return {
      usuarioId: sujeto.usuarioId,
      rol: sujeto.rol,
      veTodosLosClientes: sujeto.veTodosLosClientes,
      cantidadDeClientesAsignados: sujeto.clientesAsignados.length,
    };
  });
}

/**
 * Hash de descarte para igualar el tiempo de respuesta cuando el correo no
 * existe. Es el hash de una cadena aleatoria que nadie conoce; verificar
 * contra él siempre falla, pero tarda lo mismo que verificar contra uno real.
 */
const HASH_DE_DESCARTE =
  '$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$JjM8VXWDDNqPFF8u9pW1FYVPFtBcJmVvIrLFRHqKcqM';
