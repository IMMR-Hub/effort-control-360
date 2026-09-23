/**
 * Planilla de horas (tarea 144).
 *
 * Daniel, 2026-09-21: *"tener también el tiempo que dedica cada colaborador a
 * cada empresa (para medir finalmente cuánto le cuesta a EFFORT cada cliente),
 * para ir midiendo la productividad vs 'eficiencia'... si solo 'trabajó' más
 * horas o si realmente sus horas fueron eficientes en base al avance de su
 * trabajo."*
 *
 * Esta pantalla es el lado de las HORAS de esa cuenta. El "avance" no se carga
 * acá: ya existe, atribuido a cada persona y a cada cliente, en la bitácora de
 * eventos — no se puede inflar porque no es un número que alguien escriba, es
 * el registro de lo que de verdad se hizo. Las horas sí las carga cada quien
 * (no hay forma honesta de inferirlas de la actividad en pantalla: el tiempo
 * entre dos clics puede ser una llamada, un papel o un café), y por eso el
 * resumen lo dice en voz alta en vez de dejar que se lea como productividad.
 *
 * Cada persona ve y carga SOLO sus propias horas. El resumen del equipo es
 * exclusivo de dirección y trae totales, nunca el día a día de otra persona —
 * mismo criterio que restringió la bitácora a dirección el 2026-09-10.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { describirFiltro, formatearGs, gs, hoyEnParaguay, rangoDelFiltro, sumar, type FiltroDeFechas, type Gs } from '@effort/core';

import {
  Boton,
  CampoSelect,
  CampoTexto,
  EncabezadoTarjeta,
  Indicador,
  Tabla,
  Tarjeta,
  Td,
  Th,
} from '../ui/Primitivos.jsx';
import { FiltroDeFechasSelector, filtroDelMesActual } from '../ui/FiltroDeFechas.js';
import { ErrorDeApi } from '../api/cliente.js';
import { listarClientes, type Cliente } from '../api/clientes.js';
import { listarUsuarios, type Usuario } from '../api/usuarios.js';
import {
  listarMisHoras,
  obtenerResumenDeHoras,
  registrarHoras,
  type RegistroDeHoras,
  type TotalDeHoras,
} from '../api/horas.js';
import { useSesion } from '../contexts/SesionContext.js';

/** Valor del selector para el tiempo que no es de ningún cliente. Nunca viaja a la API. */
const SIN_CLIENTE = '__interno__';
const ETIQUETA_TIEMPO_INTERNO = 'Tiempo interno (sin cliente)';
const MINUTOS_MAXIMOS_POR_DIA = 16 * 60;

function hoyIso(): string {
  const hoy = hoyEnParaguay(new Date());
  return `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}-${String(hoy.dia).padStart(2, '0')}`;
}

/** `150` → `2 h 30 min`. Los minutos son la unidad guardada; las horas, la que se piensa. */
export function formatearMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) return `${horas} h`;
  if (horas === 0) return `${resto} min`;
  return `${horas} h ${String(resto).padStart(2, '0')} min`;
}

interface Formulario {
  readonly fecha: string;
  readonly clienteId: string;
  readonly horas: string;
  readonly tarea: string;
}

function formularioVacio(): Formulario {
  return { fecha: hoyIso(), clienteId: '', horas: '', tarea: '' };
}

