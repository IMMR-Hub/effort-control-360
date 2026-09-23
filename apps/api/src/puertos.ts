/**
 * Puertos de persistencia.
 *
 * Las rutas dependen de estas interfaces, no de Prisma. Eso permite dos cosas
 * que importan: probar el servidor entero sin levantar una base de datos, y
 * cambiar de motor sin reescribir las rutas.
 *
 * Todo método que consulta datos de clientes recibe el filtro de cartera. No
 * es opcional a propósito: si fuera un parámetro que se puede omitir, tarde o
 * temprano alguien lo omite y expone la cartera completa.
 */

import type { Rol } from '@effort/schema';

import type { Sesion } from './seguridad/sesiones.js';

export interface UsuarioConCredenciales {
  readonly id: string;
  readonly email: string;
  readonly rol: Rol;
  readonly activo: boolean;
  readonly veTodosLosClientes: boolean;
  readonly hashContrasena: string;
  readonly secretoTotp: string | null;
  readonly segundoFactorActivo: boolean;
  readonly debeCambiarContrasena: boolean;
}

/** Lo que ve dirección en la vista de equipo. Nunca incluye credenciales. */
export interface UsuarioListado {
  readonly id: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono: string | null;
  readonly cargo: string | null;
  readonly rol: Rol;
  readonly activo: boolean;
  readonly veTodosLosClientes: boolean;
  readonly ultimoAccesoEn: Date | null;
  /** Guaraníes por hora. Sensible: solo dirección lo ve y lo edita. Ver DISCREPANCIAS 35. */
  readonly costoPorHora: bigint | null;
}

export interface AltaDeUsuario {
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono: string | null;
  readonly cargo: string | null;
  readonly rol: Rol;
  readonly veTodosLosClientes: boolean;
  /** Ya hasheada: la ruta la genera con `hashearContrasena`, el repositorio no hashea nada. */
  readonly hashContrasena: string;
  readonly creadoPorUsuarioId: string;
}

/**
 * Campos editables de un usuario.
 *
 * `email` no está: cambiarlo es un cambio de identidad de acceso, no una
 * edición de ficha, y no lo pide la tarea. `hashContrasena` tampoco: cambiar
 * la propia contraseña es un flujo aparte que todavía no existe (ver
 * `docs/ROADMAP-MAESTRO.md`, bitácora 2026-07-23).
 *
 * Con `exactOptionalPropertyTypes` activo, cada campo declara `| undefined`
 * de forma explícita en vez de depender de `Partial<T>`: la ruta arma el
 * cuerpo de cambios desestructurando el resultado de un Zod `.optional()`,
 * que sí puede traer `undefined` explícito.
 */
export type CamposEditablesDeUsuario = {
  nombre?: string | undefined;
  apellido?: string | undefined;
  telefono?: string | null | undefined;
  cargo?: string | null | undefined;
  rol?: Rol | undefined;
  activo?: boolean | undefined;
  veTodosLosClientes?: boolean | undefined;
  costoPorHora?: bigint | undefined;
};

/** Rol válido para una asignación de cartera. `direccion` y `solo_lectura` no llevan una: la primera ve todo, la segunda es una auditoría general. */
export type RolEnCliente = 'responsable' | 'coordinador' | 'auxiliar' | 'revisor_balance';

export interface RepositorioDeUsuarios {
  buscarPorEmail(email: string): Promise<UsuarioConCredenciales | null>;
  buscarPorId(id: string): Promise<UsuarioConCredenciales | null>;
  clientesAsignados(usuarioId: string): Promise<string[]>;
  registrarAcceso(usuarioId: string, momento: Date): Promise<void>;

