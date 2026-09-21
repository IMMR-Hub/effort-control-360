/**
 * Lo ya presentado, con los días de atraso.
 *
 * El radar muestra lo que falta; esto muestra lo que se hizo, y cuándo. Existe
 * porque el sistema ahora marca presentaciones solo, leyendo las declaraciones
 * de la DNIT en OneDrive, y una marca automática tiene que poder verse y
 * revisarse.
 *
 * Daniel, 2026-09-15: *"no hace falta que pongas que tiene multa, sino solamente
 * los días de atraso"*. Por eso la columna dice días y nada más.
 */

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';

import { dentroDelRango, type RangoDeFechas } from '@effort/core';

import { Badge, Boton, EncabezadoTarjeta, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import type { Cliente } from '../api/clientes.js';
import { listarPresentados, type VencimientoPresentado } from '../api/vencimientos.js';
import { obtenerEnlaceDeEvidencia } from '../api/onedrive.js';
import { pedirProrroga } from './pedirProrroga.js';

/**
 * Abre la declaración que prueba la presentación.
 *
 * La pestaña se abre ANTES de pedir el enlace y después se le cambia la
 * dirección: si se abriera después de esperar al servidor, el navegador la
 * trataría como una ventana emergente y la bloquearía.
 */
async function abrirDeclaracion(evidenciaId: string, alFallar: (mensaje: string) => void) {
  const pestana = window.open('about:blank', '_blank');
  try {
    const { url } = await obtenerEnlaceDeEvidencia(evidenciaId);
    if (pestana) {
      pestana.opener = null;
      pestana.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (motivo) {
    pestana?.close();
    alFallar(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo abrir la declaración.');
  }
}

export default function VencimientosPresentados({
  clientes,
  rango = null,
  puedeEditar = false,
}: {
  readonly clientes: readonly Cliente[];
  /** Muestra «Prórroga»: la DNIT corre plazos de lo ya presentado también. */
  readonly puedeEditar?: boolean;
  /** Filtra por fecha de presentación. `null` = todas. */
  readonly rango?: RangoDeFechas | null;
}) {
  const [todos, setPresentados] = useState<readonly VencimientoPresentado[]>([]);
  const presentados = todos.filter((p) => dentroDelRango(p.fechaPresentacion, rango));
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(
    () =>
      listarPresentados()
        .then(({ presentados: lista }) => {
          setPresentados(lista);
          setCargando(false);
        })
        .catch((motivo) => {
          setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
          setCargando(false);
        }),
    [],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function manejarProrroga(p: VencimientoPresentado) {
    try {
      if (await pedirProrroga(p)) await cargar();
    } catch (motivo) {
      setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
    }
  }

  const nombre = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? '—';
  const conAtraso = presentados.filter((p) => p.diasDeAtraso > 0).length;

  return (
    <Tarjeta>
      <EncabezadoTarjeta
        titulo="Presentados"
        descripcion={
          presentados.length === 0
            ? 'Obligaciones ya presentadas, con la fecha de presentación.'
            : `${presentados.length} presentadas · ${conAtraso} con días de atraso.`
        }
      />

      {error && (
        <p className="px-5 pb-4 text-sm text-critico" role="alert">
          {error}
        </p>
      )}

      {presentados.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-tinta-tenue">
          {cargando ? 'Cargando…' : 'Todavía no hay presentaciones registradas.'}
        </p>
      ) : (
        <Tabla etiqueta="Vencimientos presentados">
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Obligación</Th>
              <Th>Vencía</Th>
              <Th>Presentado</Th>
              <Th numerica>Días de atraso</Th>
              <Th>Prueba</Th>
              {puedeEditar && <Th>Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {presentados.map((p) => (
              <tr key={p.id}>
                <Td>{nombre(p.clienteId)}</Td>
                <Td>{p.descripcion}</Td>
                <Td>
                  {p.fechaVencimiento}
                  {p.fechaVencimientoOriginal && (
                    <span className="mt-0.5 block text-[11px] font-normal text-tinta-tenue">
                      prorrogado del {p.fechaVencimientoOriginal}
                      {p.motivoProrroga ? ` — ${p.motivoProrroga}` : ''}
                    </span>
                  )}
                </Td>
                <Td>{p.fechaPresentacion ?? '—'}</Td>
                <Td numerica>
                  {p.diasDeAtraso === 0 ? (
                    <Badge tono="completo">A tiempo</Badge>
                  ) : (
                    <span
                      title={
                        p.fechaAproximada
                          ? 'La prueba es un aviso de Marangatú impreso: la fecha es la de impresión, así que el atraso real puede ser menor.'
                          : undefined
                      }
                    >
                      <Badge tono="parcial">
                        {p.fechaAproximada ? 'hasta ' : ''}
                        {p.diasDeAtraso} {p.diasDeAtraso === 1 ? 'día' : 'días'}
                      </Badge>
                    </span>
                  )}
                </Td>
                <Td>
                  {p.evidenciaId ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-marca-600 underline"
                      onClick={() => void abrirDeclaracion(p.evidenciaId!, setError)}
                    >
                      Ver declaración
                    </button>
                  ) : (
                    <span className="text-xs text-tinta-tenue">Cargada a mano</span>
                  )}
                </Td>
                {puedeEditar && (
                  <Td>
                    <Boton
                      variante="fantasma"
                      icono={CalendarClock}
                      aria-label={`Prorrogar: ${p.descripcion}`}
                      onClick={() => void manejarProrroga(p)}
                    >
                      Prórroga
                    </Boton>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Tarjeta>
  );
}