export default function Horas() {
  const { sesion } = useSesion();
  const esDireccion = sesion?.rol === 'direccion';
  const hoy = useMemo(() => hoyEnParaguay(new Date()), []);

  const [filtro, setFiltro] = useState<FiltroDeFechas>(filtroDelMesActual());
  // Solo la PRIMERA carga bloquea la pantalla entera. Después (al guardar, al
  // cambiar el período) los datos viejos se quedan a la vista mientras llegan
  // los nuevos: de lo contrario, quien guarda su primer registro veía toda la
  // pantalla —formulario incluido— parpadear a "Cargando…".
  const [cargoAlgunaVez, setCargoAlgunaVez] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<readonly Cliente[]>([]);
  const [misRegistros, setMisRegistros] = useState<readonly RegistroDeHoras[]>([]);
  const [totales, setTotales] = useState<readonly TotalDeHoras[]>([]);
  const [equipo, setEquipo] = useState<readonly Usuario[]>([]);

  const [formulario, setFormulario] = useState<Formulario>(formularioVacio());
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  async function recargar() {
    const rango = rangoDelFiltro(filtro, hoy);
    // Sin `permitirTodo` el selector nunca ofrece "todas las fechas", así que
    // esto no pasa; está para que el tipo se estreche sin un `!`.
    if (!rango) return;

    setError(null);
    try {
      const [{ clientes: listaDeClientes }, { registros }, resumen, personal] = await Promise.all([
        listarClientes(),
        listarMisHoras(rango.desde, rango.hasta),
        esDireccion ? obtenerResumenDeHoras(rango.desde, rango.hasta) : Promise.resolve(null),
        esDireccion ? listarUsuarios() : Promise.resolve(null),
      ]);
      setClientes(listaDeClientes);
      setMisRegistros(registros);
      setTotales(resumen?.totales ?? []);
      setEquipo(personal?.usuarios ?? []);
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    } finally {
      setCargoAlgunaVez(true);
    }
  }

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filtro), esDireccion]);

  const nombreDeCliente = useMemo(() => {
    const mapa = new Map(clientes.map((c) => [c.id, c.nombre]));
    return (clienteId: string | null) =>
      clienteId === null ? ETIQUETA_TIEMPO_INTERNO : (mapa.get(clienteId) ?? clienteId);
  }, [clientes]);

  const nombreDePersona = useMemo(() => {
    const mapa = new Map(equipo.map((u) => [u.id, `${u.nombre} ${u.apellido}`]));
    return (usuarioId: string) => mapa.get(usuarioId) ?? usuarioId;
  }, [equipo]);

  const clientesActivos = useMemo(
    () => clientes.filter((c) => c.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [clientes],
  );

  const opcionesDeCliente = useMemo(
    () => [
      ...clientesActivos.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
      { valor: SIN_CLIENTE, etiqueta: ETIQUETA_TIEMPO_INTERNO },
    ],
    [clientesActivos],
  );

  const minutosPropios = misRegistros.reduce((suma, r) => suma + r.minutos, 0);

  /* --- Resumen del equipo: se deriva de `totales`, nunca se calcula aparte --- */

  /**
   * Agrupa minutos y costo juntos, por la clave que sea (cliente o persona).
   * El costo se suma en guaraníes (bigint), nunca como number: son cientos de
   * miles de guaraníes y JS pierde precisión en la suma de punto flotante.
   * Si NINGUNA fila del grupo tiene costo configurado, el total queda `null`
   * en vez de mostrar "Gs. 0" — que mentiría diciendo que no cuesta nada.
   */
  function agruparPor<K>(clave: (t: TotalDeHoras) => K) {
    const minutosPorClave = new Map<K, number>();
    const costoPorClave = new Map<K, Gs[]>();
    for (const t of totales) {
      minutosPorClave.set(clave(t), (minutosPorClave.get(clave(t)) ?? 0) + t.minutos);
      const lista = costoPorClave.get(clave(t)) ?? [];
      if (t.costoGs !== null) lista.push(gs(t.costoGs));
      costoPorClave.set(clave(t), lista);
    }
    return [...minutosPorClave.entries()]
      .map(([k, minutos]) => {
        const costos = costoPorClave.get(k) ?? [];
        return [k, minutos, costos.length > 0 ? sumar(costos) : null] as const;
      })
      .sort((a, b) => b[1] - a[1]);
  }

  const porCliente = useMemo(() => agruparPor((t) => t.clienteId), [totales]);
  const porPersona = useMemo(() => agruparPor((t) => t.usuarioId), [totales]);

  const detalle = useMemo(
    () =>
      [...totales].sort(
        (a, b) =>
          nombreDePersona(a.usuarioId).localeCompare(nombreDePersona(b.usuarioId), 'es') ||
          nombreDeCliente(a.clienteId).localeCompare(nombreDeCliente(b.clienteId), 'es'),
      ),
    [totales, nombreDePersona, nombreDeCliente],
  );

  const minutosDelEquipo = totales.reduce((suma, t) => suma + t.minutos, 0);
  const costosDelEquipo = totales.filter((t) => t.costoGs !== null).map((t) => gs(t.costoGs!));
  const costoDelEquipo = costosDelEquipo.length > 0 ? sumar(costosDelEquipo) : null;

  function corregir(registro: RegistroDeHoras) {
    setFormulario({
      fecha: registro.fecha.slice(0, 10),
      clienteId: registro.clienteId ?? SIN_CLIENTE,
      horas: String(registro.minutos / 60).replace('.', ','),
      tarea: registro.tarea ?? '',
    });
    setErrorFormulario(null);
    setMensajeExito(null);
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario(null);
    setMensajeExito(null);

    if (formulario.clienteId === '') {
      setErrorFormulario('Elegí el cliente, o "Tiempo interno" si no fue para ninguno.');
      return;
    }

    // Se piensa en horas y se guarda en minutos enteros: la coma decimal de un
    // teclado en español no puede terminar como NaN en un campo de horas.
    const minutos = Math.round(Number(formulario.horas.replace(',', '.')) * 60);
    if (!Number.isFinite(minutos) || minutos < 1) {
      setErrorFormulario('Cargá una cantidad de horas mayor a cero.');
      return;
    }
    if (minutos > MINUTOS_MAXIMOS_POR_DIA) {
      setErrorFormulario('Un solo registro no puede pasar de 16 horas.');
      return;
    }

    setGuardando(true);
    try {
      await registrarHoras({
        clienteId: formulario.clienteId === SIN_CLIENTE ? null : formulario.clienteId,
        fecha: formulario.fecha,
        minutos,
        tarea: formulario.tarea.trim() === '' ? null : formulario.tarea.trim(),
      });
      setMensajeExito(
        `Guardado: ${formatearMinutos(minutos)} el ${formulario.fecha} — ${
          formulario.clienteId === SIN_CLIENTE
            ? ETIQUETA_TIEMPO_INTERNO
            : nombreDeCliente(formulario.clienteId)
        }.`,
      );
      // Se conserva la fecha: quien carga varios clientes del mismo día no
      // quiere volver a elegirla cada vez.
      setFormulario({ ...formularioVacio(), fecha: formulario.fecha });
      await recargar();
    } catch (motivo) {
      setErrorFormulario(
        motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.',
      );
    } finally {
      setGuardando(false);
    }
  }

  if (!cargoAlgunaVez) {
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Planilla de horas</h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Cargá cuánto tiempo le dedicaste hoy a cada cliente. Un solo registro por cliente y día:
            si cargás de nuevo el mismo día y cliente, se corrige el anterior.
          </p>
          <p className="mt-1 text-xs text-tinta-tenue">Mostrando: {describirFiltro(filtro)}.</p>
        </div>
        <FiltroDeFechasSelector id="filtroHoras" valor={filtro} onCambiar={setFiltro} />
      </div>

      <Tarjeta>
        <EncabezadoTarjeta titulo="Cargar horas" descripcion="Solo vos ves lo que cargás acá." />
        <form onSubmit={manejarEnvio} className="space-y-4 px-5 py-4" noValidate>
          {errorFormulario && (
            <p
              role="alert"
              className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico"
            >
              {errorFormulario}
            </p>
          )}
          {mensajeExito && (
            <p
              role="status"
              className="rounded border border-completo-borde bg-completo-fondo px-3 py-2 text-sm text-completo"
            >
              {mensajeExito}
            </p>
          )}

          {/* Una sola línea desde `lg`: cargar horas es lo que cada persona hace
              todos los días, y tiene que ser cuestión de segundos. En pantallas
              angostas se apila. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[9.5rem_minmax(0,1fr)_6.5rem_minmax(0,1.2fr)_auto] lg:items-end">
            <CampoTexto
              id="fechaHoras"
              etiqueta="Día"
              type="date"
              required
              max={hoyIso()}
              value={formulario.fecha}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, fecha: e.target.value })
              }
            />
            <CampoSelect
              id="clienteHoras"
              etiqueta="Cliente"
              placeholder="Elegí un cliente"
              opciones={opcionesDeCliente}
              value={formulario.clienteId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormulario({ ...formulario, clienteId: e.target.value })
              }
            />
            {/* Texto con teclado decimal y no `type="number"`: el número del
                navegador cambia solo con la rueda del mouse (una hora cargada
                mal sin que nadie lo note) y no acepta de forma pareja la coma
                decimal que se escribe en español. Se parsea acá, y el mensaje
                de error dice qué falta. */}
            <CampoTexto
              id="cantidadHoras"
              etiqueta="Horas"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              placeholder="2,5"
              value={formulario.horas}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, horas: e.target.value })
              }
            />
            <CampoTexto
              id="tareaHoras"
              etiqueta="Qué hiciste (opcional)"
              maxLength={200}
              value={formulario.tarea}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormulario({ ...formulario, tarea: e.target.value })
              }
            />
            <Boton variante="primario" type="submit" disabled={guardando} className="sm:col-span-2 lg:col-span-1">
              {guardando ? 'Guardando…' : 'Guardar horas'}
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Resumen de mis horas">
        <Indicador etiqueta="Mis horas del período" valor={formatearMinutos(minutosPropios)} tono="proceso" />
        <Indicador
          etiqueta="Días con horas cargadas"
          valor={new Set(misRegistros.map((r) => r.fecha.slice(0, 10))).size}
          tono="completo"
        />
      </section>

      <Tarjeta>
        <EncabezadoTarjeta
          titulo="Mis horas"
          descripcion={`${misRegistros.length} registros en el período`}
        />
        <Tabla etiqueta="Mis horas del período">
          <thead>
            <tr>
              <Th>Día</Th>
              <Th>Cliente</Th>
              <Th numerica>Horas</Th>
              <Th>Qué hiciste</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {misRegistros.map((registro) => (
              <tr key={registro.id}>
                <Td className="cifra text-tinta-suave">{registro.fecha.slice(0, 10)}</Td>
                <Td className="font-medium">{nombreDeCliente(registro.clienteId)}</Td>
                <Td numerica>{formatearMinutos(registro.minutos)}</Td>
                <Td className="text-tinta-suave">{registro.tarea ?? '—'}</Td>
                <Td>
                  <Boton
                    variante="fantasma"
                    icono={Pencil}
                    onClick={() => corregir(registro)}
                    aria-label={`Corregir horas del ${registro.fecha.slice(0, 10)} — ${nombreDeCliente(registro.clienteId)}`}
                  >
                    Corregir
                  </Boton>
                </Td>
              </tr>
            ))}
            {misRegistros.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                  Todavía no cargaste horas en este período.
                </td>
              </tr>
            )}
          </tbody>
        </Tabla>
      </Tarjeta>


      {esDireccion && (
        <>
          <div>
            <h2 className="text-base font-semibold">Resumen del equipo</h2>
            <p className="mt-1 max-w-3xl text-sm text-tinta-suave">
              Son horas <strong>autoreportadas</strong>: dicen cuánto tiempo dice cada persona que
              dedicó, no cuánto avanzó. El avance real —lo que cada quien hizo en cada cliente— está
              en la pantalla Eventos, y no se puede inflar porque es el registro de lo que ocurrió.
              Para saber si las horas rindieron hay que mirar las dos cosas juntas. Este resumen
              trae solo totales del período, nunca el día a día de una persona. El costo usa un
              valor por hora nominal, configurado por persona — se edita en Equipo.
            </p>
          </div>

          <section className="grid gap-3 sm:grid-cols-4" aria-label="Indicadores del equipo">
            <Indicador etiqueta="Horas del equipo" valor={formatearMinutos(minutosDelEquipo)} tono="proceso" />
            <Indicador
              etiqueta="Costo del equipo"
              valor={costoDelEquipo !== null ? formatearGs(costoDelEquipo) : '—'}
              tono="proceso"
            />
            <Indicador etiqueta="Colaboradores con horas" valor={porPersona.length} tono="completo" />
            <Indicador
              etiqueta="Clientes con horas"
              valor={porCliente.filter(([clienteId]) => clienteId !== null).length}
              tono="pendiente"
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Tarjeta>
              <EncabezadoTarjeta
                titulo="Horas por cliente"
                descripcion="Cuánto tiempo le dedicó el equipo a cada uno en el período"
              />
              <Tabla etiqueta="Horas por cliente" anchoMinimo="min-w-0">
                <thead>
                  <tr>
                    <Th>Cliente</Th>
                    <Th numerica>Horas</Th>
                    <Th numerica>Costo</Th>
                  </tr>
                </thead>
                <tbody>
                  {porCliente.map(([clienteId, minutos, costo]) => (
                    <tr key={clienteId ?? SIN_CLIENTE}>
                      <Td className="font-medium">{nombreDeCliente(clienteId)}</Td>
                      <Td numerica>{formatearMinutos(minutos)}</Td>
                      <Td numerica>{costo !== null ? formatearGs(costo) : '—'}</Td>
                    </tr>
                  ))}
                  {porCliente.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                        Nadie cargó horas en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Tabla>
            </Tarjeta>

            <Tarjeta>
              <EncabezadoTarjeta
                titulo="Horas por colaborador"
                descripcion="Cuánto tiempo cargó cada persona en el período"
              />
              <Tabla etiqueta="Horas por colaborador" anchoMinimo="min-w-0">
                <thead>
                  <tr>
                    <Th>Colaborador</Th>
                    <Th numerica>Horas</Th>
                    <Th numerica>Costo</Th>
                  </tr>
                </thead>
                <tbody>
                  {porPersona.map(([usuarioId, minutos, costo]) => (
                    <tr key={usuarioId}>
                      <Td className="font-medium">{nombreDePersona(usuarioId)}</Td>
                      <Td numerica>{formatearMinutos(minutos)}</Td>
                      <Td numerica>{costo !== null ? formatearGs(costo) : '—'}</Td>
                    </tr>
                  ))}
                  {porPersona.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                        Nadie cargó horas en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Tabla>
            </Tarjeta>
          </div>

          <Tarjeta>
            <EncabezadoTarjeta
              titulo="Detalle por colaborador y cliente"
              descripcion="Cuánto le dedicó cada persona a cada cliente en el período"
            />
            <Tabla etiqueta="Detalle de horas por colaborador y cliente" anchoMinimo="min-w-0">
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Cliente</Th>
                  <Th numerica>Horas</Th>
                  <Th numerica>Costo</Th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((t) => (
                  <tr key={`${t.usuarioId}|${t.clienteId ?? SIN_CLIENTE}`}>
                    <Td className="font-medium">{nombreDePersona(t.usuarioId)}</Td>
                    <Td>{nombreDeCliente(t.clienteId)}</Td>
                    <Td numerica>{formatearMinutos(t.minutos)}</Td>
                    <Td numerica>{t.costoGs !== null ? formatearGs(gs(t.costoGs)) : '—'}</Td>
                  </tr>
                ))}
                {detalle.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-tinta-tenue">
                      Nadie cargó horas en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </Tabla>
          </Tarjeta>
        </>
      )}
    </main>
  );
}
