/**
 * Acciones rápidas de cada fila, estilo Recordatorios del iPhone (Daniel,
 * 2026-11-27): tildar, reagendar, cancelar con motivo y derivar.
 *
 * Solo las dibuja quien puede escribir (regla 12): la pantalla que las usa lo
 * decide con `ROLES_QUE_ABREN`, igual que la matriz del servidor. Nada se borra
 * (un cancelado queda en «Cerrados») y nada se pregunta con `window.prompt`: el
 * motivo y la fecha se cargan en formularios de la propia fila.
 */

import { useState } from 'react';
import { CalendarClock, Check, LifeBuoy, RotateCcw, Share2, X } from 'lucide-react';

import { Boton, CampoSelect, CampoTexto } from '../../ui/Primitivos.jsx';
import {
  cambiarPedido,
  cambiarPrioridadDeSolicitud,
  type AccionDePedido,
  type EstadoDePedido,
  type Prioridad,
} from '../../api/seguimiento.js';
import { cerrarSolicitud } from '../../api/solicitudes.js';
import { OPCIONES_PRIORIDAD, fechaDeReagenda, mensajeDeError, type OpcionDeReagenda } from './comun.js';

type Panel = 'reagendar' | 'cancelar' | 'derivar' | 'soporte' | 'cerrar' | null;

/** Corre una escritura, avisa a la pantalla para que recargue, y deja el error del servidor a la vista. */
function useEscritura(alCambiar: () => void | Promise<void>) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(escribir: () => Promise<unknown>): Promise<boolean> {
    setOcupado(true);
    setError(null);
    try {
      await escribir();
      await alCambiar();
      return true;
    } catch (motivo) {
      setError(mensajeDeError(motivo));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return { ocupado, error, ejecutar };
}

const OPCIONES_DE_REAGENDA: readonly { valor: OpcionDeReagenda; texto: string }[] = [
  { valor: 'manana', texto: 'Mañana' },
  { valor: 'tres_dias', texto: 'En 3 días' },
  { valor: 'proxima_semana', texto: 'Próxima semana' },
];

function MenuDeReagendar({
  idCampo,
  ocupado,
  alElegir,
  alQuitar,
}: {
  readonly idCampo: string;
  readonly ocupado: boolean;
  readonly alElegir: (fecha: string) => void;
  /** Solo se pasa si hay una fecha que quitar: «Quitar» deja el recordatorio en null (el cambio queda en el registro). */
  readonly alQuitar?: (() => void) | undefined;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const [fecha, setFecha] = useState('');

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Reagendar el recordatorio">
      <div className="flex flex-wrap gap-1.5">
        {OPCIONES_DE_REAGENDA.map((opcion) => (
          <Boton
            key={opcion.valor}
            disabled={ocupado}
            onClick={() => alElegir(fechaDeReagenda(opcion.valor, new Date()))}
          >
            {opcion.texto}
          </Boton>
        ))}
        <Boton disabled={ocupado} onClick={() => setEligiendo(true)}>
          Elegir fecha
        </Boton>
        {alQuitar && (
          <Boton variante="fantasma" disabled={ocupado} onClick={alQuitar}>
            Quitar recordatorio
          </Boton>
        )}
      </div>
      {eligiendo && (
        <div className="flex flex-wrap items-end gap-2">
          <CampoTexto
            id={idCampo}
            etiqueta="Nueva fecha"
            type="date"
            value={fecha}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFecha(e.target.value)}
          />
          <Boton variante="primario" disabled={ocupado || fecha === ''} onClick={() => alElegir(fecha)}>
            Guardar fecha
          </Boton>
        </div>
      )}
    </div>
  );
}

function ErrorDeAccion({ error }: { readonly error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded border border-critico-borde bg-critico-fondo px-2 py-1 text-xs text-critico">
      {error}
    </p>
  );
}

export interface OpcionDeDestinatario {
  readonly valor: string;
  readonly etiqueta: string;
}

