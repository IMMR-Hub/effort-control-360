/**
 * Seguimiento: pedidos del equipo.
 *
 * Los pedidos que un colaborador le hace a dirección (o que dirección anota por
 * él), con su conversación. Cada colaborador ve solo los suyos y sin las notas
 * internas; solo dirección escribe (regla 12).
 *
 * Tres reglas que esta ruta hace cumplir y no se delegan:
 *  - El alcance sale SIEMPRE de la sesión, nunca de la petición. Un pedido
 *    ajeno devuelve 404, igual que uno inexistente: no se confirma que existe.
 *  - El texto de un pedido es dato. Se guarda y se muestra tal cual; nada lo
 *    interpreta ni lo ejecuta.
 *  - Nada acá envía correos ni mensajes (REGLA 0-bis). `recordarEl` es una
 *    marca visual.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ordenarPendientes, resumirPendientes, type ItemPendiente } from '@effort/core';
import { idSchema } from '@effort/schema';

import { ACCIONES, registrarEvento } from '../bitacora.js';
import type { UsuarioListado } from '../puertos.js';
import type {
  AlcanceDePedidos,
  CambioDePedido,
  CambioDePrioridadDeSolicitud,
  DatosDeMensaje,
  EstadoDePedido,
  MensajeAlmacenado,
  PedidoAlmacenado,
} from '../puertos-dominio.js';
import { ErrorDeAplicacion, type Dependencias } from '../servidor.js';
import { exigirPermiso, filtroDeClientes, puede, type SujetoAutenticado } from '../seguridad/rbac.js';
import { autorizar, paramsId } from './comun.js';

/* --- Esquemas ------------------------------------------------------------- */

const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
const CANALES = ['LLAMADA', 'MENSAJE', 'WHATSAPP', 'CORREO', 'PRESENCIAL'] as const;
const ESTADOS: readonly EstadoDePedido[] = ['ABIERTO', 'EN_CURSO', 'RESUELTO', 'CANCELADO'];

const texto = (maximo: number) => z.string().trim().min(1).max(maximo);
const asuntoSchema = texto(200);
const textoDeMensajeSchema = texto(4000);
const motivoSchema = texto(500);
const prioridadSchema = z.enum(PRIORIDADES);
const canalSchema = z.enum(CANALES);
const ocurridoEnSchema = z
  .string()
  .datetime({ offset: true })
  .transform((valor) => new Date(valor));

/** 'AAAA-MM-DD' y además un día que existe en el calendario (no el 30 de febrero). */
const recordarElSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')
  .refine((valor) => {
    const fecha = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
  }, 'Fecha inexistente.')
  .nullable();

/** Al menos una clave: un PATCH vacío no cambia nada y casi seguro es un error del cliente. */
const prioridadDeSolicitudSchema = z
  .object({
    prioridad: prioridadSchema.optional(),
    recordarEl: recordarElSchema.optional(),
  })
  .strict()
  .refine((c) => c.prioridad !== undefined || c.recordarEl !== undefined, {
    message: 'No hay nada que cambiar.',
  });

const destinatariosSchema = z
  .array(idSchema)
  .min(1)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Hay destinatarios repetidos.' });

const consultaSchema = z
  .object({
    estado: z.string().optional(),
    prioridad: prioridadSchema.optional(),
    colaborador: idSchema.optional(),
  })
  .strict();

const altaSchema = z
  .object({
    solicitanteUsuarioId: idSchema,
    destinatarioUsuarioIds: destinatariosSchema,
    clienteId: idSchema.nullable().default(null),
    asunto: asuntoSchema,
    prioridad: prioridadSchema.default('MEDIA'),
    recordarEl: recordarElSchema.default(null),
    canal: canalSchema,
    ocurridoEn: ocurridoEnSchema,
    texto: textoDeMensajeSchema,
  })
  .strict();

const mensajeSchema = z
  .object({
    autorUsuarioId: idSchema,
    canal: canalSchema,
    ocurridoEn: ocurridoEnSchema,
    texto: textoDeMensajeSchema,
    notaInterna: z.boolean().default(false),
  })
  .strict();

/** Sin `notaInterna`: una corrección hereda la visibilidad del mensaje que corrige. */
const correccionSchema = z
  .object({
    /** El pedido al que pertenece el mensaje: se verifica contra la base, no se confía. */
    pedidoId: idSchema,
    autorUsuarioId: idSchema,
    canal: canalSchema,
    ocurridoEn: ocurridoEnSchema,
    texto: textoDeMensajeSchema,
  })
  .strict();

const accionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('tildar') }).strict(),
  z.object({ accion: z.literal('destildar') }).strict(),
  z.object({ accion: z.literal('en_curso') }).strict(),
  z.object({ accion: z.literal('reagendar'), recordarEl: recordarElSchema }).strict(),
  z.object({ accion: z.literal('cancelar'), motivo: motivoSchema }).strict(),
  z.object({ accion: z.literal('reabrir') }).strict(),
  z.object({ accion: z.literal('prioridad'), prioridad: prioridadSchema }).strict(),
  z.object({ accion: z.literal('derivar'), destinatarioUsuarioIds: destinatariosSchema }).strict(),
  z.object({ accion: z.literal('derivar_a_soporte') }).strict(),
  z
    .object({
      accion: z.literal('corregir'),
      asunto: asuntoSchema.optional(),
      clienteId: idSchema.nullable().optional(),
    })
    .strict(),
]).refine((a) => a.accion !== 'corregir' || a.asunto !== undefined || a.clienteId !== undefined, {
  message: 'No hay nada que corregir.',
});

type Accion = z.infer<typeof accionSchema>;

/* --- Transiciones --------------------------------------------------------- */

const NO_TERMINALES: readonly EstadoDePedido[] = ['ABIERTO', 'EN_CURSO'];

/** Estados desde los que cada acción es válida. */
const DESDE: Record<Accion['accion'], readonly EstadoDePedido[]> = {
  tildar: NO_TERMINALES,
  destildar: ['RESUELTO'],
  en_curso: ['ABIERTO'],
  cancelar: NO_TERMINALES,
  reabrir: ['RESUELTO', 'CANCELADO'],
  reagendar: NO_TERMINALES,
  prioridad: NO_TERMINALES,
  derivar: NO_TERMINALES,
  derivar_a_soporte: NO_TERMINALES,
  corregir: NO_TERMINALES,
};

/** El cambio que produce cada acción, sin validar el estado de origen. */
function cambioDeLaAccion(accion: Accion): CambioDePedido {
  switch (accion.accion) {
    case 'tildar':
      return { estado: 'RESUELTO' };
    case 'destildar':
      return { estado: 'ABIERTO' };
    case 'en_curso':
      return { estado: 'EN_CURSO' };
    case 'cancelar':
      return { estado: 'CANCELADO', motivoDeCancelacion: accion.motivo };
    case 'reabrir':
      return { estado: 'ABIERTO', motivoDeCancelacion: null };
    case 'reagendar':
      return { recordarEl: accion.recordarEl };
    case 'prioridad':
      return { prioridad: accion.prioridad };
    case 'derivar':
      return { destinatarioUsuarioIds: accion.destinatarioUsuarioIds };
    case 'derivar_a_soporte':
      return { derivadoASoporte: true };
    case 'corregir':
      return {
        ...(accion.asunto !== undefined ? { asunto: accion.asunto } : {}),
        ...(accion.clienteId !== undefined ? { clienteId: accion.clienteId } : {}),
      };
  }
}

/* --- Salida --------------------------------------------------------------- */

type MapaDeUsuarios = ReadonlyMap<string, UsuarioListado>;

