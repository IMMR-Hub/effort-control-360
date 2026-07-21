/**
 * Pantalla de seguimiento al cliente.
 *
 * Responde tres preguntas en una sola vista:
 *   1. ¿A quién hay que perseguir hoy y por qué?
 *   2. ¿Qué se hizo ya, por qué vía, y quién atendió?
 *   3. Si el cliente reclama, ¿qué le mostramos?
 *
 * Toda cifra sale de @effort/core sobre los registros. No hay un solo número
 * escrito a mano acá: si la lógica de escalamiento cambia, esta pantalla cambia
 * sola, y si esta pantalla mostrara algo distinto de lo que hace el motor, sería
 * un bug visible en los tests del motor y no una discrepancia silenciosa.
 */

import { useMemo, useState } from 'react';
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
  feriadosParaguay,
  fechaLimiteDeEntrega,
  planificarProximoRecordatorio,
} from '@effort/core';

import {
  Badge,
  Boton,
  EncabezadoTarjeta,
  Indicador,
  Logotipo,
  Tabla,
  Tarjeta,
  Td,
  Th,
} from '../ui/Primitivos.jsx';
import {
  CLIENTES,
  CONTACTOS,
  PERIODO_ACTIVO,
  REGLA_DOCUMENTACION,
  SOLICITUDES,
} from '../datos-semilla/seguimiento.js';

const calendario = crearCalendario([...feriadosParaguay(2026), ...feriadosParaguay(2027)]);

/** "Hoy" del piloto. Cuando exista la API, esto viene del servidor. */
const HOY = { anio: 2026, mes: 4, dia: 21 };

const ICONO_CANAL = {
  LLAMADA: Phone,
  MENSAJE: MessageSquare,
  WHATSAPP: MessageSquare,
  CORREO: Send,
  PRESENCIAL: Users,
};

const ETIQUETA_ESTADO = {
  ENTREGADA: { texto: 'Entregada', tono: 'completo' },
  ABIERTA: { texto: 'Sin entregar', tono: 'critico' },
  RESPONDIDA_SIN_ENTREGA: { texto: 'Prometió entregar', tono: 'parcial' },
  ESCALADA: { texto: 'Escalada', tono: 'critico' },
  AGOTADA: { texto: 'Recordatorios agotados', tono: 'critico' },
  CERRADA_MANUALMENTE: { texto: 'Cerrada a mano', tono: 'pendiente' },
};

function formatearFechaHora(fecha) {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

function diasDesde(fecha) {
  const dia = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
  const hoy = Date.UTC(HOY.anio, HOY.mes - 1, HOY.dia);
  return Math.round((hoy - dia) / 86_400_000);
}

export default function Seguimiento() {
  const [clienteSeleccionado, setClienteSeleccionado] = useState('cli-gsosa');

  /** Estado derivado por cliente: todo calculado por el motor, nada a mano. */
  const filas = useMemo(
    () =>
      SOLICITUDES.map((solicitud) => {
        const cliente = CLIENTES.find((c) => c.id === solicitud.clienteId);
        const plan = planificarProximoRecordatorio(solicitud, REGLA_DOCUMENTACION, calendario);
        const limite = fechaLimiteDeEntrega(solicitud, REGLA_DOCUMENTACION, calendario);
        const contactos = CONTACTOS.filter((c) => c.clienteId === solicitud.clienteId);
        const ultimo = contactos.reduce(
          (masReciente, c) => (!masReciente || c.ocurridoEn > masReciente.ocurridoEn ? c : masReciente),
          null,
        );

        return {
          solicitud,
          cliente,
          plan,
          limite,
          ultimoContacto: ultimo,
          diasSinContacto: ultimo ? diasDesde(ultimo.ocurridoEn) : null,
          respondioAlgunaVez: contactos.some((c) => c.huboRespuesta),
        };
      }),
    [],
  );

  const constancia = useMemo(
    () => armarConstanciaDeGestion(clienteSeleccionado, PERIODO_ACTIVO, CONTACTOS),
    [clienteSeleccionado],
  );

  const contactosDelCliente = useMemo(
    () =>
      CONTACTOS.filter((c) => c.clienteId === clienteSeleccionado).sort(
        (a, b) => b.ocurridoEn - a.ocurridoEn,
      ),
    [clienteSeleccionado],
  );

  const nombreCliente = CLIENTES.find((c) => c.id === clienteSeleccionado)?.nombre ?? '';

  const sinEntregar = filas.filter((f) => f.solicitud.estado !== 'ENTREGADA').length;
  const escalados = filas.filter((f) => f.plan?.esEscalamiento).length;
  const agotados = filas.filter(
    (f) => f.solicitud.estado !== 'ENTREGADA' && f.plan === null,
  ).length;
  const nuncaRespondieron = filas.filter(
    (f) => f.solicitud.estado !== 'ENTREGADA' && !f.respondioAlgunaVez,
  ).length;

  return (
    <div className="min-h-dvh bg-lienzo font-interfaz text-tinta">
      <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-[86rem] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Logotipo />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-tinta-tenue sm:inline">Período</span>
            <Badge tono="proceso" conIcono={false}>marzo 2026</Badge>
            <Boton variante="fantasma" icono={Settings2}>Reglas de aviso</Boton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[86rem] space-y-5 px-5 py-6">
        <div>
          <h1 className="text-lg font-semibold">Seguimiento al cliente</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Quién no entregó, qué se le reclamó y con qué respaldo. Los recordatorios salen solos
            según la regla configurada; cada intento queda registrado para poder demostrarlo después.
          </p>
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
            detalle={`desde el recordatorio ${REGLA_DOCUMENTACION.escalarAPartirDelRecordatorio}`}
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
            descripcion={`Plazo: ${REGLA_DOCUMENTACION.diasHabilesDePlazo}º día hábil · Aviso ${REGLA_DOCUMENTACION.horaDeEnvio} · Insiste cada ${REGLA_DOCUMENTACION.reintentarCadaDiasHabiles} días hábiles`}
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
                const seleccionada = fila.cliente.id === clienteSeleccionado;

                return (
                  <tr
                    key={fila.solicitud.id}
                    onClick={() => setClienteSeleccionado(fila.cliente.id)}
                    className={`cursor-pointer transition-colors hover:bg-superficie-tenue ${
                      seleccionada ? 'bg-superficie-tenue' : ''
                    }`}
                  >
                    <Td className="font-medium">{fila.cliente.nombre}</Td>
                    <Td><Badge tono={estado.tono}>{estado.texto}</Badge></Td>
                    <Td className="text-tinta-suave">{fechaCivilAIso(fila.limite)}</Td>
                    <Td numerica>{fila.solicitud.recordatoriosEnviados}</Td>
                    <Td className="text-tinta-suave">
                      {fila.ultimoContacto
                        ? `${formatearFechaHora(fila.ultimoContacto.ocurridoEn)} · ${fila.ultimoContacto.canal.toLowerCase()}`
                        : 'sin contacto'}
                    </Td>
                    <Td numerica className={fila.diasSinContacto > 3 ? 'font-semibold text-critico' : ''}>
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
                        {contacto.origen === 'AUTOMATICO' ? (
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
          </Tarjeta>
        </div>

        <p className="pb-4 text-xs text-tinta-tenue">
          Datos de semilla, no operativos. Los nombres de clientes están pendientes de confirmación
          por EFFORT.
        </p>
      </main>
    </div>
  );
}