  /** El equipo completo, para la pantalla de dirección. */
  listar(): Promise<UsuarioListado[]>;
  buscarListadoPorId(id: string): Promise<UsuarioListado | null>;
  /**
   * Quiénes tienen asignado un cliente con un rol determinado, vigente hoy.
   *
   * Existe para resolver destinatarios `RESPONSABLE_DEL_CLIENTE` y
   * `COORDINADOR_DEL_CLIENTE` de una regla de notificación (tarea 96): sin
   * esto, una regla que apunta al responsable de un cliente no tiene forma
   * de encontrar a quién es.
   */
  listarAsignadosAlCliente(clienteId: string, rol: RolEnCliente): Promise<UsuarioListado[]>;
  crear(datos: AltaDeUsuario): Promise<UsuarioListado>;
  actualizar(
    id: string,
    cambios: CamposEditablesDeUsuario,
    actorId: string,
  ): Promise<UsuarioListado>;
  /**
   * Reemplaza la cartera asignada a un usuario.
   *
   * No borra filas: cierra (`hasta`) las asignaciones vigentes que ya no
   * corresponden y abre filas nuevas para las que faltan. El historial de
   * quién llevó qué cliente y cuándo queda intacto.
   *
   * `rolEnCliente` en `null` solo es válido con `clienteIds` vacío — es el
   * caso de un usuario sin cartera acotada (`direccion`, `solo_lectura`, o
   * cualquiera con `veTodosLosClientes` en `true`).
   */
  reemplazarCartera(
    usuarioId: string,
    clienteIds: readonly string[],
    rolEnCliente: RolEnCliente | null,
    momento: Date,
  ): Promise<void>;

  /*
   * Credenciales propias.
   *
   * Van aparte de `actualizar` a propósito: esa la usa dirección sobre otra
   * persona, y estas las usa cada quien sobre sí mismo. Mezclarlas abriría la
   * puerta a que una edición de perfil termine tocando una contraseña.
   */

  /** Guarda el secreto TOTP. Solo para el alta inicial del segundo factor. */
  guardarSecretoTotp(usuarioId: string, secreto: string): Promise<void>;

  /** Marca el segundo factor como activo, ya confirmado con un código válido. */
  activarSegundoFactor(usuarioId: string): Promise<void>;

  /**
   * Reemplaza la contraseña y baja `debeCambiarContrasena`.
   *
   * Recibe el hash ya calculado: el repositorio no conoce el algoritmo, igual
   * que no lo conoce para el alta.
   */
  cambiarContrasena(usuarioId: string, hashContrasena: string, momento: Date): Promise<void>;
}

export interface RepositorioDeSesiones {
  crear(datos: {
    hashDelToken: string;
    usuarioId: string;
    segundoFactorSuperado: boolean;
    ipTruncada: string | null;
    agenteUsuario: string | null;
  }): Promise<Sesion>;
  buscarPorHash(hashDelToken: string): Promise<Sesion | null>;
  marcarSegundoFactorSuperado(sesionId: string): Promise<void>;
  tocar(sesionId: string, momento: Date): Promise<void>;
  revocar(sesionId: string, momento: Date, motivo: string): Promise<void>;
  revocarTodasDelUsuario(usuarioId: string, momento: Date, motivo: string): Promise<void>;
}

export interface ClienteListado {
  readonly id: string;
  readonly nombre: string;
  readonly ruc: string;
  readonly tipoPersona: string;
  readonly regimenTributario: string | null;
  readonly email: string | null;
  readonly telefono: string | null;
  readonly canalPreferido: string | null;
  readonly carpetaOneDriveId: string | null;
  readonly activo: boolean;
  readonly observaciones: string | null;
}

export interface AltaDeCliente {
  readonly nombre: string;
  readonly ruc: string;
  readonly tipoPersona: string;
  readonly regimenTributario: string | null;
  readonly email: string | null;
  readonly telefono: string | null;
  readonly canalPreferido: string | null;
  readonly observaciones: string | null;
  readonly creadoPorUsuarioId: string;
}

/**
 * Campos editables de un cliente. A diferencia de reglas impositivas, acá no
 * hay ninguna fila histórica que una edición pueda reescribir: los documentos,
 * vencimientos y balances de un cliente referencian su `id`, no su RUC ni su
 * nombre, así que corregir un RUC mal tipeado en la carga inicial no altera
 * nada de lo ya calculado. Por eso todo el campo, incluido `ruc`, es editable.
 *
 * `clienteId`/asignación de equipo no está acá: quién lleva un cliente se
 * gestiona desde el lado del usuario (`reemplazarCartera`, tarea 83), no
 * desde acá — un solo lugar escribe `asignacion_cliente`.
 */
export type CamposEditablesDeCliente = {
  nombre?: string | undefined;
  ruc?: string | undefined;
  tipoPersona?: string | undefined;
  regimenTributario?: string | null | undefined;
  email?: string | null | undefined;
  telefono?: string | null | undefined;
  canalPreferido?: string | null | undefined;
  carpetaOneDriveId?: string | null | undefined;
  activo?: boolean | undefined;
  observaciones?: string | null | undefined;
};