/** Acciones de un pedido del equipo. Abiertos: tildar y compañía; cerrados: reabrir. */
export function AccionesDePedido({
  id,
  estado,
  derivadoASoporte = false,
  recordarEl = null,
  destinatarios,
  destinatariosActuales = [],
  alCambiar,
}: {
  readonly id: string;
  readonly estado: EstadoDePedido;
  readonly derivadoASoporte?: boolean;
  /** 'AAAA-MM-DD' o null: con fecha, el menú de reagendar ofrece «Quitar recordatorio». */
  readonly recordarEl?: string | null;
  readonly destinatarios: readonly OpcionDeDestinatario[];
  /** Los «Para» actuales del pedido: «Derivar» los abre ya tildados. Sin dato, ninguno. */
  readonly destinatariosActuales?: readonly string[];
  readonly alCambiar: () => void | Promise<void>;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [motivo, setMotivo] = useState('');
  const [elegidos, setElegidos] = useState<readonly string[]>([]);
  const { ocupado, error, ejecutar } = useEscritura(alCambiar);

  const aplicar = async (accion: AccionDePedido) => {
    if (await ejecutar(() => cambiarPedido(id, accion))) setPanel(null);
  };
  const alternar = (siguiente: Panel) => {
    if (siguiente === 'derivar' && panel !== 'derivar') setElegidos(destinatariosActuales);
    setPanel((actual) => (actual === siguiente ? null : siguiente));
  };

  if (estado === 'RESUELTO' || estado === 'CANCELADO') {
    return (
      <div className="flex flex-col gap-1.5">
        <div>
          <Boton icono={RotateCcw} disabled={ocupado} onClick={() => void aplicar({ accion: 'reabrir' })}>
            Reabrir
          </Boton>
        </div>
        <ErrorDeAccion error={error} />
      </div>
    );
  }

  const idCampo = `pedido-${id}`;
  const motivoLimpio = motivo.trim();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Boton icono={Check} disabled={ocupado} onClick={() => void aplicar({ accion: 'tildar' })}>
          Tildar
        </Boton>
        <Boton icono={CalendarClock} disabled={ocupado} aria-expanded={panel === 'reagendar'} onClick={() => alternar('reagendar')}>
          Reagendar
        </Boton>
        <Boton icono={X} disabled={ocupado} aria-expanded={panel === 'cancelar'} onClick={() => alternar('cancelar')}>
          Cancelar
        </Boton>
        <Boton icono={Share2} disabled={ocupado} aria-expanded={panel === 'derivar'} onClick={() => alternar('derivar')}>
          Derivar
        </Boton>
        {!derivadoASoporte && (
          <Boton icono={LifeBuoy} disabled={ocupado} aria-expanded={panel === 'soporte'} onClick={() => alternar('soporte')}>
            Derivar a soporte
          </Boton>
        )}
      </div>

      {panel === 'soporte' && (
        <div className="flex flex-col gap-2" role="group" aria-label="Confirmar derivación a soporte">
          <p className="text-xs text-tinta-suave">
            Queda marcado como derivado a soporte y desde esta pantalla no se puede deshacer.
          </p>
          <div className="flex gap-1.5">
            <Boton
              variante="primario"
              disabled={ocupado}
              onClick={() => void aplicar({ accion: 'derivar_a_soporte' })}
            >
              Confirmar derivación a soporte
            </Boton>
            <Boton variante="fantasma" disabled={ocupado} onClick={() => setPanel(null)}>
              Volver
            </Boton>
          </div>
        </div>
      )}

      {panel === 'reagendar' && (
        <MenuDeReagendar
          idCampo={`${idCampo}-fecha`}
          ocupado={ocupado}
          alElegir={(fecha) => void aplicar({ accion: 'reagendar', recordarEl: fecha })}
          alQuitar={recordarEl ? () => void aplicar({ accion: 'reagendar', recordarEl: null }) : undefined}
        />
      )}

      {panel === 'cancelar' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (motivoLimpio) void aplicar({ accion: 'cancelar', motivo: motivoLimpio });
          }}
        >
          <label htmlFor={`${idCampo}-motivo`} className="text-xs font-medium text-tinta-suave">
            Motivo de la cancelación
          </label>
          <textarea
            id={`${idCampo}-motivo`}
            rows={2}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded border border-borde-fuerte bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none"
          />
          <div className="flex gap-1.5">
            <Boton variante="primario" type="submit" disabled={ocupado || motivoLimpio === ''}>
              Confirmar cancelación
            </Boton>
            <Boton variante="fantasma" disabled={ocupado} onClick={() => setPanel(null)}>
              Volver
            </Boton>
          </div>
        </form>
      )}

      {panel === 'derivar' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (elegidos.length > 0) void aplicar({ accion: 'derivar', destinatarioUsuarioIds: elegidos });
          }}
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium text-tinta-suave">Derivar a</legend>
            {destinatarios.map((d) => (
              <label key={d.valor} className="flex items-center gap-2 text-sm text-tinta-suave">
                <input
                  type="checkbox"
                  checked={elegidos.includes(d.valor)}
                  onChange={(e) =>
                    setElegidos((actual) =>
                      e.target.checked ? [...actual, d.valor] : actual.filter((v) => v !== d.valor),
                    )
                  }
                />
                {d.etiqueta}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-1.5">
            <Boton variante="primario" type="submit" disabled={ocupado || elegidos.length === 0}>
              Confirmar derivación
            </Boton>
            <Boton variante="fantasma" disabled={ocupado} onClick={() => setPanel(null)}>
              Volver
            </Boton>
          </div>
        </form>
      )}

      <ErrorDeAccion error={error} />
    </div>
  );
}

