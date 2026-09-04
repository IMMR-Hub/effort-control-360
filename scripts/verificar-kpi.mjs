#!/usr/bin/env node
/**
 * Verifica la regla 6 de `CLAUDE.md`: "Ninguna cifra de la interfaz está
 * escrita a mano. Toda sale de un cálculo sobre datos importados."
 *
 * No es un chequeo genérico de "ningún número en el código" — eso incluiría
 * tamaños de ícono (`size={14}`), límites de validación (`max={20}`),
 * cantidades de paginación, índices, etc., que no son cifras de negocio y
 * generarían tanto ruido que nadie le haría caso al check.
 *
 * En cambio, apunta a un solo lugar concreto: el primitivo `Indicador`
 * (`apps/web/src/ui/Primitivos.jsx`) es el componente que dibuja las cifras
 * de negocio en cada pantalla ("Vencidos: 5", "Clientes activos: 12", etc.).
 * Si su prop `valor` es un número literal en vez de una expresión que lee de
 * `useState`/props, esa cifra está escrita a mano — exactamente lo que la
 * regla prohíbe. Revisa todos los `.tsx` bajo `apps/web/src/pantallas/`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const carpetaPantallas = join(raiz, 'apps/web/src/pantallas');

/** Un literal numérico puro (con o sin decimales, con o sin signo). */
const NUMERO_LITERAL = /^-?\d+(\.\d+)?$/;

function listarArchivosTsx(carpeta) {
  const resultado = [];
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      resultado.push(...listarArchivosTsx(ruta));
    } else if (nombre.endsWith('.tsx')) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

/**
 * Encuentra cada `valor={...}` del archivo y devuelve las violaciones: casos
 * donde el contenido entero de las llaves es un número literal. El prop
 * `valor` de `Indicador` nunca anida llaves en el código real (identificador,
 * acceso a propiedad, resta, o un ternario con strings) — capturar hasta la
 * primera `}` alcanza sin necesitar un parser de JSX completo.
 */
function encontrarViolaciones(contenido, rutaRelativa) {
  const violaciones = [];
  const patron = /valor=\{([^}]*)\}/g;
  let coincidencia;

  while ((coincidencia = patron.exec(contenido)) !== null) {
    const expresion = coincidencia[1].trim();
    if (NUMERO_LITERAL.test(expresion)) {
      const numeroDeLinea = contenido.slice(0, coincidencia.index).split('\n').length;
      violaciones.push({ archivo: rutaRelativa, linea: numeroDeLinea, valor: expresion });
    }
  }

  return violaciones;
}

function main() {
  const archivos = listarArchivosTsx(carpetaPantallas);
  const violaciones = [];

  for (const ruta of archivos) {
    const contenido = readFileSync(ruta, 'utf8');
    const rutaRelativa = relative(raiz, ruta).replace(/\\/g, '/');
    violaciones.push(...encontrarViolaciones(contenido, rutaRelativa));
  }

  if (violaciones.length > 0) {
    console.error('Cifras de KPI escritas a mano (violación de CLAUDE.md, regla 6):\n');
    for (const v of violaciones) {
      console.error(`  ${v.archivo}:${v.linea} — valor={${v.valor}}`);
    }
    console.error(
      `\n${violaciones.length} violación(es) en ${archivos.length} archivos revisados. ` +
        'El prop "valor" de <Indicador> tiene que venir de un cálculo sobre datos reales, no de un número escrito a mano.',
    );
    process.exit(1);
  }

  console.log(`OK — ${archivos.length} pantallas revisadas, ninguna cifra de KPI escrita a mano.`);
  process.exit(0);
}

main();
