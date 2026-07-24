/**
 * Espejo automático hacia el OneDrive de respaldo (tarea 90).
 *
 * Copia el contenido de una carpeta de origen a una carpeta de destino,
 * escribiendo un manifiesto sha256 en el destino para poder verificar
 * integridad y evitar volver a subir archivos sin cambios.
 */

import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { DriveFalso } from '../src/adaptadorFalso.js';
import { espejarCarpeta } from '../src/espejo.js';

function sha256(contenido: Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}

describe('espejarCarpeta', () => {
  it('copia todos los archivos de la carpeta de origen al destino', async () => {
    const origen = new DriveFalso();
    const destino = new DriveFalso();
    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('marzo'));
    await origen.escribir('EFFORT/comprobantes', 'abril.xlsx', Buffer.from('abril'));

    const resultado = await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    expect(resultado.copiados).toEqual(['marzo.xlsx', 'abril.xlsx']);
    expect(resultado.saltados).toEqual([]);

    const listado = await destino.listar('Respaldo/comprobantes');
    expect(listado.map((a) => a.nombre).sort()).toEqual(['abril.xlsx', 'manifiesto-espejo.json', 'marzo.xlsx']);
  });

  it('el manifiesto guarda el sha256 real de cada archivo copiado', async () => {
    const origen = new DriveFalso();
    const destino = new DriveFalso();
    const contenido = Buffer.from('comprobantes de marzo');
    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', contenido);

    const resultado = await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    const entrada = resultado.manifiesto.find((e) => e.nombre === 'marzo.xlsx');
    expect(entrada?.sha256).toBe(sha256(contenido));
    expect(entrada?.tamanoBytes).toBe(contenido.length);
  });

  it('correr dos veces sin cambios no vuelve a escribir nada', async () => {
    const origen = new DriveFalso();
    const destino = new DriveFalso();
    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('marzo'));

    await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    const escribirEspiado = vi.spyOn(destino, 'escribir');

    const segundaCorrida = await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    expect(escribirEspiado).not.toHaveBeenCalled();
    expect(segundaCorrida.copiados).toEqual([]);
    expect(segundaCorrida.saltados).toEqual(['marzo.xlsx']);
  });

  it('un archivo nuevo en el origen se copia sin retocar los que no cambiaron', async () => {
    const origen = new DriveFalso();
    const destino = new DriveFalso();
    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('marzo'));
    await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    await origen.escribir('EFFORT/comprobantes', 'abril.xlsx', Buffer.from('abril'));
    const escribirEspiado = vi.spyOn(destino, 'escribir');

    const resultado = await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    expect(resultado.copiados).toEqual(['abril.xlsx']);
    expect(resultado.saltados).toEqual(['marzo.xlsx']);
    // abril.xlsx + el manifiesto actualizado, marzo.xlsx no se vuelve a subir
    expect(escribirEspiado).toHaveBeenCalledTimes(2);
  });

  it('un archivo modificado en el origen se vuelve a copiar con el sha256 actualizado', async () => {
    const origen = new DriveFalso();
    const destino = new DriveFalso();
    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('v1'));
    const primeraCorrida = await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });
    const shaOriginal = primeraCorrida.manifiesto.find((e) => e.nombre === 'marzo.xlsx')?.sha256;

    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('v2'));
    const segundaCorrida = await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    expect(segundaCorrida.copiados).toEqual(['marzo.xlsx']);
    const shaNuevo = segundaCorrida.manifiesto.find((e) => e.nombre === 'marzo.xlsx')?.sha256;
    expect(shaNuevo).not.toBe(shaOriginal);
    expect(shaNuevo).toBe(sha256(Buffer.from('v2')));

    const copiaEnDestino = await destino.listar('Respaldo/comprobantes');
    const item = copiaEnDestino.find((a) => a.nombre === 'marzo.xlsx');
    const contenidoCopiado = await destino.leer(item!.itemId);
    expect(contenidoCopiado.toString('utf8')).toBe('v2');
  });

  it('un archivo borrado del origen no se borra del destino (regla: no se borra nada)', async () => {
    const origen = new DriveFalso();
    const destino = new DriveFalso();
    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('marzo'));
    await origen.escribir('EFFORT/comprobantes', 'abril.xlsx', Buffer.from('abril'));
    await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    // Simula que abril.xlsx ya no está en el origen: un DriveFalso nuevo sin él.
    const origenSinAbril = new DriveFalso();
    await origenSinAbril.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('marzo'));

    await espejarCarpeta({
      origen: origenSinAbril,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    const listado = await destino.listar('Respaldo/comprobantes');
    expect(listado.map((a) => a.nombre)).toContain('abril.xlsx');
  });

  it('el manifiesto previo no se lista como archivo a copiar', async () => {
    const origen = new DriveFalso();
    const destino = new DriveFalso();
    await origen.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('marzo'));

    await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });
    // Si alguien sembrara el manifiesto también en el origen (por error de
    // configuración de carpetas), no debería copiarse como si fuera un
    // comprobante más.
    origen.sembrar('EFFORT/comprobantes', 'manifiesto-espejo.json', Buffer.from('[]'));

    const resultado = await espejarCarpeta({
      origen,
      destino,
      carpetaOrigen: 'EFFORT/comprobantes',
      carpetaDestino: 'Respaldo/comprobantes',
    });

    expect(resultado.copiados).not.toContain('manifiesto-espejo.json');
  });
});
