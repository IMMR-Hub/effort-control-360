/**
 * Prórroga: formulario de la pantalla, no un cuadro del navegador.
 *
 * Hasta el 2026-09-22 esto era `window.prompt`. Dos motivos para cambiarlo, los
 * dos de Daniel: *"cuando acepten serán más de 140 adicionales y no quiero
 * estar perdiendo minutos con cada uno"*, y que un prompt del navegador no se
 * puede probar ni automatizar (ya estaba anotado como trampa en `CLAUDE.md`).
 *
 * La pieza que hace el trabajo no es el formulario: es la casilla **«aplicar a
 * todos»**. Una resolución de la DNIT no corre el plazo de un contribuyente,
 * lo corre para todos los de un régimen — así que la unidad natural es la
 * obligación entera, y con 145 clientes esa es la diferencia entre un clic y
 * doscientos noventa.
 *
 * El alcance se consulta al abrir, en modo `simulacion`, que no escribe nada:
 * marcar una casilla que va a tocar toda la cartera sin ver cuántas filas son
 * es exactamente la clase de decisión a ciegas que este sistema evita.
 */

import { useEffect, useState, type FormEvent } from 'react';

import { Boton, CampoTexto } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import { prorrogar, prorrogarLote } from '../api/vencimientos.js';

/** Lo mínimo que el formulario necesita, que el radar y Presentados comparten. */
export interface VencimientoProrrogable {
  readonly id: string;
  readonly descripcion: string;
  readonly fechaVencimiento: string;
  readonly motivoProrroga?: string | null;
}

export function DialogoDeProrroga({
  vencimiento,
  alCerrar,
  alAplicar,
}: {
  readonly vencimiento: VencimientoProrrogable;
  readonly alCerrar: () => void;
  /** Se llama después de aplicar, para que la pantalla recargue sus datos. */
  readonly alAplicar: () => void | Promise<void>;
}) {
  const [nuevaFecha, setNuevaFecha] = useState(vencimiento.fechaVencimiento);
  const [motivo, setMotivo] = useState(vencimiento.motivoProrroga ?? '');
  const [aTodos, setATodos] = useState(false);
  const [alcance, setAlcance] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modo simulación: no escribe. Si falla, no se bloquea el formulario — se
  // pierde el conteo y la casilla queda sin ofrecer, que es el lado seguro.
  useEffect(() => {
    let vigente = true;
    prorrogarLote(vencimiento.descripcion, vencimiento.fechaVencimiento, null, 'simulacion')
      .then((resumen) => {
        if (vigente) setAlcance(resumen.alcanzados.length);
      })
      .catch(() => {
        if (vigente) setAlcance(null);
      });
    return () => {
      vigente = false;
    };
  }, [vencimiento.descripcion, vencimiento.fechaVencimiento]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!motivo.trim()) {
      setError('Poné la resolución que dispone la prórroga, por ejemplo "RG 50/2026".');
      return;
    }
    if (!nuevaFecha.trim()) {
      setError('Falta la fecha nueva.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      if (aTodos) {
        await prorrogarLote(vencimiento.descripcion, nuevaFecha.trim(), motivo.trim(), 'real');
      } else {
        await prorrogar(vencimiento.id, nuevaFecha.trim(), motivo.trim());
      }
      await alAplicar();
      alCerrar();
    } catch (motivoDelError) {
      setError(
        motivoDelError instanceof ErrorDeApi
          ? motivoDelError.message
          : 'No se pudo conectar con el servidor.',
      );
      setGuardando(false);
    }
  }

  const varios = alcance !== null && alcance > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/30 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Prorrogar: ${vencimiento.descripcion}`}
        onSubmit={(e) => void enviar(e)}
        className="w-full max-w-lg rounded border border-borde-fuerte bg-superficie p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold">Prorrogar un vencimiento</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {vencimiento.descripcion} · hoy vence el {vencimiento.fechaVencimiento}.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <CampoTexto
            id="prorrogaFecha"
            etiqueta="Nueva fecha de vencimiento"
            type="date"
            value={nuevaFecha}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaFecha(e.target.value)}
          />
          <CampoTexto
            id="prorrogaMotivo"
            etiqueta="Resolución que la dispone"
            placeholder="RG 50/2026"
            value={motivo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMotivo(e.target.value)}
          />

          {alcance !== null && (
            <p className="text-xs text-tinta-tenue">
              Esta obligación alcanza a {alcance} {alcance === 1 ? 'vencimiento' : 'vencimientos'} de
              la cartera.
            </p>
          )}

          {varios && (
            <label className="flex items-start gap-2 rounded border border-borde-marca bg-superficie-tenue px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={aTodos}
                onChange={(e) => setATodos(e.target.checked)}
              />
              <span>
                Aplicar a los {alcance} de esta misma obligación y período
                <span className="mt-0.5 block text-xs text-tinta-tenue">
                  Cada uno conserva la fecha que le fijaba su propio calendario. Los que ya estén en
                  la fecha nueva se saltan, así que se puede repetir sin miedo.
                </span>
              </span>
            </label>
          )}
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
            {guardando ? 'Aplicando…' : 'Aplicar la prórroga'}
          </Boton>
        </div>
      </form>
    </div>
  );
}