export interface RepositorioDeClientes {
  /** `filtro` en null significa cartera completa; un arreglo, solo esos clientes. */
  listar(filtro: readonly string[] | null): Promise<ClienteListado[]>;
  buscarPorId(id: string, filtro: readonly string[] | null): Promise<ClienteListado | null>;
  buscarPorRuc(ruc: string): Promise<ClienteListado | null>;
  crear(datos: AltaDeCliente): Promise<ClienteListado>;
  actualizar(
    id: string,
    cambios: CamposEditablesDeCliente,
    actorId: string,
  ): Promise<ClienteListado>;
}

export interface ContactoAlmacenado {
  readonly id: string;
  readonly clienteId: string;
  readonly periodo: string;
  /** Solicitud de documentación a la que responde este contacto, si aplica. */
  readonly solicitudId: string | null;
  readonly canal: string;
  readonly direccion: string;
  readonly origenContacto: string;
  readonly ocurridoEn: Date;
  readonly registradoPorUsuarioId: string;
  readonly huboRespuesta: boolean;
  readonly quienAtendio: string | null;
  readonly resumen: string;
  readonly evidenciaId: string | null;
}

export interface RepositorioDeContactos {
  listarPorCliente(clienteId: string, periodo: string | null): Promise<ContactoAlmacenado[]>;
  /**
   * Todos los contactos del periodo en la cartera alcanzable, de una sola vez.
   *
   * Existe para que la pantalla de Seguimiento no tenga que pedir los contactos
   * cliente por cliente: con 5 clientes eran 5 consultas, con los 144 reales de
   * EFFORT serian 144. Cada consulta a la base cuesta ~310 ms de ida y vuelta
   * (ver DISCREPANCIAS.md punto 18), asi que el N+1 no era un detalle de estilo.
   */
  listarDelPeriodo(periodo: string, filtro: readonly string[] | null): Promise<ContactoAlmacenado[]>;
  registrar(datos: Omit<ContactoAlmacenado, 'id'>): Promise<ContactoAlmacenado>;
}

/* --- Registro de horas (tarea 144) ----------------------------------------- */

export interface RegistroDeHorasAlmacenado {
  readonly id: string;
  readonly usuarioId: string;
  /** `null` es tiempo interno, no asignado a ningún cliente. */
  readonly clienteId: string | null;
  readonly fecha: Date;
  readonly minutos: number;
  readonly tarea: string | null;
}

export interface AltaDeRegistroDeHoras {
  readonly usuarioId: string;
  readonly clienteId: string | null;
  readonly fecha: Date;
  readonly minutos: number;
  readonly tarea: string | null;
}

/**
 * Un total agregado: cuántos minutos le dedicó UN colaborador a UN cliente (o
 * a tiempo interno) en el rango. Nunca una fila individual — ver el
 * comentario de `resumen` más abajo.
 */
export interface TotalDeHoras {
  readonly usuarioId: string;
  readonly clienteId: string | null;
  readonly minutos: number;
}

export interface RepositorioDeHoras {
  /**
   * Alta o corrección del registro de un día. Upsert por
   * (usuarioId, clienteId, fecha): cargar de nuevo el mismo día y cliente
   * CORRIGE el registro existente, nunca lo duplica.
   */
  registrar(datos: AltaDeRegistroDeHoras): Promise<RegistroDeHorasAlmacenado>;
  /** Los propios registros de un usuario, día por día, en un rango de fechas. */
  listarPropios(usuarioId: string, desde: Date, hasta: Date): Promise<RegistroDeHorasAlmacenado[]>;
  /**
   * Totales por colaborador y cliente en el rango, agregados en la base — NUNCA
   * expone la fila de un día individual de otra persona, solo la suma del
   * período. Es la diferencia entre "cuánto le dedicamos al cliente X este
   * mes" (legítimo para decidir precios) y "qué hizo Fulana el martes a las
   * 14 hs" (vigilancia sin ningún fin de negocio). Ver `resumen_horas` en
   * `seguridad/rbac.ts`.
   */
  resumen(desde: Date, hasta: Date, filtroClientes: readonly string[] | null): Promise<TotalDeHoras[]>;
}
