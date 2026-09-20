/**
 * Pruebas de la lectura de contraseñas desde la terminal.
 *
 * Existen por un fallo concreto del 2026-09-20: la versión anterior pisaba
 * `_writeToOutput` de `readline` (API privada de Node) y en PowerShell
 * devolvía la cadena vacía sin dejar escribir nada. El script de creación del
 * equipo abortaba diciendo "tiene que tener al menos 12 caracteres" cuando la
 * persona no había podido teclear ni una.
 *
 * Nada de esto se puede probar contra una terminal de verdad, así que los
 * flujos se inyectan.
 */

import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { leerContrasena } from '../leer-contrasena.mjs';

/** Una entrada que se comporta como un TTY en modo crudo. */
function entradaFalsa() {
  const flujo = new EventEmitter();
  flujo.isTTY = true;
  flujo.setRawMode = vi.fn();
  flujo.resume = vi.fn();
  flujo.pause = vi.fn();
  flujo.setEncoding = vi.fn();
  /** Simula que llega un fragmento de entrada (una tecla o un pegado entero). */
  flujo.teclear = (texto) => flujo.emit('data', texto);
  return flujo;
}

function salidaFalsa() {
  return { escrito: '', write(texto) { this.escrito += texto; } };
}

describe('leerContrasena', () => {
  it('devuelve lo tecleado y no lo muestra en pantalla', async () => {
    const entrada = entradaFalsa();
    const salida = salidaFalsa();

    const promesa = leerContrasena('Contraseña: ', { entrada, salida });
    for (const letra of 'secreta12345') entrada.teclear(letra);
    entrada.teclear('\r');

    expect(await promesa).toBe('secreta12345');
    expect(salida.escrito).not.toContain('secreta12345');
    expect(salida.escrito).toContain('Contraseña: ');
    // Un asterisco por letra: es la devolución visual que faltaba.
    expect(salida.escrito).toContain('*'.repeat(12));
  });

  it('acepta un pegado que llega entero en un solo evento', async () => {
    // El caso que rompía todo: en modo crudo, pegar con Ctrl+V no emite una
    // tecla por letra sino un único fragmento.
    const entrada = entradaFalsa();
    const promesa = leerContrasena('x: ', { entrada, salida: salidaFalsa() });

    entrada.teclear('unaContraseñaPegada');
    entrada.teclear('\r');

    expect(await promesa).toBe('unaContraseñaPegada');
  });

  it('el retroceso borra el último carácter', async () => {
    const entrada = entradaFalsa();
    const promesa = leerContrasena('x: ', { entrada, salida: salidaFalsa() });

    entrada.teclear('abcx');
    entrada.teclear('');
    entrada.teclear('d');
    entrada.teclear('\r');

    expect(await promesa).toBe('abcd');
  });

  it('el retroceso sobre una contraseña vacía no rompe nada', async () => {
    const entrada = entradaFalsa();
    const promesa = leerContrasena('x: ', { entrada, salida: salidaFalsa() });

    entrada.teclear('');
    entrada.teclear('a');
    entrada.teclear('\r');

    expect(await promesa).toBe('a');
  });

  it('ignora las teclas de control que no son parte de una contraseña', async () => {
    // Las flechas llegan como secuencias de escape; si se colaran, la
    // contraseña guardada no sería la que la persona cree que escribió.
    const entrada = entradaFalsa();
    const promesa = leerContrasena('x: ', { entrada, salida: salidaFalsa() });

    entrada.teclear('a');
    entrada.teclear('[D'); // flecha izquierda
    entrada.teclear('b');
    entrada.teclear('\r');

    expect(await promesa).toBe('ab');
  });

  it('termina con Enter aunque venga como \\n', async () => {
    const entrada = entradaFalsa();
    const promesa = leerContrasena('x: ', { entrada, salida: salidaFalsa() });

    entrada.teclear('hola\n');

    expect(await promesa).toBe('hola');
  });

  it('deja de escuchar y saca el modo crudo al terminar', async () => {
    // Si no se restaura, la terminal queda inservible después del script.
    const entrada = entradaFalsa();
    const promesa = leerContrasena('x: ', { entrada, salida: salidaFalsa() });

    entrada.teclear('hola\r');
    await promesa;

    expect(entrada.setRawMode).toHaveBeenLastCalledWith(false);
    expect(entrada.listenerCount('data')).toBe(0);
  });

  it('se niega si no hay una terminal interactiva', async () => {
    // Con una tubería no hay forma de ocultar lo que se escribe: es preferible
    // fallar a que la contraseña termine en un log.
    const entrada = entradaFalsa();
    entrada.isTTY = false;

    await expect(leerContrasena('x: ', { entrada, salida: salidaFalsa() })).rejects.toThrow(
      /terminal interactiva/,
    );
  });
});
