/**
 * Pantalla de seguimiento al cliente (tarea 101: contra la API real, no
 * datos de semilla).
 *
 * Responde tres preguntas en una sola vista:
 *   1. ¿A quién hay que perseguir hoy y por qué?
 *   2. ¿Qué se hizo ya, por qué vía, y quién atendió?
 *   3. Si el cliente reclama, ¿qué le mostramos?
 *
 * Toda cifra sale de `@effort/core` sobre los registros que trae la API. No
 * hay un solo número escrito a mano acá: si la lógica de escalamiento cambia,
 * esta pantalla cambia sola.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarClock,
  FileText,
  MessageSquare,
  Phone,
  Send,
  Settings2,
  Users,
} from 'lucide-react';

import {
  armarConstanciaDeGestion,
  crearCalendario,
  fechaCivilAIso,
  fechaCivilDesdeIso,
  feriadosParaguay,
  fechaLimiteDeEntrega,
  hoyEnParaguay,
  periodoDesdeTexto,
  planificarProximoRecordatorio,
  type CalendarioHabil,
  type PlanDeEnvio,
  type ReglaNotificacion,
  type RegistroContacto as RegistroContactoCore,
  type SolicitudDocumentacion as SolicitudCore,
} from '@effort/core';

import {
  Badge,
  Boton,
  EncabezadoTarjeta,
  Indicador,
  Tabla,
  Tarjeta,
  Td,
  Th,
} from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { listarContactos, type Contacto } from '../api/contactos.js';
import { listarReglasDeNotificacion } from '../api/reglasNotificacion.js';
import { listarSolicitudesPorPeriodo, type SolicitudDocumentacion } from '../api/solicitudes.js';

const ICONO_CANAL: Record<Contacto['canal'], typeof Phone> = {
  LLAMADA: Phone,
  MENSAJE: MessageSquare,
  WHATSAPP: MessageSquare,
  CORREO: Send,
  PRESENCIAL: Users,
};

const ETIQUETA_ESTADO: Record<
  SolicitudDocumentacion['estado'],
  { texto: string; tono: 'completo' | 'critico' | 'parcial' | 'pendiente' }
> = {
  ENTREGADA: { texto: 'Entregada', tono: 'completo' },
  ABIERTA: { texto: 'Sin entregar', tono: 'critico' },
  RESPONDIDA_SIN_ENTREGA: { texto: 'Prometió entregar', tono: 'parcial' },
  ESCALADA: { texto: 'Escalada', tono: 'critico' },
  AGOTADA: { texto: 'Recordatorios agotados', tono: 'critico' },
  CERRADA_MANUALMENTE: { texto: 'Cerrada a mano', tono: 'pendiente' },
};

function formatearFechaHora(fechaIso: string): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fechaIso));
}

function formatearPeriodo(periodo: string): string {
  const partes = periodo.split('-').map(Number);
  const anio = partes[0] ?? 0;
  const mes = partes[1] ?? 1;
  return new Intl.DateTimeFormat('es-PY', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(anio, mes - 1, 1)));
}

function diasDesde(fechaIso: string, hoy: Date): number {
  const fecha = new Date(fechaIso);
  const dia = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
  const diaDeHoy = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((diaDeHoy - dia) / 86_400_000);
}

/** Convierte la solicitud que trae la API a la forma que espera `@effort/core`. */
function aSolicitudCore(solicitud: SolicitudDocumentacion): SolicitudCore {
  return {
    id: solicitud.id,
    clienteId: solicitud.clienteId,
    periodo: periodoDesdeTexto(solicitud.periodo),
    estado: solicitud.estado,
    cuentaDesde: fechaCivilDesdeIso(solicitud.cuentaDesde),
    recordatoriosEnviados: solicitud.recordatoriosEnviados,
    ultimoRecordatorioEn: solicitud.ultimoRecordatorioEn
      ? fechaCivilDesdeIso(solicitud.ultimoRecordatorioEn)
      : null,
  };
}

function aContactoCore(contacto: Contacto): RegistroContactoCore {
  return {
    id: contacto.id,
    clienteId: contacto.clienteId,
    periodo: periodoDesdeTexto(contacto.periodo),
    solicitudId: null,
    canal: contacto.canal,
    direccion: contacto.direccion,
    origen: contacto.origenContacto,
    ocurridoEn: new Date(contacto.ocurridoEn),
    registradoPorUsuarioId: contacto.registradoPorUsuarioId,
    huboRespuesta: contacto.huboRespuesta,
    quienAtendio: contacto.quienAtendio,
    resumen: contacto.resumen,
    evidenciaId: contacto.evidenciaId,
  };
}

