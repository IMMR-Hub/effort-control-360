/**
 * Detalle de un pedido del equipo: sus datos y la conversación en orden
 * cronológico (diseño §5.1).
 *
 * Un mensaje no se edita ni se borra (REGLA 0): «Corregir» agrega uno nuevo que
 * lo reemplaza, y el viejo queda a la vista marcado como corregido. Las notas
 * internas llevan su marca; a quien no es de dirección el servidor ni se las
 * manda, así que acá no hay nada que esconder.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageSquarePlus } from 'lucide-react';

import { Badge, Boton, CampoSelect, CampoTexto, EncabezadoTarjeta, Tarjeta } from '../../ui/Primitivos.jsx';
import type { Cliente } from '../../api/clientes.js';
import {
  agregarMensaje,
  cambiarPedido,
  corregirMensaje,
  obtenerPedido,
  type CanalDePedido,
  type MensajeDePedido,
  type PedidoDelEquipo,
  type Prioridad,
} from '../../api/seguimiento.js';
import type { Usuario } from '../../api/usuarios.js';
import {
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_PRIORIDAD,
  OPCIONES_CANAL,
  OPCIONES_PRIORIDAD,
  formatearFechaHora,
  horaDeParaguayParaCampo,
  instanteDesdeHoraDeParaguay,
  mensajeDeError,
  nombreDeUsuario,
} from './comun.js';

/** `null` = mensaje nuevo; si no, el mensaje que se corrige. */
type Edicion = { readonly corrige: MensajeDePedido | null } | null;