function nombreDe(usuarios: MapaDeUsuarios, id: string): string {
  const usuario = usuarios.get(id);
  if (!usuario) return 'Desconocido';
  const completo = `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
  return usuario.activo ? completo : `${completo} (inactivo)`;
}

function pedidoASalida(pedido: PedidoAlmacenado, usuarios: MapaDeUsuarios) {
  return {
    ...pedido,
    derivadoASoporteEn: pedido.derivadoASoporteEn?.toISOString() ?? null,
    creadoEn: pedido.creadoEn.toISOString(),
    actualizadoEn: pedido.actualizadoEn.toISOString(),
    solicitanteNombre: nombreDe(usuarios, pedido.solicitanteUsuarioId),
    destinatarioNombres: pedido.destinatarioUsuarioIds.map((id) => nombreDe(usuarios, id)),
  };
}

function mensajeASalida(mensaje: MensajeAlmacenado, usuarios: MapaDeUsuarios) {
  return {
    ...mensaje,
    ocurridoEn: mensaje.ocurridoEn.toISOString(),
    creadoEn: mensaje.creadoEn.toISOString(),
    autorNombre: nombreDe(usuarios, mensaje.autorUsuarioId),
  };
}

/** Una fila de la bandeja: `ItemPendiente` más lo que la pantalla muestra. */
interface ItemDeBandeja extends ItemPendiente {
  readonly estado: string;
  readonly titulo: string;
  readonly deQuien: string;
  readonly clienteId: string | null;
  readonly periodo: string | null;
  /** Quién lo pidió, para el filtro por colaborador: el solicitante en EQUIPO, null en CLIENTE. */
  readonly solicitanteUsuarioId: string | null;
  /** Solo en EQUIPO: ya se derivó a soporte (false en CLIENTE). */
  readonly derivadoASoporte: boolean;
}

/* --- Utilidades ----------------------------------------------------------- */

/** Una sola consulta de usuarios por petición (no una por pedido). */
async function cargarUsuarios(deps: Dependencias): Promise<MapaDeUsuarios> {
  const usuarios = await deps.usuarios.listar();
  return new Map(usuarios.map((u) => [u.id, u]));
}

/** El alcance sale de la sesión: nunca de un parámetro de la petición. */
function alcanceDe(sujeto: SujetoAutenticado): AlcanceDePedidos {
  return sujeto.rol === 'direccion' ? { todo: true } : { soloDe: sujeto.usuarioId };
}

function noEncontrado(): ErrorDeAplicacion {
  return new ErrorDeAplicacion(404, 'Recurso inexistente.', 'no_encontrado');
}

/** Cada destinatario tiene que ser una persona de dirección y estar activa. */
function validarDestinatarios(usuarios: MapaDeUsuarios, ids: readonly string[]): void {
  const invalido = ids.some((id) => {
    const usuario = usuarios.get(id);
    return !usuario || !usuario.activo || usuario.rol !== 'direccion';
  });
  if (invalido) {
    throw new ErrorDeAplicacion(
      400,
      'Los destinatarios tienen que ser personas de dirección activas.',
      'destinatario_invalido',
    );
  }
}

function validarPersona(usuarios: MapaDeUsuarios, id: string, que: string): void {
  const usuario = usuarios.get(id);
  if (!usuario || !usuario.activo) {
    throw new ErrorDeAplicacion(400, `${que} no existe o está inactivo.`, 'usuario_invalido');
  }
}

async function validarCliente(deps: Dependencias, clienteId: string | null): Promise<void> {
  if (clienteId === null) return;
  if (!(await deps.clientes.buscarPorId(clienteId, null))) {
    throw new ErrorDeAplicacion(400, 'El cliente no existe.', 'cliente_invalido');
  }
}

function datosDeMensaje(
  cuerpo: { autorUsuarioId: string; canal: string; ocurridoEn: Date; texto: string },
  notaInterna: boolean,
  registradoPor: string,
): DatosDeMensaje {
  return {
    autorUsuarioId: cuerpo.autorUsuarioId,
    canal: cuerpo.canal,
    ocurridoEn: cuerpo.ocurridoEn,
    texto: cuerpo.texto,
    notaInterna,
    registradoPorUsuarioId: registradoPor,
  };
}

/* --- Rutas ---------------------------------------------------------------- */

export async function registrarRutasDeSeguimiento(
  app: FastifyInstance,
  deps: Dependencias,
): Promise<void> {
  const contexto = (peticion: FastifyRequest) => ({
    ip: peticion.ip,
    agenteUsuario: peticion.headers['user-agent'] ?? null,
    peticionId: String(peticion.id),
  });

  app.get('/api/v1/seguimiento/pedidos-equipo', async (peticion) => {
    const sujeto = autorizar(peticion, 'pedido_equipo', 'ver');
    const consulta = consultaSchema.parse(peticion.query ?? {});

    const estados = consulta.estado
      ? z.array(z.enum(ESTADOS as [EstadoDePedido, ...EstadoDePedido[]])).parse(consulta.estado.split(','))
      : undefined;

    // `colaborador` solo lo respeta dirección; para el resto se ignora.
    const colaborador = sujeto.rol === 'direccion' ? consulta.colaborador : undefined;

    const [pedidos, usuarios] = await Promise.all([
      deps.pedidosDelEquipo.listar(alcanceDe(sujeto), estados ? { estados } : {}),
      cargarUsuarios(deps),
    ]);

    return {
      pedidos: pedidos
        .filter((p) => !consulta.prioridad || p.prioridad === consulta.prioridad)
        .filter((p) => !colaborador || p.solicitanteUsuarioId === colaborador)
        .map((p) => pedidoASalida(p, usuarios)),
    };
  });

  app.post('/api/v1/seguimiento/pedidos-equipo', async (peticion, respuesta) => {
    // Primero el permiso: quien no puede escribir recibe 403, no los detalles de validación.
    const sujeto = autorizar(peticion, 'pedido_equipo', 'crear');
    const cuerpo = altaSchema.parse(peticion.body);
    if (cuerpo.clienteId) exigirPermiso(sujeto, 'pedido_equipo', 'crear', cuerpo.clienteId);

    const usuarios = await cargarUsuarios(deps);
    validarPersona(usuarios, cuerpo.solicitanteUsuarioId, 'El solicitante');
    validarDestinatarios(usuarios, cuerpo.destinatarioUsuarioIds);
    await validarCliente(deps, cuerpo.clienteId);

    const pedido = await deps.pedidosDelEquipo.crear({
      solicitanteUsuarioId: cuerpo.solicitanteUsuarioId,
      destinatarioUsuarioIds: cuerpo.destinatarioUsuarioIds,
      clienteId: cuerpo.clienteId,
      asunto: cuerpo.asunto,
      prioridad: cuerpo.prioridad,
      recordarEl: cuerpo.recordarEl,
      primerMensaje: { canal: cuerpo.canal, ocurridoEn: cuerpo.ocurridoEn, texto: cuerpo.texto },
      registradoPorUsuarioId: sujeto.usuarioId,
    });

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.PEDIDO_EQUIPO_CREADO,
      entidad: 'pedido_equipo',
      entidadId: pedido.id,
      clienteId: pedido.clienteId,
      datosDespues: {
        solicitanteUsuarioId: pedido.solicitanteUsuarioId,
        destinatarioUsuarioIds: pedido.destinatarioUsuarioIds,
        asunto: pedido.asunto,
        prioridad: pedido.prioridad,
        recordarEl: pedido.recordarEl,
        canal: cuerpo.canal,
      },
      ...contexto(peticion),
    });

    return respuesta.code(201).send({ pedido: pedidoASalida(pedido, usuarios) });
  });

  app.get('/api/v1/seguimiento/pedidos-equipo/:id', async (peticion) => {
    const sujeto = autorizar(peticion, 'pedido_equipo', 'ver');
    const { id } = paramsId.parse(peticion.params);

    // Ajeno e inexistente son indistinguibles: 404 en ambos casos.
    const encontrado = await deps.pedidosDelEquipo.buscar(id, alcanceDe(sujeto));
    if (!encontrado) throw noEncontrado();

    const usuarios = await cargarUsuarios(deps);
    return {
      pedido: pedidoASalida(encontrado.pedido, usuarios),
      mensajes: encontrado.mensajes.map((m) => mensajeASalida(m, usuarios)),
    };
  });

  app.post('/api/v1/seguimiento/pedidos-equipo/:id/mensajes', async (peticion, respuesta) => {
    const sujeto = autorizar(peticion, 'pedido_equipo', 'crear');
    const { id } = paramsId.parse(peticion.params);
    const cuerpo = mensajeSchema.parse(peticion.body);

    // Quien llega acá es dirección, así que el alcance es total.
    const encontrado = await deps.pedidosDelEquipo.buscar(id, { todo: true });
    if (!encontrado) throw noEncontrado();

    const usuarios = await cargarUsuarios(deps);
    validarPersona(usuarios, cuerpo.autorUsuarioId, 'El autor');

    const mensaje = await deps.pedidosDelEquipo.agregarMensaje(
      id,
      datosDeMensaje(cuerpo, cuerpo.notaInterna, sujeto.usuarioId),
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.PEDIDO_EQUIPO_MENSAJE,
      entidad: 'pedido_equipo',
      entidadId: id,
      clienteId: encontrado.pedido.clienteId,
      datosDespues: {
        mensajeId: mensaje.id,
        canal: mensaje.canal,
        notaInterna: mensaje.notaInterna,
        autorUsuarioId: mensaje.autorUsuarioId,
      },
      ...contexto(peticion),
    });

    return respuesta.code(201).send({ mensaje: mensajeASalida(mensaje, usuarios) });
  });

  /** Un mensaje no se edita ni se borra: la corrección es un mensaje nuevo que lo reemplaza. */
  app.post('/api/v1/seguimiento/mensajes/:id/correccion', async (peticion, respuesta) => {
    const sujeto = autorizar(peticion, 'pedido_equipo', 'editar');
    const { id } = paramsId.parse(peticion.params);
    const cuerpo = correccionSchema.parse(peticion.body);

    const encontrado = await deps.pedidosDelEquipo.buscar(cuerpo.pedidoId, { todo: true });
    const original = encontrado?.mensajes.find((m) => m.id === id);
    if (!encontrado || !original) throw noEncontrado();

    const usuarios = await cargarUsuarios(deps);
    validarPersona(usuarios, cuerpo.autorUsuarioId, 'El autor');

    // Hereda la visibilidad: una corrección nunca vuelve pública una nota interna.
    const mensaje = await deps.pedidosDelEquipo.corregirMensaje(
      id,
      datosDeMensaje(cuerpo, original.notaInterna, sujeto.usuarioId),
    );

    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.PEDIDO_EQUIPO_MENSAJE_CORREGIDO,
      entidad: 'pedido_equipo',
      entidadId: encontrado.pedido.id,
      clienteId: encontrado.pedido.clienteId,
      datosAntes: { mensajeId: original.id, canal: original.canal, notaInterna: original.notaInterna },
      datosDespues: { mensajeId: mensaje.id, canal: mensaje.canal, notaInterna: mensaje.notaInterna },
      ...contexto(peticion),
    });

    return respuesta.code(201).send({ mensaje: mensajeASalida(mensaje, usuarios) });
  });

  app.patch('/api/v1/seguimiento/pedidos-equipo/:id', async (peticion) => {
    const sujeto = autorizar(peticion, 'pedido_equipo', 'editar');
    const { id } = paramsId.parse(peticion.params);
    const accion = accionSchema.parse(peticion.body);

    const encontrado = await deps.pedidosDelEquipo.buscar(id, { todo: true });
    if (!encontrado) throw noEncontrado();
    const previo = encontrado.pedido;
    if (previo.clienteId) exigirPermiso(sujeto, 'pedido_equipo', 'editar', previo.clienteId);

    if (!DESDE[accion.accion].includes(previo.estado)) {
      throw new ErrorDeAplicacion(
        409,
        `No se puede hacer «${accion.accion}» con un pedido ${previo.estado}.`,
        'transicion_invalida',
      );
    }

    const usuarios = await cargarUsuarios(deps);
    if (accion.accion === 'derivar') validarDestinatarios(usuarios, accion.destinatarioUsuarioIds);
    if (accion.accion === 'corregir' && accion.clienteId !== undefined) {
      exigirPermiso(sujeto, 'pedido_equipo', 'editar', accion.clienteId);
      await validarCliente(deps, accion.clienteId);
    }

    const cambio = cambioDeLaAccion(accion);
    const nuevo = await deps.pedidosDelEquipo.cambiar(id, cambio, sujeto.usuarioId);

    const campos = Object.keys(cambio) as (keyof CambioDePedido)[];
    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.PEDIDO_EQUIPO_CAMBIADO,
      entidad: 'pedido_equipo',
      entidadId: id,
      clienteId: nuevo.clienteId,
      datosAntes: Object.fromEntries(campos.map((c) => [c, previo[c]])),
      datosDespues: Object.fromEntries(campos.map((c) => [c, nuevo[c]])),
      ...contexto(peticion),
    });

    return { pedido: pedidoASalida(nuevo, usuarios) };
  });

  /**
   * Bandeja de «Pendientes»: pedidos del equipo abiertos o en curso, más las
   * solicitudes a clientes que siguen sin cerrarse (de todos los períodos).
   * Cada consulta es una sola (usuarios, clientes, solicitudes): sin N+1.
   * El orden y los contadores salen de `@effort/core`, con el reloj inyectado.
   */
  app.get('/api/v1/seguimiento/pendientes', async (peticion) => {
    const sujeto = autorizar(peticion, 'pedido_equipo', 'ver');
    const ahora = deps.ahora();
    const incluyeSolicitudes = puede(sujeto, 'solicitud', 'ver');
    const cartera = filtroDeClientes(sujeto);

    const [pedidos, solicitudes, usuarios, clientes] = await Promise.all([
      deps.pedidosDelEquipo.listar(alcanceDe(sujeto), { estados: ['ABIERTO', 'EN_CURSO'] }),
      incluyeSolicitudes ? deps.solicitudes.listarPendientes(cartera) : Promise.resolve([]),
      cargarUsuarios(deps),
      incluyeSolicitudes ? deps.clientes.listar(cartera) : Promise.resolve([]),
    ]);
    const nombreDeCliente = new Map(clientes.map((c) => [c.id, c.nombre]));

    const items: ItemDeBandeja[] = [
      ...pedidos.map((p): ItemDeBandeja => ({
        tipo: 'EQUIPO',
        id: p.id,
        prioridad: p.prioridad,
        recordarEl: p.recordarEl,
        creadoEn: p.creadoEn.toISOString(),
        estado: p.estado,
        titulo: p.asunto,
        deQuien: nombreDe(usuarios, p.solicitanteUsuarioId),
        clienteId: p.clienteId,
        periodo: null,
        solicitanteUsuarioId: p.solicitanteUsuarioId,
        derivadoASoporte: p.derivadoASoporte,
      })),
      ...solicitudes.map((sol): ItemDeBandeja => ({
        tipo: 'CLIENTE',
        id: sol.id,
        prioridad: sol.prioridad,
        recordarEl: sol.recordarEl,
        creadoEn: sol.creadoEn.toISOString(),
        estado: sol.estado,
        titulo: `Documentación ${sol.periodo}`,
        deQuien: nombreDeCliente.get(sol.clienteId) ?? 'Cliente desconocido',
        clienteId: sol.clienteId,
        periodo: sol.periodo,
        solicitanteUsuarioId: null,
        derivadoASoporte: false,
      })),
    ];

    return {
      items: ordenarPendientes(items, ahora),
      resumen: resumirPendientes(items, ahora),
    };
  });

  /** Prioridad y recordatorio visual de una solicitud a un cliente. No toca su estado ni envía nada. */
  app.patch('/api/v1/seguimiento/solicitudes/:id/prioridad', async (peticion) => {
    const sujeto = autorizar(peticion, 'solicitud', 'editar');
    const { id } = paramsId.parse(peticion.params);
    const cuerpo = prioridadDeSolicitudSchema.parse(peticion.body);

    const previa = await deps.solicitudes.buscarPorId(id, filtroDeClientes(sujeto));
    if (!previa) throw noEncontrado();

    const cambio: CambioDePrioridadDeSolicitud = {
      ...(cuerpo.prioridad !== undefined ? { prioridad: cuerpo.prioridad } : {}),
      ...(cuerpo.recordarEl !== undefined ? { recordarEl: cuerpo.recordarEl } : {}),
    };
    const nueva = await deps.solicitudes.cambiarPrioridad(id, cambio, sujeto.usuarioId);

    const campos = Object.keys(cambio) as (keyof CambioDePrioridadDeSolicitud)[];
    await registrarEvento(deps.bitacora, peticion.log, {
      usuarioId: sujeto.usuarioId,
      accion: ACCIONES.SOLICITUD_PRIORIDAD_CAMBIADA,
      entidad: 'solicitud_documentacion',
      entidadId: id,
      clienteId: nueva.clienteId,
      datosAntes: Object.fromEntries(campos.map((c) => [c, previa[c]])),
      datosDespues: Object.fromEntries(campos.map((c) => [c, nueva[c]])),
      ...contexto(peticion),
    });

    return {
      solicitud: {
        ...nueva,
        cuentaDesde: nueva.cuentaDesde.toISOString().slice(0, 10),
        ultimoRecordatorioEn: nueva.ultimoRecordatorioEn?.toISOString().slice(0, 10) ?? null,
        creadoEn: nueva.creadoEn.toISOString(),
      },
    };
  });

  /** Lo derivado a soporte: solo dirección (por eso pide `editar`). */
  app.get('/api/v1/seguimiento/soporte', async (peticion) => {
    autorizar(peticion, 'pedido_equipo', 'editar');
    const [pedidos, usuarios] = await Promise.all([
      deps.pedidosDelEquipo.listarDerivadosASoporte(),
      cargarUsuarios(deps),
    ]);
    return { pedidos: pedidos.map((p) => pedidoASalida(p, usuarios)) };
  });
}