interface FilaDeSeguimiento {
  readonly solicitud: SolicitudDocumentacion;
  readonly cliente: Cliente | undefined;
  readonly plan: PlanDeEnvio | null;
  readonly limite: string;
  readonly ultimoContacto: Contacto | null;
  readonly diasSinContacto: number | null;
  readonly respondioAlgunaVez: boolean;
}

export default function Seguimiento() {
  const periodoActivo = useMemo(() => {
    const hoy = hoyEnParaguay(new Date());
    return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}`;
  }, []);

  const calendario: CalendarioHabil = useMemo(() => {
    const anio = Number(periodoActivo.slice(0, 4));
    return crearCalendario([...feriadosParaguay(anio), ...feriadosParaguay(anio + 1)]);
  }, [periodoActivo]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [solicitudes, setSolicitudes] = useState<readonly SolicitudDocumentacion[]>([]);
  const [regla, setRegla] = useState<ReglaNotificacion | null>(null);
  const [contactosPorCliente, setContactosPorCliente] = useState<
    Readonly<Record<string, readonly Contacto[]>>
  >({});
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const [{ clientes: listaDeClientes }, { solicitudes: listaDeSolicitudes }, { reglas }] =
          await Promise.all([
            listarClientes(),
            listarSolicitudesPorPeriodo(periodoActivo),
            listarReglasDeNotificacion(),
          ]);

        if (cancelado) return;

        const reglaDocumentacion = reglas.find(
          (candidata) => candidata.evento === 'DOCUMENTACION_NO_ENTREGADA' && candidata.activa,
        );

        const idsDeClientes = [...new Set(listaDeSolicitudes.map((s) => s.clienteId))];
        const contactosPorId: Record<string, readonly Contacto[]> = {};
        await Promise.all(
          idsDeClientes.map(async (clienteId) => {
            const { contactos } = await listarContactos(clienteId, periodoActivo);
            contactosPorId[clienteId] = contactos;
          }),
        );

        if (cancelado) return;

        setClientes(listaDeClientes);
        setSolicitudes(listaDeSolicitudes);
        setRegla(
          reglaDocumentacion
            ? {
                id: reglaDocumentacion.id,
                nombre: reglaDocumentacion.nombre,
                activa: reglaDocumentacion.activa,
                evento: reglaDocumentacion.evento,
                diasHabilesDePlazo: reglaDocumentacion.diasHabilesDePlazo,
                horaDeEnvio: reglaDocumentacion.horaDeEnvio,
                reintentarCadaDiasHabiles: reglaDocumentacion.reintentarCadaDiasHabiles,
                maximoRecordatorios: reglaDocumentacion.maximoRecordatorios,
                escalarAPartirDelRecordatorio: reglaDocumentacion.escalarAPartirDelRecordatorio,
                destinatariosIniciales: reglaDocumentacion.destinatariosIniciales,
                destinatariosDeEscalamiento: reglaDocumentacion.destinatariosDeEscalamiento,
                plantillaId: reglaDocumentacion.plantillaId ?? '',
              }
            : null,
        );
        setContactosPorCliente(contactosPorId);
        setClienteSeleccionado((actual) => actual ?? listaDeSolicitudes[0]?.clienteId ?? null);
      } catch (motivo) {
        if (cancelado) return;
        setError(
          motivo instanceof ErrorDeApi
            ? motivo.message
            : 'No se pudo conectar con el servidor.',
        );
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [periodoActivo]);

  // Memoizado: si se recalculara en cada render, cambiaría de referencia
  // todo el tiempo y el `useMemo` de más abajo (que lo usa) recalcularía en
  // cada render también, sin ningún beneficio — encontrado al configurar
  // `react-hooks/exhaustive-deps`, que marcaba `hoy` como dependencia
  // faltante ahí abajo.
  const hoy = useMemo(() => new Date(), []);

  const filas: readonly FilaDeSeguimiento[] = useMemo(
    () =>
      solicitudes.map((solicitud) => {
        const cliente = clientes.find((c) => c.id === solicitud.clienteId);
        const contactosDelCliente = contactosPorCliente[solicitud.clienteId] ?? [];

        const plan = regla
          ? planificarProximoRecordatorio(aSolicitudCore(solicitud), regla, calendario)
          : null;
        const limite = regla
          ? fechaCivilAIso(fechaLimiteDeEntrega(aSolicitudCore(solicitud), regla, calendario))
          : solicitud.cuentaDesde;

        const ultimo = contactosDelCliente.reduce<Contacto | null>(
          (masReciente, c) =>
            !masReciente || c.ocurridoEn > masReciente.ocurridoEn ? c : masReciente,
          null,
        );

        return {
          solicitud,
          cliente,
          plan,
          limite,
          ultimoContacto: ultimo,
          diasSinContacto: ultimo ? diasDesde(ultimo.ocurridoEn, hoy) : null,
          respondioAlgunaVez: contactosDelCliente.some((c) => c.huboRespuesta),
        };
      }),
    [solicitudes, clientes, contactosPorCliente, regla, calendario, hoy],
  );

  const contactosDelCliente = useMemo(
    () =>
      (clienteSeleccionado ? contactosPorCliente[clienteSeleccionado] ?? [] : [])
        .slice()
        .sort((a, b) => (a.ocurridoEn > b.ocurridoEn ? -1 : 1)),
    [clienteSeleccionado, contactosPorCliente],
  );

  const constancia = useMemo(() => {
    if (!clienteSeleccionado) return null;
    return armarConstanciaDeGestion(
      clienteSeleccionado,
      periodoDesdeTexto(periodoActivo),
      contactosDelCliente.map(aContactoCore),
    );
  }, [clienteSeleccionado, periodoActivo, contactosDelCliente]);

  const nombreCliente = clientes.find((c) => c.id === clienteSeleccionado)?.nombre ?? '';

  const sinEntregar = filas.filter((f) => f.solicitud.estado !== 'ENTREGADA').length;
  const escalados = filas.filter((f) => f.plan?.esEscalamiento).length;
  const agotados = filas.filter(
    (f) => f.solicitud.estado !== 'ENTREGADA' && f.plan === null,
  ).length;
  const nuncaRespondieron = filas.filter(
    (f) => f.solicitud.estado !== 'ENTREGADA' && !f.respondioAlgunaVez,
  ).length;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Seguimiento al cliente</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Quién no entregó, qué se le reclamó y con qué respaldo. Los recordatorios salen solos
            según la regla configurada; cada intento queda registrado para poder demostrarlo después.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-tinta-tenue sm:inline">Período</span>
          <Badge tono="proceso" conIcono={false}>{formatearPeriodo(periodoActivo)}</Badge>
          <Boton variante="fantasma" icono={Settings2}>Reglas de aviso</Boton>
        </div>
      </div>

        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Resumen del período"
        >
          <Indicador
            etiqueta="Sin entregar"
            valor={sinEntregar}
            detalle={`de ${filas.length} clientes del piloto`}
            tono="critico"
          />
          <Indicador
            etiqueta="Escalados a dirección"
            valor={escalados}
            detalle={regla ? `desde el recordatorio ${regla.escalarAPartirDelRecordatorio}` : '—'}
            tono="parcial"
          />
          <Indicador
            etiqueta="Nunca respondieron"
            valor={nuncaRespondieron}
            detalle="ningún contacto contestado"
            tono="critico"
            destacado={nuncaRespondieron > 0}
          />
          <Indicador
            etiqueta="Recordatorios agotados"
            valor={agotados}
            detalle="requieren decisión comercial"
            tono="pendiente"
          />
        </section>

        <Tarjeta>
          <EncabezadoTarjeta
            titulo="Estado de entrega por cliente"
            descripcion={
              regla
                ? `Plazo: ${regla.diasHabilesDePlazo}º día hábil · Aviso ${regla.horaDeEnvio} · Insiste cada ${regla.reintentarCadaDiasHabiles} días hábiles`
                : 'Sin regla de "Entrega de documentación" configurada todavía.'
            }
            acciones={<Boton variante="secundario" icono={FileText}>Exportar</Boton>}
          />
          <Tabla etiqueta="Estado de entrega de documentación por cliente">
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th>Venció</Th>
                <Th numerica>Avisos</Th>
                <Th>Último contacto</Th>
                <Th numerica>Días sin respuesta</Th>
                <Th>Próxima acción</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const estado = ETIQUETA_ESTADO[fila.solicitud.estado];
                const seleccionada = fila.solicitud.clienteId === clienteSeleccionado;

                return (
                  <tr
                    key={fila.solicitud.id}
                    onClick={() => setClienteSeleccionado(fila.solicitud.clienteId)}
                    className={`cursor-pointer transition-colors hover:bg-superficie-tenue ${
                      seleccionada ? 'bg-superficie-tenue' : ''
                    }`}
                  >
                    <Td className="font-medium">{fila.cliente?.nombre ?? fila.solicitud.clienteId}</Td>
                    <Td><Badge tono={estado.tono}>{estado.texto}</Badge></Td>
                    <Td className="text-tinta-suave">{fila.limite}</Td>
                    <Td numerica>{fila.solicitud.recordatoriosEnviados}</Td>
                    <Td className="text-tinta-suave">
                      {fila.ultimoContacto
                        ? `${formatearFechaHora(fila.ultimoContacto.ocurridoEn)} · ${fila.ultimoContacto.canal.toLowerCase()}`
                        : 'sin contacto'}
                    </Td>
                    <Td
                      numerica
                      className={
                        fila.diasSinContacto !== null && fila.diasSinContacto > 3
                          ? 'font-semibold text-critico'
                          : ''
                      }
                    >
                      {fila.diasSinContacto ?? '—'}
                    </Td>
                    <Td className="text-tinta-suave">
                      {fila.solicitud.estado === 'ENTREGADA' ? (
                        <span className="text-completo">Nada pendiente</span>
                      ) : fila.plan ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock size={14} aria-hidden="true" />
                          Aviso {fila.plan.numeroDeRecordatorio} el {fechaCivilAIso(fila.plan.fecha)}
                          {fila.plan.esEscalamiento && (
                            <span className="inline-flex items-center gap-0.5 text-parcial">
                              <ArrowUpRight size={13} aria-hidden="true" />
                              con dirección
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-critico">Avisos agotados — decidir</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                    Todavía no se abrió el seguimiento de ningún cliente para este período.
                  </td>
                </tr>
              )}
            </tbody>
          </Tabla>
        </Tarjeta>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <Tarjeta>
            <EncabezadoTarjeta
              titulo={`Bitácora de contactos — ${nombreCliente}`}
              descripcion="Cada intento, con vía, fecha, quién lo hizo y si contestaron."
              acciones={<Boton variante="primario" icono={Phone}>Registrar contacto</Boton>}
            />
            <ol className="divide-y divide-borde">
              {contactosDelCliente.map((contacto) => {
                const Icono = ICONO_CANAL[contacto.canal];
                return (
                  <li key={contacto.id} className="flex gap-3 px-5 py-3.5">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        contacto.huboRespuesta
                          ? 'border-completo-borde bg-completo-fondo text-completo'
                          : 'border-borde bg-superficie-hundida text-tinta-tenue'
                      }`}
                    >
                      <Icono size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium capitalize">
                          {contacto.canal.toLowerCase()}
                        </span>
                        <span className="text-xs text-tinta-tenue">
                          {formatearFechaHora(contacto.ocurridoEn)}
                        </span>
                        {contacto.origenContacto === 'AUTOMATICO' ? (
                          <Badge tono="proceso" conIcono={false}>automático</Badge>
                        ) : (
                          <Badge tono="pendiente" conIcono={false}>manual</Badge>
                        )}
                        {contacto.huboRespuesta ? (
                          <Badge tono="completo">respondió</Badge>
                        ) : (
                          <Badge tono="critico">sin respuesta</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-tinta-suave">{contacto.resumen}</p>
                      <p className="mt-1 text-xs text-tinta-tenue">
                        {contacto.quienAtendio
                          ? `Atendió: ${contacto.quienAtendio}`
                          : 'Nadie atendió'}
                        {contacto.evidenciaId && ' · con evidencia adjunta'}
                      </p>
                    </div>
                  </li>
                );
              })}
              {contactosDelCliente.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-tinta-tenue">
                  Todavía no hay contactos registrados para este cliente.
                </li>
              )}
            </ol>
          </Tarjeta>

          <Tarjeta className="self-start">
            <EncabezadoTarjeta
              titulo="Constancia de gestión"
              descripcion="Lo que se le muestra al cliente que reclama."
              acciones={<Boton variante="secundario" icono={FileText}>PDF</Boton>}
            />
            {constancia ? (
              <div className="space-y-4 px-5 py-4">
                <p className="rounded border border-borde-marca bg-superficie-tenue px-3 py-2.5 text-sm text-tinta-suave">
                  {constancia.sintesis}
                </p>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-tinta-tenue">Intentos totales</dt>
                    <dd className="cifra text-lg font-semibold">{constancia.totalDeContactos}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-tenue">Respuestas</dt>
                    <dd className="cifra text-lg font-semibold">{constancia.vecesQueRespondieron}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-tenue">Avisos del sistema</dt>
                    <dd className="cifra text-lg font-semibold">{constancia.contactosAutomaticos}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta-tenue">Gestiones a mano</dt>
                    <dd className="cifra text-lg font-semibold">{constancia.contactosManuales}</dd>
                  </div>
                </dl>

                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-tinta-tenue">
                    Por vía
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(constancia.contactosPorCanal)
                      .filter(([, cantidad]) => cantidad > 0)
                      .map(([canal, cantidad]) => (
                        <Badge key={canal} tono="pendiente" conIcono={false}>
                          {canal.toLowerCase()} · {cantidad}
                        </Badge>
                      ))}
                  </div>
                </div>

                {constancia.personasQueAtendieron.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-tinta-tenue">
                      Atendieron
                    </p>
                    <p className="text-sm text-tinta-suave">
                      {constancia.personasQueAtendieron.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-tinta-tenue">
                Elegí un cliente de la tabla para ver su constancia.
              </p>
            )}
          </Tarjeta>
        </div>
    </main>
  );
}
