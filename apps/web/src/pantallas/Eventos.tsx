/**
 * Pantalla de Eventos / event log (tarea 104, pantalla 11 de 12).
 *
 * Solo lectura y **solo para `direccion`** (Daniel, Lili y Laura) desde el
 * 2026-09-10: registra quién hizo cada cosa, y eso incluye el trabajo de los
 * compañeros. Es la ruta que responde "¿quién aprobó este balance?" o "¿cuándo
 * se le cambió el rol a esta persona?" meses después.
 *
 * La pantalla traduce los códigos a castellano **sin ocultarlos**: debajo de
 * cada frase queda el código exacto que generó el sistema, porque en un
 * registro de auditoría el valor literal importa. Lo que no se hace más es
 * mostrar el id de usuario crudo ni el JSON del detalle: una pantalla que
 * existe para rendir cuentas no puede pedirle a nadie que lea UUIDs.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

import { Boton, CampoSelect, CampoTexto, EncabezadoTarjeta, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { listarEventos, type Evento } from '../api/eventos.js';
import { listarUsuarios, type Usuario } from '../api/usuarios.js';

const LIMITE_POR_PAGINA = 50;

interface Filtro {
  entidad: string;
  entidadId: string;
  usuarioId: string;
  clienteId: string;
  desde: string;
  hasta: string;
}

const FILTRO_VACIO: Filtro = { entidad: '', entidadId: '', usuarioId: '', clienteId: '', desde: '', hasta: '' };

/**
 * Traducción de los códigos de `ACCIONES` (`apps/api/src/bitacora.ts`).
 *
 * El código igual se muestra, en chico: en un registro de auditoría el valor
 * exacto que generó el sistema importa. Lo que se agrega es la frase en
 * castellano, porque "vencimiento.generados_del_periodo" no le dice nada a
 * quien tiene que revisar quién hizo qué.
 */
const ETIQUETA_ACCION: Record<string, string> = {
  'acceso.exitoso': 'Ingresó al sistema',
  'acceso.fallido': 'Intento de ingreso fallido',
  'acceso.bloqueado': 'Ingreso bloqueado por intentos',
  'acceso.segundo_factor_superado': 'Superó la verificación en dos pasos',
  'acceso.segundo_factor_fallido': 'Falló la verificación en dos pasos',
  'sesion.cerrada': 'Cerró sesión',
  'sesion.revocada': 'Se le revocó la sesión',
  'seguridad.permiso_denegado': 'Permiso denegado',
  'cliente.creado': 'Dio de alta un cliente',
  'cliente.actualizado': 'Modificó un cliente',
  'usuario.creado': 'Dio de alta un usuario',
  'usuario.actualizado': 'Modificó un usuario',
  'usuario.contrasena_cambiada': 'Cambió su contraseña',
  'usuario.segundo_factor_iniciado': 'Inició la configuración de su segundo factor',
  'usuario.segundo_factor_activado': 'Activó su verificación en dos pasos',
  'solicitud.registrada': 'Abrió un pedido de documentación',
  'solicitud.cerrada': 'Cerró un pedido de documentación',
  'contacto.registrado': 'Registró un contacto con el cliente',
  'recordatorio.enviado': 'Se envió un recordatorio',
  'constancia.emitida': 'Emitió una constancia de gestión',
  'documento.registrado': 'Cargó un documento',
  'documento.importado_desde_archivo': 'Importó documentos desde un archivo',
  'documento.cambio_estado': 'Cambió el estado de un documento',
  'proceso_mensual.actualizado': 'Actualizó el proceso mensual',
  'vencimiento.registrado': 'Cargó un vencimiento',
  'vencimiento.presentado': 'Marcó un vencimiento como presentado',
  'vencimiento.generados_del_periodo': 'Generó los vencimientos del período',
  'alerta.evaluadas': 'Pidió al sistema evaluar las alertas',
  'alerta.cerrada': 'Cerró una alerta',
  'siga.exportacion_importada': 'Importó una exportación de SIGA',
  'siga.conciliacion_revisada': 'Revisó una conciliación con SIGA',
  'liquidacion.generada': 'Generó una liquidación',
  'liquidacion.enviada': 'Envió una liquidación',
  'liquidacion.respondida': 'Registró la respuesta a una liquidación',
  'balance.actualizado': 'Actualizó un balance',
  'balance.aprobado': 'Aprobó un balance',
  'regla_impositiva.creada': 'Creó una regla impositiva',
  'regla_impositiva.modificada': 'Modificó una regla impositiva',
  'regla_notificacion.creada': 'Creó una regla de aviso',
  'regla_notificacion.modificada': 'Modificó una regla de aviso',
};

