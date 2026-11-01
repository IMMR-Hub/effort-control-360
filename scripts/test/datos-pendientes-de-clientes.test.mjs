/**
 * Documento de datos pendientes: lo que se prueba es que no invente nada. Un
 * RUC que el alta masiva no cargaría figura «PENDIENTE», lo que falta se dice
 * en palabras simples, y las filas salen de las carpetas, ordenadas por código.
 */

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { cargarValidadores, leerPlanilla, PLANILLA_POR_DEFECTO } from '../alta-masiva-clientes.mjs';
import { armarDudas, armarFilas, PENDIENTE, textoDeObligaciones } from '../datos-pendientes-de-clientes.mjs';

const validar = await cargarValidadores();

const fila = (codigo, cambios = {}) => ({
  filaExcel: 3,
  codigo,
  nombre: `CLIENTE ${codigo}`,
  sigueSiendoCliente: null,
  ruc: null,
  origenRuc: null,
  tipoPersonaTexto: 'Física',
  tipoPersona: 'FISICA',
  regimen: null,
  obligaciones: { IVA_GENERAL: null, PLANILLA_RG90: null, IRE: null, EEFF: null },
  otras: null,
  responsable: null,
  email: null,
  telefono: null,
  observaciones: null,
  aviso: null,
  ...cambios,
});
const carpeta = (codigo, nombre = `CLIENTE ${codigo}`) => ({ codigo, nombre, carpeta: `${codigo} ${nombre}`, id: null });

describe('documento de datos pendientes', () => {
  it('una fila por carpeta, ordenada por código; sin carpeta no hay fila', () => {
    const filas = armarFilas({
      filas: [fila('003', { ruc: '4416002-0' }), fila('001', { ruc: '6256615-6' }), fila('045')],
      carpetas: [carpeta('003'), carpeta('001')],
      validar,
    });
    expect(filas.map((f) => f.codigo)).toEqual(['001', '003']);
    expect(filas[0]).toMatchObject({ carpeta: '001 CLIENTE 001', ruc: '6256615-6', regimen: PENDIENTE, obligaciones: PENDIENTE });
    expect(filas[0].queFalta).toBe('El régimen tributario.\nQué obligaciones tiene (IVA, RG 90, IRE, estados financieros, otras).');
  });

  it('sin RUC, o con uno que no es del cliente, dice PENDIENTE y explica qué falta', () => {
    const filas = armarFilas({
      filas: [fila('004'), fila('056', { ruc: '1300663-0' })],
      carpetas: [carpeta('004'), carpeta('056')],
      validar,
    });
    expect(filas.map((f) => f.ruc)).toEqual([PENDIENTE, PENDIENTE]);
    expect(filas[0].queFalta).toMatch(/^El RUC, con su dígito verificador\./);
    expect(filas[1].queFalta).toMatch(/^El RUC correcto: el que se había propuesto \(1300663-0\) es de ROMERO CABALLERO/);
  });

  it('el 113 y los RUC «de 1 de 1» se muestran, con el pedido de confirmarlos', () => {
    const filas = armarFilas({
      filas: [
        fila('064', { ruc: '656187-0', origenRuc: 'Sale de 1 de 1 declaraciones de su carpeta.' }),
        fila('113', { ruc: '80051798-9', tipoPersona: 'JURIDICA' }),
      ],
      carpetas: [carpeta('064'), carpeta('113', 'CASA VIVA')],
      validar,
    });
    expect(filas[0].ruc).toBe('656187-0');
    expect(filas[0].queFalta).toMatch(/^Confirmar el RUC 656187-0: salió de una sola declaración/);
    expect(filas[1].ruc).toBe('80051798-9');
    expect(filas[1].queFalta).toMatch(/PAVISA/);
  });

  it('un cliente ya cargado con todos sus datos no tiene nada pendiente', () => {
    const [f] = armarFilas({
      filas: [
        fila('002', {
          ruc: '80119631-0',
          origenRuc: 'Ya cargado en el sistema.',
          tipoPersona: 'JURIDICA',
          regimen: 'IRE – Régimen General',
          obligaciones: { IVA_GENERAL: true, PLANILLA_RG90: true, IRE: true, EEFF: true },
        }),
      ],
      carpetas: [carpeta('002', 'FUMIPRO S.A')],
      validar,
    });
    expect(f.queFalta).toBe('Nada: ya está cargado en el sistema con estos datos.');
    expect(f.obligaciones).toBe('IVA mensual (Form. 120); Planilla RG 90 mensual; IRE anual (Form. 500); Estados financieros anuales');
  });

  it('las obligaciones son solo las marcadas «Sí», más las otras anotadas', () => {
    expect(
      textoDeObligaciones(fila('001', { obligaciones: { IVA_GENERAL: true, PLANILLA_RG90: false, IRE: null, EEFF: null }, otras: 'IPS' })),
    ).toBe('IVA mensual (Form. 120); Otras: IPS');
  });

  it('con la planilla real, la hoja «Dudas» trae 045, 056, 070, 099, 113 y DISCREPANCIAS 40 y 44', async () => {
    const { filas } = await leerPlanilla(PLANILLA_POR_DEFECTO, ExcelJS);
    const carpetas = filas.filter((f) => !['045', '070', '099'].includes(f.codigo)).map((f) => carpeta(f.codigo, f.nombre));
    const temas = armarDudas({ filas, carpetas }).map((d) => d.tema);
    for (const esperado of ['045', '056', '070', '099', '113', 'DISCREPANCIAS 40', 'DISCREPANCIAS 44']) {
      expect(temas.some((t) => t.startsWith(esperado))).toBe(true);
    }
    const d056 = armarDudas({ filas, carpetas }).find((d) => d.tema.startsWith('056'));
    expect(d056.queSeSabe).toMatch(/1300663-0/);
  });
});
