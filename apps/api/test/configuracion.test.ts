/**
 * Configuración desde el entorno.
 *
 * Dos cosas se rompieron o podían romperse sin que nadie lo notara, y por eso
 * están acá (2026-09-16):
 *
 *  - Un "Si" o un "sí" cargado a mano en el panel del hosting impedía que la API
 *    arrancara, porque el valor tenía que ser exactamente `si`.
 *  - Las variables se leían de una lista escrita a mano: una agregada al
 *    esquema y olvidada en la lista se ignoraba en silencio.
 *
 * Y una que no puede romperse nunca: los avisos por correo están APAGADOS si
 * nadie los enciende.
 */

import { describe, expect, it } from 'vitest';

import {
  cargarConfiguracion,
  ErrorDeConfiguracion,
  VARIABLES_DE_CONFIGURACION,
} from '../src/configuracion.js';

const MINIMO = {
  DATABASE_URL: 'postgresql://prueba',
  SECRETO_COOKIES: 'un-secreto-de-pruebas-suficientemente-largo-1234',
  ORIGEN_PERMITIDO: 'http://localhost:5173',
};

describe('configuración', () => {
  it('los avisos por correo están apagados si nadie los enciende', () => {
    const config = cargarConfiguracion({ ...MINIMO });

    expect(config.AVISOS_POR_CORREO).toBe('no');
    expect(config.AVISOS_DESTINATARIOS).toEqual([]);
    expect(config.TRABAJOS_AUTOMATICOS).toBe('si');
  });

  it.each(['si', 'Si', 'SI', ' sí ', 'Sí', 'true', '1'])('"%s" enciende un interruptor', (valor) => {
    expect(cargarConfiguracion({ ...MINIMO, AVISOS_POR_CORREO: valor }).AVISOS_POR_CORREO).toBe('si');
  });

  it.each(['no', 'No', 'NO', 'false', '0'])('"%s" apaga un interruptor', (valor) => {
    expect(cargarConfiguracion({ ...MINIMO, TRABAJOS_AUTOMATICOS: valor }).TRABAJOS_AUTOMATICOS).toBe('no');
  });

  it('un valor que no es sí ni no frena el arranque, nombrando la variable', () => {
    expect(() => cargarConfiguracion({ ...MINIMO, AVISOS_POR_CORREO: 'quizás' })).toThrow(ErrorDeConfiguracion);
    expect(() => cargarConfiguracion({ ...MINIMO, AVISOS_POR_CORREO: 'quizás' })).toThrow(/AVISOS_POR_CORREO/);
  });

  it('lee los destinatarios separados por coma, sin espacios de más', () => {
    const config = cargarConfiguracion({
      ...MINIMO,
      AVISOS_DESTINATARIOS: ' daniel@ejemplo.com , lsosa@effort.com.py,',
    });

    expect(config.AVISOS_DESTINATARIOS).toEqual(['daniel@ejemplo.com', 'lsosa@effort.com.py']);
  });

  it('una dirección de correo inválida frena el arranque', () => {
    expect(() => cargarConfiguracion({ ...MINIMO, AVISOS_DESTINATARIOS: 'no-es-un-correo' })).toThrow(
      /AVISOS_DESTINATARIOS/,
    );
  });

  it('el tope de avisos tiene un valor por defecto chico y no acepta negativos', () => {
    expect(cargarConfiguracion({ ...MINIMO }).AVISOS_TOPE_POR_CORRIDA).toBe(5);
    expect(() => cargarConfiguracion({ ...MINIMO, AVISOS_TOPE_POR_CORRIDA: '-1' })).toThrow(ErrorDeConfiguracion);
  });

  it('lee todas las variables del esquema, incluidas las nuevas', () => {
    expect(VARIABLES_DE_CONFIGURACION).toEqual(
      expect.arrayContaining([
        'DATABASE_URL',
        'TRABAJOS_AUTOMATICOS',
        'AVISOS_POR_CORREO',
        'AVISOS_DESTINATARIOS',
        'AVISOS_TOPE_POR_CORRIDA',
      ]),
    );
    const config = cargarConfiguracion({ ...MINIMO, AVISOS_TOPE_POR_CORRIDA: '12' });
    expect(config.AVISOS_TOPE_POR_CORRIDA).toBe(12);
  });

  it('una variable ajena al sistema se ignora, no frena el arranque', () => {
    expect(() => cargarConfiguracion({ ...MINIMO, PATH: '/usr/bin', OTRA_COSA: 'x' })).not.toThrow();
  });
});