function FormularioDeMensaje({
  pedido,
  corrige,
  autores,
  canalSugerido,
  alCancelar,
  alGuardar,
}: {
  readonly pedido: PedidoDelEquipo;
  readonly corrige: MensajeDePedido | null;
  readonly autores: readonly { valor: string; etiqueta: string }[];
  readonly canalSugerido: CanalDePedido;
  readonly alCancelar: () => void;
  readonly alGuardar: () => void | Promise<void>;
}) {
  const [autor, setAutor] = useState(corrige?.autorUsuarioId ?? pedido.solicitanteUsuarioId);
  const [canal, setCanal] = useState<CanalDePedido>(corrige?.canal ?? canalSugerido);
  const [cuando, setCuando] = useState(() => horaDeParaguayParaCampo(corrige ? new Date(corrige.ocurridoEn) : new Date()));
  const [texto, setTexto] = useState(corrige?.texto ?? '');
  const [notaInterna, setNotaInterna] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (texto.trim() === '' || cuando === '') return;
    setGuardando(true);
    setError(null);
    const datos = {
      autorUsuarioId: autor,
      canal,
      ocurridoEn: instanteDesdeHoraDeParaguay(cuando),
      texto: texto.trim(),
    };
    try {
      if (corrige) {
        await corregirMensaje(corrige.id, pedido.id, datos);
      } else {
        await agregarMensaje(pedido.id, { ...datos, notaInterna });
      }
      await alGuardar();
    } catch (motivo) {
      setError(mensajeDeError(motivo));
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void guardar(e)}
      className="space-y-4 border-b border-borde px-5 py-4"
      aria-label={corrige ? 'Corregir mensaje' : 'Agregar mensaje'}
    >
      {error && (
        <p role="alert" className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
          {error}
        </p>
      )}
      {corrige && (
        <p className="text-xs text-tinta-tenue">
          El mensaje original no se borra: queda a la vista, marcado como corregido.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoSelect
          id="mensajeAutor"
          etiqueta="Autor"
          opciones={[...autores]}
          value={autor}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAutor(e.target.value)}
        />
        <CampoSelect
          id="mensajeVia"
          etiqueta="Vía"
          opciones={OPCIONES_CANAL}
          value={canal}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCanal(e.target.value as CanalDePedido)}
        />
        <CampoTexto
          id="mensajeCuando"
          etiqueta="Cuándo"
          type="datetime-local"
          required
          value={cuando}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCuando(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mensajeTexto" className="text-xs font-medium text-tinta-suave">
          Texto
        </label>
        <textarea
          id="mensajeTexto"
          rows={3}
          maxLength={4000}
          required
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="rounded border border-borde-fuerte bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none"
        />
      </div>
      {!corrige && (
        <div>
          <label className="flex items-center gap-2 text-sm text-tinta-suave">
            <input
              type="checkbox"
              checked={notaInterna}
              aria-describedby="mensajeNotaInternaAyuda"
              onChange={(e) => setNotaInterna(e.target.checked)}
            />
            Nota interna
          </label>
          <p id="mensajeNotaInternaAyuda" className="mt-0.5 pl-6 text-xs text-tinta-tenue">
            Solo la ve dirección; el colaborador nunca la recibe.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" disabled={guardando} onClick={alCancelar}>
          Descartar
        </Boton>
        <Boton variante="primario" type="submit" disabled={guardando || texto.trim() === ''}>
          {guardando ? 'Guardando…' : corrige ? 'Guardar corrección' : 'Guardar mensaje'}
        </Boton>
      </div>
    </form>
  );
}

export function DetalleDePedido({
  pedidoId,
  version,
  puedeEscribir,
  usuarios,
  clientes,
  alCambiar,
}: {
  readonly pedidoId: string;
  /** Cambia cada vez que la pantalla recarga: el detalle se vuelve a pedir. */
  readonly version: number;
  readonly puedeEscribir: boolean;
  readonly usuarios: readonly Usuario[];
  readonly clientes: readonly Cliente[];
  readonly alCambiar: () => void;
}) {
  const [datos, setDatos] = useState<{ pedido: PedidoDelEquipo; mensajes: readonly MensajeDePedido[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [errorDeCambio, setErrorDeCambio] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerPedido(pedidoId)
      .then((respuesta) => {
        if (!vigente) return;
        setDatos(respuesta);
        setError(null);
      })
      .catch((motivo: unknown) => {
        if (vigente) setError(mensajeDeError(motivo));
      });
    return () => {
      vigente = false;
    };
  }, [pedidoId, version]);

  const autores = useMemo(() => {
    if (!datos) return [];
    const solicitante = { valor: datos.pedido.solicitanteUsuarioId, etiqueta: datos.pedido.solicitanteNombre };
    const deDireccion = usuarios
      .filter((u) => u.activo && u.rol === 'direccion' && u.id !== solicitante.valor)
      .map((u) => ({ valor: u.id, etiqueta: nombreDeUsuario(u) }));
    return [solicitante, ...deDireccion];
  }, [datos, usuarios]);

  if (error && !datos) {
    return (
      <Tarjeta>
        <p className="px-5 py-8 text-center text-sm text-critico">{error}</p>
      </Tarjeta>
    );
  }
  if (!datos || datos.pedido.id !== pedidoId) {
    return (
      <Tarjeta>
        <p className="px-5 py-8 text-center text-sm text-tinta-tenue">Cargando el pedido…</p>
      </Tarjeta>
    );
  }

  const { pedido, mensajes } = datos;
  const abierto = pedido.estado === 'ABIERTO' || pedido.estado === 'EN_CURSO';
  const estado = ETIQUETA_ESTADO_PEDIDO[pedido.estado];
  const prioridad = ETIQUETA_PRIORIDAD[pedido.prioridad];
  const cliente = pedido.clienteId ? clientes.find((c) => c.id === pedido.clienteId)?.nombre : null;
  const correcciones = new Set(mensajes.map((m) => m.corregidoPorId).filter((id): id is string => id !== null));

  async function cambiar(escribir: () => Promise<unknown>) {
    setErrorDeCambio(null);
    try {
      await escribir();
      alCambiar();
    } catch (motivo) {
      setErrorDeCambio(mensajeDeError(motivo));
    }
  }

  const ultimoCanal = mensajes[mensajes.length - 1]?.canal ?? 'LLAMADA';

  return (
    <Tarjeta>
      <EncabezadoTarjeta
        titulo={pedido.asunto}
        descripcion={`De ${pedido.solicitanteNombre} · Para ${pedido.destinatarioNombres.join(', ')} · cargado el ${formatearFechaHora(pedido.creadoEn)}${
          cliente ? ` · cliente: ${cliente}` : ''
        }`}
        acciones={
          puedeEscribir &&
          abierto && (
            <Boton variante="primario" icono={MessageSquarePlus} onClick={() => setEdicion({ corrige: null })}>
              Agregar mensaje
            </Boton>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-3 border-b border-borde px-5 py-3">
        <Badge tono={estado.tono}>{estado.texto}</Badge>
        <Badge tono={prioridad.tono} conIcono={false}>Prioridad {prioridad.texto.toLowerCase()}</Badge>
        {pedido.recordarEl && <Badge tono="pendiente" conIcono={false}>Recordar el {pedido.recordarEl}</Badge>}
        {pedido.derivadoASoporte && <Badge tono="proceso" conIcono={false}>Derivado a soporte</Badge>}
        {puedeEscribir && abierto && (
          <>
            <CampoSelect
              id={`prioridad-${pedido.id}`}
              etiqueta="Prioridad"
              opciones={OPCIONES_PRIORIDAD}
              value={pedido.prioridad}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                void cambiar(() =>
                  cambiarPedido(pedido.id, { accion: 'prioridad', prioridad: e.target.value as Prioridad }),
                )
              }
            />
            {pedido.estado === 'ABIERTO' && (
              <Boton onClick={() => void cambiar(() => cambiarPedido(pedido.id, { accion: 'en_curso' }))}>
                Marcar en curso
              </Boton>
            )}
          </>
        )}
      </div>
      {pedido.motivoDeCancelacion && (
        <p className="border-b border-borde px-5 py-2 text-sm text-tinta-suave">
          Motivo de la cancelación: {pedido.motivoDeCancelacion}
        </p>
      )}
      {errorDeCambio && <p className="border-b border-borde px-5 py-2 text-sm text-critico">{errorDeCambio}</p>}

      {puedeEscribir && edicion && (
        <FormularioDeMensaje
          key={edicion.corrige?.id ?? 'nuevo'}
          pedido={pedido}
          corrige={edicion.corrige}
          autores={autores}
          canalSugerido={ultimoCanal}
          alCancelar={() => setEdicion(null)}
          alGuardar={() => {
            setEdicion(null);
            alCambiar();
          }}
        />
      )}

      <ol className="divide-y divide-borde" aria-label="Conversación del pedido">
        {mensajes.map((mensaje) => {
          const fueCorregido = mensaje.corregidoPorId !== null;
          return (
            <li key={mensaje.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{mensaje.autorNombre}</span>
                <span className="text-xs text-tinta-tenue">
                  {mensaje.canal.charAt(0) + mensaje.canal.slice(1).toLowerCase()} · {formatearFechaHora(mensaje.ocurridoEn)}
                </span>
                {mensaje.notaInterna && <Badge tono="parcial">Nota interna</Badge>}
                {fueCorregido && <Badge tono="pendiente" conIcono={false}>Corregido</Badge>}
                {correcciones.has(mensaje.id) && <Badge tono="proceso" conIcono={false}>Corrección</Badge>}
                {puedeEscribir && abierto && !fueCorregido && (
                  <Boton variante="fantasma" className="ml-auto" onClick={() => setEdicion({ corrige: mensaje })}>
                    Corregir
                  </Boton>
                )}
              </div>
              <p
                className={`mt-1 whitespace-pre-wrap text-sm ${fueCorregido ? 'text-tinta-tenue line-through' : 'text-tinta-suave'}`}
              >
                {mensaje.texto}
              </p>
            </li>
          );
        })}
        {mensajes.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-tinta-tenue">Este pedido todavía no tiene mensajes.</li>
        )}
      </ol>
    </Tarjeta>
  );
}
