/**
 * «No aplica»: decir que una obligación no le corresponde a ese cliente en ese
 * período, con el motivo escrito.
 *
 * El caso que lo trajo (2026-11-12): los anticipos de IRE. La planilla de EFFORT
 * avisa que «depende de la liquidación del IRE para quedar o no obligado a
 * pagar», y hasta hoy la única salida era «Presentar» algo que nunca se
 * presentó o dejarlo vencido para siempre.
 *
 * Es un formulario de la pantalla y no un `window.prompt`, por lo mismo que la
 * prórroga: se puede probar, y da lugar a explicar la consecuencia antes de
 * aceptar — el vencimiento deja de aparecer en el radar y en las alertas. Por
 * eso el motivo es obligatorio: es lo único que queda para saber por qué una
 * fila dejó de verse (se guarda en los eventos del cliente).
 */

import { useState, type FormEvent } from 'react';

import { Boton, CampoTexto } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { marcarNoAplica } from '../api/vencimientos.js';

/** El mismo mínimo que exige el servidor (`noAplicaSchema`). */
const LARGO_MINIMO_DEL_MOTIVO = 5;

export function DialogoDeNoAplica({
  vencimiento,
  cliente,
  alCerrar,
  alAplicar,
}: {
  readonly vencimiento: { readonly id: string; readonly descripcion: string; readonly fechaVencimiento: string };
  readonly cliente: string;
  readonly alCerrar: () => void;
  /** Se llama después de aplicar, para que la pantalla recargue sus datos. */
  readonly alAplicar: () => void | Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (motivo.trim().length < LARGO_MINIMO_DEL_MOTIVO) {
      setError('Escribí por qué no corresponde, por ejemplo «El IRE 2025 no dejó impuesto: sin anticipo».');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await marcarNoAplica(vencimiento.id, motivo.trim());
      await alAplicar();
      alCerrar();
    } catch (motivoDelError) {
      setError(
        motivoDelError instanceof ErrorDeApi ? motivoDelError.message : 'No se pudo conectar con el servidor.',
      );
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/30 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`No aplica: ${vencimiento.descripcion}`}
        onSubmit={(e) => void enviar(e)}
        className="w-full max-w-lg rounded border border-borde-fuerte bg-superficie p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold">Este vencimiento no corresponde</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {cliente} · {vencimiento.descripcion} · vence el {vencimiento.fechaVencimiento}.
        </p>
        <p className="mt-3 rounded border border-parcial-borde bg-parcial-fondo px-3 py-2 text-sm text-parcial">
          Va a dejar de aparecer en Vencimientos y en las alertas. Usalo solo si a este cliente no le
          corresponde presentarlo ni pagarlo; si ya se presentó, usá «Presentar».
        </p>

        <div className="mt-4">
          <CampoTexto
            id="noAplicaMotivo"
            etiqueta="Por qué no corresponde"
            placeholder="El IRE 2025 no dejó impuesto: sin anticipo"
            value={motivo}
            autoFocus
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMotivo(e.target.value)}
          />
          <p className="mt-1 text-xs text-tinta-tenue">Queda guardado en los eventos del cliente, con tu nombre y la fecha.</p>
        </div>

        {error && (
          <p className="mt-3 text-sm text-critico" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="secundario" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Marcar «No aplica»'}
          </Boton>
        </div>
      </form>
    </div>
  );
}
