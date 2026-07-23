/**
 * Equipo.
 *
 * Alta y edición de usuarios, exclusivo de dirección — el propio RBAC ya lo
 * impone: `usuario` con `crear`/`editar` solo aparece en el rol `direccion`.
 *
 * La contraseña inicial la define dirección al crear el usuario. Todavía no
 * existe un flujo de "definí tu propia contraseña en el primer acceso" (la
 * tarea 57 del roadmap lo menciona como pendiente); `debeCambiarContrasena`
 * queda en `true` por defecto — el modelo ya lo hace — para cuando ese flujo
 * se construya.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { emailSchema, idSchema, rolSchema, telefonoSchema, textoCorto } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import type { RolEnCliente } from '../puertos.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import {
  ErrorDeCredenciales,
  LARGO_MINIMO_CONTRASENA,
  hashearContrasena,
} from '../seguridad/credenciales.js';
import { autorizar, paramsId } from './comun.js';

const ROLES_CON_CARTERA: readonly RolEnCliente[] = [
  'responsable',
  'coordinador',
  'auxiliar',
  'revisor_balance',
];

/** `direccion` y `solo_lectura` no llevan asignación de cartera: ver `RolEnCliente` en `puertos.ts`. */
function rolEnClienteDe(rol: string): RolEnCliente | null {
  return (ROLES_CON_CARTERA as readonly string[]).includes(rol) ? (rol as RolEnCliente) : null;
}

const altaSchema = z
  .object({
    nombre: textoCorto,
    apellido: textoCorto,
    email: emailSchema,
    telefono: telefonoSchema.nullable().default(null),
    cargo: textoCorto.nullable().default(null),
    rol: rolSchema,
    veTodosLosClientes: z.boolean().default(false),
    contrasenaInicial: z.string().min(LARGO_MINIMO_CONTRASENA).max(200),
    clientesAsignados: z.array(idSchema).default([]),
  })
  .strict()
  .refine(
    (datos) =>
      datos.veTodosLosClientes ||
      datos.clientesAsignados.length === 0 ||
      rolEnClienteDe(datos.rol) !== null,
    { message: 'Este rol no puede tener cartera asignada.', path: ['clientesAsignados'] },
  );

const edicionSchema = z
  .object({
    nombre: textoCorto.optional(),
    apellido: textoCorto.optional(),
    telefono: telefonoSchema.nullable().optional(),
    cargo: textoCorto.nullable().optional(),
    rol: rolSchema.optional(),
    activo: z.boolean().optional(),
    veTodosLosClientes: z.boolean().optional(),
    /** Si se manda, reemplaza la cartera entera. Si se omite, no se toca. */
    clientesAsignados: z.array(idSchema).optional(),
  })
  .strict();

export async function registrarRutasDeUsuarios(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  app.get('/api/v1/usuarios', async (peticion) => {
    autorizar(peticion, 'usuario', 'ver');

    const usuarios = await deps.usuarios.listar();
    return { usuarios };
  });

  app.post('/api/v1/usuarios', async (peticion, respuesta) => {
    const sujeto = autorizar(peticion, 'usuario', 'crear');
    const cuerpo = altaSchema.parse(peticion.body);

    const existente = await deps.usuarios.buscarPorEmail(cuerpo.email);
    if (existente) {
      throw new ErrorDeAplicacion(409, 'Ya existe un usuario con ese correo.', 'correo_en_uso');
    }

    let hashContrasena: string;
    try {
      hashContrasena = await hashearContrasena(cuerpo.contrasenaInicial);
    } catch (error) {
      if (error instanceof ErrorDeCredenciales) {
        throw new ErrorDeAplicacion(400, error.message, 'contrasena_debil');
      }
      throw error;
    }

    const usuario = await deps.usuarios.crear({
      nombre: cuerpo.nombre,
      apellido: cuerpo.apellido,
      email: cuerpo.email,
      telefono: cuerpo.telefono,
      cargo: cuerpo.cargo,
      rol: cuerpo.rol,
      veTodosLosClientes: cuerpo.veTodosLosClientes,
      hashContrasena,
      creadoPorUsuarioId: sujeto.usuarioId,
    });

    if (cuerpo.clientesAsignados.length > 0) {
      await deps.usuarios.reemplazarCartera(
        usuario.id,
        cuerpo.clientesAsignados,
        rolEnClienteDe(cuerpo.rol),
        deps.ahora(),
      );
    }

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.USUARIO_CREADO,
      entidad: 'usuario',
      entidadId: usuario.id,
      clienteId: null,
      datosDespues: { email: usuario.email, rol: usuario.rol, activo: usuario.activo },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return respuesta.code(201).send({ usuario });
  });

  /**
   * Edición. `clientesAsignados`, cuando viene, reemplaza la cartera entera
   * en una sola operación — no hay forma de agregar o quitar un cliente
   * suelto por esta ruta, a propósito: una cartera es un conjunto, no una
   * colección de altas y bajas independientes.
   */
  app.patch('/api/v1/usuarios/:id', async (peticion) => {
    const { id } = paramsId.parse(peticion.params);
    const sujeto = autorizar(peticion, 'usuario', 'editar');
    const cuerpo = edicionSchema.parse(peticion.body);

    const previo = await deps.usuarios.buscarListadoPorId(id);
    if (!previo) {
      throw new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
    }

    const rolFinal = cuerpo.rol ?? previo.rol;
    const veTodosFinal = cuerpo.veTodosLosClientes ?? previo.veTodosLosClientes;

    if (
      cuerpo.clientesAsignados &&
      cuerpo.clientesAsignados.length > 0 &&
      !veTodosFinal &&
      !rolEnClienteDe(rolFinal)
    ) {
      throw new ErrorDeAplicacion(400, 'Este rol no puede tener cartera asignada.', 'rol_sin_cartera');
    }

    const { clientesAsignados, ...cambios } = cuerpo;

    const usuario =
      Object.keys(cambios).length > 0
        ? await deps.usuarios.actualizar(id, cambios, sujeto.usuarioId)
        : previo;

    if (clientesAsignados !== undefined) {
      await deps.usuarios.reemplazarCartera(
        id,
        veTodosFinal ? [] : clientesAsignados,
        veTodosFinal ? null : rolEnClienteDe(rolFinal),
        deps.ahora(),
      );
    }

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.USUARIO_ACTUALIZADO,
      entidad: 'usuario',
      entidadId: id,
      clienteId: null,
      datosAntes: { rol: previo.rol, activo: previo.activo, veTodosLosClientes: previo.veTodosLosClientes },
      datosDespues: {
        rol: usuario.rol,
        activo: usuario.activo,
        veTodosLosClientes: usuario.veTodosLosClientes,
      },
      ip: peticion.ip,
      agenteUsuario: peticion.headers['user-agent'] ?? null,
      peticionId: String(peticion.id),
    });

    return { usuario };
  });
}
