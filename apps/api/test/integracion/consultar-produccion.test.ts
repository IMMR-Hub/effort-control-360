/**
 * `scripts/consultar-produccion.mjs`: la garantía de solo lectura, probada
 * contra PostgreSQL real.
 *
 * Corre sobre un esquema `pruebas_*` propio (nunca `public`), como el resto de
 * los tests de integración. Lo que importa acá no es que el SELECT funcione —
 * eso es trivial — sino que un INSERT, UPDATE o DELETE dentro de la misma
 * transacción falle porque PostgreSQL la marcó READ ONLY, no porque el script
 * los prohíba por convención.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';
// La misma función que usa `scripts/consultar-produccion.mjs`. No se importa
// el .mjs directamente: tiene un `await` a nivel de módulo para su modo CLI, y
// Vite tropieza al transformarlo desde un test ("SyntaxError: Invalid or
// unexpected token", tanto con `import()` dinámico como con un `import`
// estático). `consultaSoloLectura.ts` es el módulo sin ese problema que los
// dos comparten.
import { consultaDeSoloLectura } from '../../src/servicios/consultaSoloLectura.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase('consultar-produccion: transacción READ ONLY contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let clienteId = '';

  beforeAll(async () => {
    entorno = await crearEntorno();
    const cliente = await entorno.prisma.cliente.create({
      data: { nombre: 'CLIENTE DE PRUEBA S.A.', ruc: '80000000-1', activo: true, tipoPersona: 'JURIDICA' },
    });
    clienteId = cliente.id;
    // Sin tope propio: el proyecto ya fija `hookTimeout: 120_000` para este
    // grupo de tests (`vitest.config.ts`), porque `crearEntorno()` aplica
    // todas las migraciones contra Supabase en São Paulo y puede tardar más
    // de 30s. Un tope de 60_000 acá lo pisaba y lo hacía fallar por timeout.
  });

  afterAll(async () => {
    await entorno.destruir();
  });

  it('un SELECT normal funciona y ve los datos ya guardados', async () => {
    const filas = await consultaDeSoloLectura(
      entorno.prisma,
      `SELECT nombre FROM cliente WHERE id = '${clienteId}'`,
    );

    expect(filas).toEqual([{ nombre: 'CLIENTE DE PRUEBA S.A.' }]);
  });

  it('un UPDATE dentro de la misma transacción falla, y no modifica nada', async () => {
    await expect(
      consultaDeSoloLectura(entorno.prisma, `UPDATE cliente SET nombre = 'HACKEADO' WHERE id = '${clienteId}'`),
    ).rejects.toThrow(/read-only transaction/i);

    const cliente = await entorno.prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    expect(cliente.nombre).toBe('CLIENTE DE PRUEBA S.A.');
  });

  it('un DELETE dentro de la misma transacción también falla', async () => {
    await expect(
      consultaDeSoloLectura(entorno.prisma, `DELETE FROM cliente WHERE id = '${clienteId}'`),
    ).rejects.toThrow(/read-only transaction/i);

    const cliente = await entorno.prisma.cliente.findUnique({ where: { id: clienteId } });
    expect(cliente).not.toBeNull();
  });

  it('un INSERT dentro de la misma transacción también falla', async () => {
    await expect(
      consultaDeSoloLectura(
        entorno.prisma,
        `INSERT INTO cliente (id, nombre, ruc, activo, tipo_persona) ` +
          `VALUES (gen_random_uuid(), 'INTRUSO', '80000000-2', true, 'JURIDICA')`,
      ),
    ).rejects.toThrow(/read-only transaction/i);

    const filas = await entorno.prisma.cliente.findMany({ where: { nombre: 'INTRUSO' } });
    expect(filas).toEqual([]);
  });
});