/** Nombres de campo que aparecen en el detalle, en castellano. */
const ETIQUETA_CAMPO: Record<string, string> = {
  creados: 'creados',
  yaExistian: 'ya existían',
  omitidos: 'omitidos',
  periodo: 'período',
  periodos: 'períodos',
  creadas: 'creadas',
  evaluadas: 'evaluadas',
  vencimientosCreados: 'vencimientos creados',
  alertasCreadas: 'alertas creadas',
  origen: 'origen',
  estado: 'estado',
  tipo: 'tipo',
  motivoCierre: 'motivo del cierre',
  segundoFactorPendiente: 'segundo factor pendiente',
};

/** Un par clave/valor del detalle, ya listo para mostrar. */
interface CampoDeDetalle {
  readonly etiqueta: string;
  readonly valor: string;
}

/**
 * Convierte el JSON del detalle en pares legibles.
 *
 * Antes se mostraba el JSON crudo (`{"creados":0,"periodo":"2026-01",…}`), que
 * es exactamente lo que Daniel señaló el 2026-09-10: la pantalla que existe
 * para rendir cuentas no puede pedirle a nadie que lea JSON.
 */
function camposDelDetalle(valor: unknown): readonly CampoDeDetalle[] {
  if (valor === null || valor === undefined || typeof valor !== 'object') return [];

  return Object.entries(valor as Record<string, unknown>).map(([clave, contenido]) => ({
    etiqueta: ETIQUETA_CAMPO[clave] ?? clave,
    valor: Array.isArray(contenido)
      ? contenido.join(', ')
      : typeof contenido === 'object' && contenido !== null
        ? JSON.stringify(contenido)
        : String(contenido),
  }));
}

