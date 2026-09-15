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

import { useEffect, useState } from 'react';

import { Badge, EncabezadoTarjeta, Tabla, Tarjeta, Td, Th } from '../ui/Primitivos.jsx';
import { ErrorDeApi } from '../api/cliente.js';
import type { Cliente } from '../api/clientes.js';
import { listarPresentados, type VencimientoPresentado } from '../api/vencimientos.js';

export default function VencimientosPresentados({ clientes }: { readonly clientes: readonly Cliente[] }) {
  const [presentados, setPresentados] = useState<readonly VencimientoPresentado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    listarPresentados()
      .then(({ presentados: lista }) => {
        if (!vigente) return;
        setPresentados(lista);
        setCargando(false);
      })
      .catch((motivo) => {
        if (!vigente) return;
        setError(motivo instanceof ErrorDeApi ? motivo.message : 'No se pudo conectar con el servidor.');
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

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
            </tr>
          </thead>
          <tbody>
            {presentados.map((p) => (
              <tr key={p.id}>
                <Td>{nombre(p.clienteId)}</Td>
                <Td>{p.descripcion}</Td>
                <Td>{p.fechaVencimiento}</Td>
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
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Tarjeta>
  );
}
