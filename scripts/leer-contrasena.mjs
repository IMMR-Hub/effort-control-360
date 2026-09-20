/**
 * Lee una contraseña desde la terminal sin mostrarla.
 *
 * Existe porque la forma "obvia" —`readline` con `_writeToOutput` pisado— **no
 * funciona en PowerShell**: el 2026-09-20 Daniel corrió `crear-equipo.mjs` en
 * Windows y las dos preguntas se resolvieron solas con la cadena vacía, sin
 * dejarlo escribir. El script abortó con "tiene que tener al menos 12
 * caracteres" sin que hubiera tecleado nada.
 *
 * La causa es que `_writeToOutput` es API privada de Node y depende de cómo la
 * interfaz decide repintar la línea; en la consola de Windows esa suposición no
 * se cumple. Acá se lee la entrada cruda directamente, que es lo que hacen las
 * herramientas que piden contraseñas de verdad, y no depende de nada privado.
 *
 * Se muestra un asterisco por carácter. Revela el largo, sí, pero solo en la
 * pantalla de quien la está escribiendo — y a cambio se ve que la terminal está
 * recibiendo las teclas. Sin ninguna devolución visual es imposible distinguir
 * "escribí bien" de "no me está tomando nada", que es exactamente el problema
 * que esto vino a arreglar.
 */

const CTRL_C = '';
const CTRL_D = '';
const RETROCESO = ['', '\b'];

/**
 * @param {string} pregunta Texto del prompt, ya con los dos puntos y el espacio.
 * @param {{entrada?: NodeJS.ReadStream, salida?: NodeJS.WriteStream}} [flujos]
 *   Solo los reemplazan los tests: el manejo de teclas (pegado en un solo
 *   evento, retroceso, Ctrl+C) es justo lo que se rompió antes y no se puede
 *   probar contra la terminal de verdad.
 * @returns {Promise<string>}
 */
export function leerContrasena(pregunta, flujos = {}) {
  const entrada = flujos.entrada ?? process.stdin;
  const salida = flujos.salida ?? process.stdout;

  // Sin terminal de verdad (una tubería, un job de CI) no hay forma de ocultar
  // nada. Es mejor negarse que escribir la contraseña en un log.
  if (!entrada.isTTY) {
    return Promise.reject(
      new Error(
        'Esto necesita una terminal interactiva. Abrí PowerShell y corré el script ahí, sin tuberías.',
      ),
    );
  }

  return new Promise((resolver) => {
    salida.write(pregunta);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding('utf8');

    let contrasena = '';

    const terminar = (valor) => {
      entrada.setRawMode(false);
      entrada.pause();
      entrada.removeListener('data', alRecibir);
      salida.write('\n');
      resolver(valor);
    };

    const alRecibir = (fragmento) => {
      // En modo crudo un pegado llega entero en un solo evento, no tecla por
      // tecla: hay que recorrer el fragmento.
      const teclas = [...fragmento];
      for (let i = 0; i < teclas.length; i += 1) {
        const tecla = teclas[i];

        // Las flechas, Inicio, Fin y demás llegan como secuencias de escape
        // (`ESC [ D`). El ESC solo es un carácter de control y se descartaría,
        // pero el `[` y la letra final NO lo son: sin esto se colarían dentro
        // de la contraseña y la persona terminaría con una distinta de la que
        // cree haber escrito. Se salta la secuencia entera.
        if (tecla === '') {
          i += 1;
          if (teclas[i] === '[' || teclas[i] === 'O') {
            i += 1;
            // El byte final de una secuencia CSI está entre '@' y '~'.
            while (i < teclas.length && !(teclas[i] >= '@' && teclas[i] <= '~')) i += 1;
          }
          continue;
        }

        if (tecla === '\r' || tecla === '\n' || tecla === CTRL_D) {
          terminar(contrasena);
          return;
        }
        if (tecla === CTRL_C) {
          entrada.setRawMode(false);
          salida.write('\n');
          process.exit(1);
        }
        if (RETROCESO.includes(tecla)) {
          if (contrasena.length > 0) {
            contrasena = contrasena.slice(0, -1);
            // Borra el asterisco de la pantalla.
            salida.write('\b \b');
          }
          continue;
        }
        // Se ignora el resto de los caracteres de control (flechas, Esc): no
        // son parte de una contraseña y pintarlos rompería la línea.
        if (tecla >= ' ') {
          contrasena += tecla;
          salida.write('*');
        }
      }
    };

    entrada.on('data', alRecibir);
  });
}