export default function Eventos() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<readonly Usuario[]>([]);
  const [eventos, setEventos] = useState<readonly Evento[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  const [filtroAplicado, setFiltroAplicado] = useState<Filtro>(FILTRO_VACIO);

  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string | null) => (clienteId ? mapa.get(clienteId) ?? clienteId : '—');
  }, [clientes]);

  /**
   * El id de usuario se muestra como nombre. Si no se lo encuentra (una
   * persona dada de baja y borrada del listado, por ejemplo) se cae al id:
   * en una bitácora es preferible un identificador feo a un hueco.
   */
  const nombreDeUsuario = useMemo(() => {
    const mapa = new Map(usuarios.map((u) => [u.id, `${u.nombre} ${u.apellido}`.trim()]));
    return (usuarioId: string | null) => (usuarioId ? mapa.get(usuarioId) ?? usuarioId : 'El sistema');
  }, [usuarios]);

  async function buscar(aplicado: Filtro) {
    setCargando(true);
    setError(null);
    try {
      const { eventos: lista } = await listarEventos({
        entidad: aplicado.entidad.trim() || undefined,
        entidadId: aplicado.entidadId.trim() || undefined,
        usuarioId: aplicado.usuarioId.trim() || undefined,
        clienteId: aplicado.clienteId || undefined,
        desde: aplicado.desde || undefined,
        hasta: aplicado.hasta || undefined,
        limite: LIMITE_POR_PAGINA,
        desplazamiento: 0,
      });
      setEventos(lista);
      setHayMas(lista.length === LIMITE_POR_PAGINA);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    // Por separado y no con un Promise.all: son dos listas auxiliares
    // independientes (una para el filtro por cliente, otra para mostrar
    // nombres en vez de ids). Si fallara una, con Promise.all se perdían las
    // dos, y el historial —que es lo que importa— quedaba mostrando ids.
    listarClientes()
      .then(({ clientes: lista }) => setClientes(lista))
      .catch(() => undefined);
    listarUsuarios()
      .then(({ usuarios: personas }) => setUsuarios(personas))
      .catch(() => undefined);

    void buscar(FILTRO_VACIO);
  }, []);

  function manejarBusqueda(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setFiltroAplicado(filtro);
    void buscar(filtro);
  }

  function limpiar() {
    setFiltro(FILTRO_VACIO);
    setFiltroAplicado(FILTRO_VACIO);
    void buscar(FILTRO_VACIO);
  }

  async function cargarMas() {
    setCargandoMas(true);
    try {
      const { eventos: siguientes } = await listarEventos({
        entidad: filtroAplicado.entidad.trim() || undefined,
        entidadId: filtroAplicado.entidadId.trim() || undefined,
        usuarioId: filtroAplicado.usuarioId.trim() || undefined,
        clienteId: filtroAplicado.clienteId || undefined,
        desde: filtroAplicado.desde || undefined,
        hasta: filtroAplicado.hasta || undefined,
        limite: LIMITE_POR_PAGINA,
        desplazamiento: eventos.length,
      });
      setEventos((actual) => [...actual, ...siguientes]);
      setHayMas(siguientes.length === LIMITE_POR_PAGINA);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargandoMas(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-tinta-tenue">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-critico">{error}</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[86rem] space-y-5 px-5 py-6">
      <div>
        <h1 className="text-lg font-semibold">Eventos</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Historial de acciones del sistema — qué cambió, quién lo hizo y cuándo. Los códigos de acción y
          entidad se muestran tal como los generó el sistema.
        </p>
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Filtros" />
        <form onSubmit={manejarBusqueda} className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <CampoTexto
            id="filtroEntidad"
            etiqueta="Entidad"
            placeholder="usuario, cliente, balance…"
            value={filtro.entidad}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, entidad: e.target.value })}
          />
          <CampoTexto
            id="filtroEntidadId"
            etiqueta="Id de la entidad"
            value={filtro.entidadId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, entidadId: e.target.value })}
          />
          <CampoTexto
            id="filtroUsuarioId"
            etiqueta="Id de usuario"
            value={filtro.usuarioId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, usuarioId: e.target.value })}
          />
          <CampoSelect
            id="filtroCliente"
            etiqueta="Cliente"
            placeholder="Todos"
            opciones={clientes.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            value={filtro.clienteId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltro({ ...filtro, clienteId: e.target.value })}
          />
          <CampoTexto
            id="filtroDesde"
            etiqueta="Desde"
            type="date"
            value={filtro.desde}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, desde: e.target.value })}
          />
          <CampoTexto
            id="filtroHasta"
            etiqueta="Hasta"
            type="date"
            value={filtro.hasta}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltro({ ...filtro, hasta: e.target.value })}
          />
          <div className="flex items-end gap-2 sm:col-span-3">
            <Boton variante="primario" icono={Search} type="submit">
              Buscar
            </Boton>
            <Boton variante="secundario" type="button" onClick={limpiar}>
              Limpiar filtros
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Historial" descripcion={`${eventos.length} eventos${hayMas ? ' (hay más)' : ''}`} />
        <Tabla etiqueta="Historial de eventos">
          <thead>
            <tr>
              <Th>Fecha y hora</Th>
              <Th>Usuario</Th>
              <Th>Acción</Th>
              <Th>Entidad</Th>
              <Th>Cliente</Th>
              <Th>Detalle</Th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((evento) => {
              const antes = camposDelDetalle(evento.datosAntes);
              const despues = camposDelDetalle(evento.datosDespues);
              return (
                <tr key={evento.id}>
                  <Td className="cifra text-tinta-suave">{new Date(evento.ocurridoEn).toLocaleString('es-PY')}</Td>
                  <Td className="text-tinta-suave">{nombreDeUsuario(evento.usuarioId)}</Td>
                  <Td>
                    <div>{ETIQUETA_ACCION[evento.accion] ?? evento.accion}</div>
                    <div className="cifra text-xs text-tinta-tenue">{evento.accion}</div>
                  </Td>
                  <Td className="text-tinta-suave">{evento.entidad}</Td>
                  <Td className="text-tinta-suave">{nombreDeCliente(evento.clienteId)}</Td>
                  <Td className="max-w-md text-xs text-tinta-tenue">
                    {antes.length > 0 && (
                      <div>
                        <span className="font-medium">Antes:</span>{' '}
                        {antes.map((campo) => `${campo.etiqueta}: ${campo.valor}`).join(' · ')}
                      </div>
                    )}
                    {despues.length > 0 && (
                      <div>
                        {antes.length > 0 && <span className="font-medium">Después: </span>}
                        {despues.map((campo) => `${campo.etiqueta}: ${campo.valor}`).join(' · ')}
                      </div>
                    )}
                    {antes.length === 0 && despues.length === 0 && '—'}
                  </Td>
                </tr>
              );
            })}
            {eventos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  Ningún evento coincide con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
        {hayMas && (
          <div className="flex justify-center border-t border-borde px-5 py-3">
            <Boton variante="secundario" type="button" onClick={() => void cargarMas()} disabled={cargandoMas}>
              {cargandoMas ? 'Cargando…' : 'Cargar más'}
            </Boton>
          </div>
        )}
      </Tarjeta>
    </main>
  );
}
