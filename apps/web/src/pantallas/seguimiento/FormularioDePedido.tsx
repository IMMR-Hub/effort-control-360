/**
 * «Nuevo pedido»: lo carga Laura o Lili cuando un colaborador les pide algo por
 * correo, WhatsApp o llamada (diseño §5.1). El texto del pedido es dato: se
 * guarda tal cual, nada lo interpreta.
 */

import { useMemo, useState, type FormEvent } from 'react';

import { Boton, CampoSelect, CampoTexto } from '../../ui/Primitivos.jsx';
import type { Cliente } from '../../api/clientes.js';
import { crearPedido, type CanalDePedido, type PedidoDelEquipo, type Prioridad } from '../../api/seguimiento.js';
import type { Usuario } from '../../api/usuarios.js';
import {
  OPCIONES_CANAL,
  OPCIONES_PRIORIDAD,
  destinatariosPosibles,
  horaDeParaguayParaCampo,
  instanteDesdeHoraDeParaguay,
  mensajeDeError,
  nombreDeUsuario,
} from './comun.js';

const CLASE_AREA =
  'rounded border border-borde-fuerte bg-superficie px-3 py-1.5 text-sm text-tinta focus-visible:outline-none';

export function FormularioDePedido({
  usuarios,
  clientes,
  usuarioActualId,
  alCancelar,
  alCrear,
}: {
  readonly usuarios: readonly Usuario[];
  readonly clientes: readonly Cliente[];
  /** Quien lo carga: si es de dirección, queda marcada en «Para». */
  readonly usuarioActualId: string | null;
  readonly alCancelar: () => void;
  readonly alCrear: (pedido: PedidoDelEquipo) => void | Promise<void>;
}) {
  const solicitantes = useMemo(
    () =>
      usuarios
        .filter((u) => u.activo)
        .map((u) => ({ valor: u.id, etiqueta: nombreDeUsuario(u) }))
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
    [usuarios],
  );
  const destinatarios = useMemo(() => destinatariosPosibles(usuarios), [usuarios]);
  const opcionesDeCliente = useMemo(
    () => [
      { valor: '', etiqueta: 'Ninguno' },
      ...clientes.filter((c) => c.activo).map((c) => ({ valor: c.id, etiqueta: c.nombre })),
    ],
    [clientes],
  );

  const [de, setDe] = useState('');
  const [para, setPara] = useState<readonly string[]>(() =>
    usuarioActualId && destinatarios.some((d) => d.valor === usuarioActualId) ? [usuarioActualId] : [],
  );
  const [canal, setCanal] = useState<CanalDePedido>('LLAMADA');
  const [cuando, setCuando] = useState(() => horaDeParaguayParaCampo(new Date()));
  const [clienteId, setClienteId] = useState('');
  const [asunto, setAsunto] = useState('');
  const [texto, setTexto] = useState('');
  const [prioridad, setPrioridad] = useState<Prioridad>('MEDIA');
  const [recordarEl, setRecordarEl] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completo = de !== '' && para.length > 0 && cuando !== '' && asunto.trim() !== '' && texto.trim() !== '';

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!completo) return;
    setGuardando(true);
    setError(null);
    try {
      const { pedido } = await crearPedido({
        solicitanteUsuarioId: de,
        destinatarioUsuarioIds: para,
        clienteId: clienteId === '' ? null : clienteId,
        asunto: asunto.trim(),
        prioridad,
        recordarEl: recordarEl === '' ? null : recordarEl,
        canal,
        ocurridoEn: instanteDesdeHoraDeParaguay(cuando),
        texto: texto.trim(),
      });
      await alCrear(pedido);
    } catch (motivo) {
      setError(mensajeDeError(motivo));
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={(e) => void guardar(e)} className="space-y-4 border-b border-borde px-5 py-4" aria-label="Nuevo pedido">
      {error && (
        <p role="alert" className="rounded border border-critico-borde bg-critico-fondo px-3 py-2 text-sm text-critico">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CampoSelect
          id="pedidoDe"
          etiqueta="De"
          placeholder="Elegí quién lo pidió"
          opciones={solicitantes}
          value={de}
          required
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDe(e.target.value)}
        />
        <CampoSelect
          id="pedidoVia"
          etiqueta="Vía"
          opciones={OPCIONES_CANAL}
          value={canal}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCanal(e.target.value as CanalDePedido)}
        />
        <CampoTexto
          id="pedidoCuando"
          etiqueta="Cuándo llegó"
          type="datetime-local"
          required
          value={cuando}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCuando(e.target.value)}
        />
        <CampoSelect
          id="pedidoCliente"
          etiqueta="Cliente relacionado (opcional)"
          opciones={opcionesDeCliente}
          value={clienteId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClienteId(e.target.value)}
        />
        <CampoSelect
          id="pedidoPrioridad"
          etiqueta="Prioridad"
          opciones={OPCIONES_PRIORIDAD}
          value={prioridad}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPrioridad(e.target.value as Prioridad)}
        />
        <CampoTexto
          id="pedidoRecordarEl"
          etiqueta="Recordar el (opcional)"
          type="date"
          value={recordarEl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecordarEl(e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-tinta-suave">Para</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {destinatarios.map((d) => (
            <label key={d.valor} className="flex items-center gap-2 text-sm text-tinta-suave">
              <input
                type="checkbox"
                checked={para.includes(d.valor)}
                onChange={(e) =>
                  setPara((actual) => (e.target.checked ? [...actual, d.valor] : actual.filter((v) => v !== d.valor)))
                }
              />
              {d.etiqueta}
            </label>
          ))}
        </div>
      </fieldset>

      <CampoTexto
        id="pedidoAsunto"
        etiqueta="Asunto"
        maxLength={200}
        required
        value={asunto}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAsunto(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pedidoTexto" className="text-xs font-medium text-tinta-suave">
          Texto del pedido
        </label>
        <textarea
          id="pedidoTexto"
          rows={3}
          maxLength={4000}
          required
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={CLASE_AREA}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" disabled={guardando} onClick={alCancelar}>
          Descartar
        </Boton>
        <Boton variante="primario" type="submit" disabled={guardando || !completo}>
          {guardando ? 'Guardando…' : 'Guardar pedido'}
        </Boton>
      </div>
    </form>
  );
}
