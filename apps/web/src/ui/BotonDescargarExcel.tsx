/**
 * «Descargar Excel»: el mismo botón en todas las pantallas (ver `reporteExcel.ts`).
 *
 * Recibe una función y no el reporte armado: armarlo recorre todas las filas,
 * y no tiene sentido hacerlo en cada dibujo de la pantalla si casi nunca se
 * aprieta.
 */

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

import { Boton } from './Primitivos.jsx';
import { DatosTodaviaCargando, descargarReporte, type Reporte } from './reporteExcel.js';

export function BotonDescargarExcel({
  reporte,
  detalleDelNombre = null,
}: {
  readonly reporte: () => Reporte;
  /** Lo que se agrega al nombre del archivo, p. ej. el cliente elegido. */
  readonly detalleDelNombre?: string | null;
}) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setDescargando(true);
    setError(null);
    try {
      await descargarReporte(reporte(), detalleDelNombre);
    } catch (motivo) {
      setError(
        motivo instanceof DatosTodaviaCargando
          ? 'La pantalla todavía está cargando: esperá un momento y volvé a apretar.'
          : 'No se pudo armar el Excel. Probá de nuevo.',
      );
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Boton variante="secundario" icono={FileSpreadsheet} onClick={() => void descargar()} disabled={descargando}>
        {descargando ? 'Armando el Excel…' : 'Descargar Excel'}
      </Boton>
      {error && (
        <p className="text-xs text-critico" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
