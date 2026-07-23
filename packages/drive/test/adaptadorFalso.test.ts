/**
 * Contrato del puerto `DriveDeArchivos`, verificado contra `DriveFalso`.
 *
 * Estos tests documentan el comportamiento esperado de cualquier adaptador
 * (incluido `DriveGraph` el día que tenga una cuenta real contra la cual
 * correr): listar solo trae lo de la carpeta pedida, leer devuelve exacto lo
 * que se escribió, y escribir dos veces el mismo nombre actualiza en vez de
 * duplicar.
 */

import { describe, expect, it } from 'vitest';

import { DriveFalso } from '../src/adaptadorFalso.js';

describe('DriveFalso', () => {
  it('escribe y después lee el mismo contenido', async () => {
    const drive = new DriveFalso();
    const contenido = Buffer.from('comprobantes de marzo', 'utf8');

    const meta = await drive.escribir('EFFORT/comprobantes', 'marzo.xlsx', contenido);
    const recuperado = await drive.leer(meta.itemId);

    expect(recuperado.equals(contenido)).toBe(true);
    expect(meta.nombre).toBe('marzo.xlsx');
    expect(meta.tamanoBytes).toBe(contenido.length);
  });

  it('listar solo trae los archivos de la carpeta pedida', async () => {
    const drive = new DriveFalso();
    await drive.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('a'));
    await drive.escribir('EFFORT/siga', 'export.csv', Buffer.from('b'));

    const comprobantes = await drive.listar('EFFORT/comprobantes');

    expect(comprobantes.map((a) => a.nombre)).toEqual(['marzo.xlsx']);
  });

  it('subir con el mismo nombre en la misma carpeta actualiza en vez de duplicar', async () => {
    const drive = new DriveFalso();
    const primera = await drive.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('v1'));
    const segunda = await drive.escribir('EFFORT/comprobantes', 'marzo.xlsx', Buffer.from('v2'));

    expect(segunda.itemId).toBe(primera.itemId);

    const listado = await drive.listar('EFFORT/comprobantes');
    expect(listado).toHaveLength(1);

    const contenido = await drive.leer(primera.itemId);
    expect(contenido.toString('utf8')).toBe('v2');
  });

  it('el mismo nombre en carpetas distintas no se pisa', async () => {
    const drive = new DriveFalso();
    await drive.escribir('EFFORT/2026-01', 'resumen.pdf', Buffer.from('enero'));
    await drive.escribir('EFFORT/2026-02', 'resumen.pdf', Buffer.from('febrero'));

    const enero = await drive.listar('EFFORT/2026-01');
    const febrero = await drive.listar('EFFORT/2026-02');

    expect(enero).toHaveLength(1);
    expect(febrero).toHaveLength(1);
    expect(enero[0]?.itemId).not.toBe(febrero[0]?.itemId);
  });

  it('leer un archivo inexistente rechaza en vez de devolver algo vacío', async () => {
    const drive = new DriveFalso();
    await expect(drive.leer('no-existe')).rejects.toThrow();
  });

  it('sembrar prepara un archivo como si ya estuviera en el drive', async () => {
    const drive = new DriveFalso();
    const meta = drive.sembrar('EFFORT/comprobantes', 'preexistente.xlsx', Buffer.from('datos'));

    const listado = await drive.listar('EFFORT/comprobantes');
    expect(listado.map((a) => a.itemId)).toContain(meta.itemId);
  });
});