/**
 * Acciones de una solicitud a un cliente: cambiar la prioridad, reagendar y
 * cerrar (el cierre a mano que ya existía, `CERRADA_MANUALMENTE`).
 */
export function AccionesDeSolicitud({
  id,
  prioridad,
  recordarEl = null,
  alCambiar,
}: {
  readonly id: string;
  readonly prioridad: Prioridad;
  /** 'AAAA-MM-DD' o null: con fecha, el menú de reagendar ofrece «Quitar recordatorio». */
  readonly recordarEl?: string | null;
  readonly alCambiar: () => void | Promise<void>;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const { ocupado, error, ejecutar } = useEscritura(alCambiar);
  const alternar = (siguiente: Panel) => setPanel((actual) => (actual === siguiente ? null : siguiente));

  return (
    <div className="flex flex-col gap-2">
      <CampoSelect
        id={`solicitud-${id}-prioridad`}
        etiqueta="Cambiar prioridad"
        opciones={OPCIONES_PRIORIDAD}
        value={prioridad}
        disabled={ocupado}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          void ejecutar(() => cambiarPrioridadDeSolicitud(id, { prioridad: e.target.value as Prioridad }))
        }
      />
      <div className="flex flex-wrap gap-1.5">
        <Boton icono={CalendarClock} disabled={ocupado} aria-expanded={panel === 'reagendar'} onClick={() => alternar('reagendar')}>
          Reagendar
        </Boton>
        <Boton icono={X} disabled={ocupado} aria-expanded={panel === 'cerrar'} onClick={() => alternar('cerrar')}>
          Cerrar
        </Boton>
      </div>

      {panel === 'reagendar' && (
        <MenuDeReagendar
          idCampo={`solicitud-${id}-fecha`}
          ocupado={ocupado}
          alElegir={(fecha) =>
            void ejecutar(() => cambiarPrioridadDeSolicitud(id, { recordarEl: fecha })).then((ok) => ok && setPanel(null))
          }
          alQuitar={
            recordarEl
              ? () => void ejecutar(() => cambiarPrioridadDeSolicitud(id, { recordarEl: null })).then((ok) => ok && setPanel(null))
              : undefined
          }
        />
      )}

      {panel === 'cerrar' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-tinta-suave">
            Queda «Cerrada a mano» y deja de contar como pendiente.
          </p>
          <div className="flex gap-1.5">
            <Boton
              variante="primario"
              disabled={ocupado}
              onClick={() => void ejecutar(() => cerrarSolicitud(id, 'CERRADA_MANUALMENTE'))}
            >
              Confirmar cierre
            </Boton>
            <Boton variante="fantasma" disabled={ocupado} onClick={() => setPanel(null)}>
              Volver
            </Boton>
          </div>
        </div>
      )}

      <ErrorDeAccion error={error} />
    </div>
  );
}
