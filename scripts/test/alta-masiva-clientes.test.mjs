/**
 * Alta masiva de clientes: lo que se prueba es el criterio (a quién se crea, a
 * quién no, qué no se pisa) y los candados (solo GET a Graph, respaldo del día,
 * nada de borrar). Todo con dobles: ni base real ni OneDrive.
 */

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import {
  aplicarPlan,
  argumento,
  buscarRespaldoDelDia,
  cargarCarpetas,
  cargarValidadores,
  carpetasDelPlan,
  crearLectorDeGraph,
  formatearInforme,
  interpretarCarpetas,
  interpretarHojaDeClientes,
  leerCarpetasDeGraph,
  leerPlanilla,
  listaDeArgumento,
  PLANILLA_POR_DEFECTO,
  planificarAlta,
} from '../alta-masiva-clientes.mjs';

const validar = await cargarValidadores();

/** Fila de planilla ya interpretada, con lo mínimo para darse de alta. */
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

const carpeta = (codigo, nombre = `CLIENTE ${codigo}`, id = `id-carpeta-${codigo}`) => ({
  codigo,
  nombre,
  carpeta: `${codigo} ${nombre}`,
  id,
});

/** Cliente tal como lo devuelve `ClientesPrisma.listar`. */
const existente = (cambios) => ({
  id: 'cli-1',
  codigo: null,
  nombre: 'X',
  ruc: '80003112-1',
  tipoPersona: 'JURIDICA',
  regimenTributario: null,
  email: null,
  telefono: null,
  canalPreferido: null,
  carpetaOneDriveId: null,
  activo: true,
  observaciones: null,
  ...cambios,
});

const planificar = (opciones) =>
  planificarAlta({ conIds: true, existentes: [], validar, ...opciones });

/* ------------------------------------------------------------------------- */

describe('lectura de la planilla', () => {
  /*
   * Lección 3 de CLAUDE.md: la planilla real tiene el encabezado en la fila 2
   * (la 1 es una instrucción). Se arma un libro igual en memoria.
   */
  it('encuentra el encabezado aunque no esté en la fila 1 y lee las columnas por su nombre', () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Clientes');
    hoja.addRow(['Completar las celdas amarillas.']);
    hoja.addRow([
      'Código', 'Carpeta en el OneDrive', 'Archivos', 'Último archivo modificado', '¿Sigue siendo cliente? (Sí / No)',
      'RUC completo (con dígito verificador)', 'Cómo salió el RUC', 'Tipo de persona', 'Régimen tributario',
      'IVA mensual (Form. 120)', 'Planilla RG 90 mensual', 'IRE anual (Form. 500)', 'Estados financieros anuales',
      'Formularios que encontré en su carpeta', 'Otras obligaciones que controlan', 'Responsable en EFFORT',
      'Correo del cliente (opcional)', 'Teléfono (opcional)', 'Observaciones', 'Aviso del sistema',
    ]);
    hoja.addRow(['002', 'FUMIPRO S.A', 812, null, 'Sí', '80119631-0', 'Ya cargado en el sistema.', 'Jurídica',
      'IRE – Régimen General', 'Sí', 'Sí', 'No', null, '', 'IPS', 'Lili', null, null, null, '']);
    hoja.addRow([7, 'RAMIRO', 1, null, null, null, null, 'Física']); // el código como número también vale
    hoja.addRow([null]);

    const { filaEncabezado, filas } = interpretarHojaDeClientes(hoja);

    expect(filaEncabezado).toBe(2);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      codigo: '002',
      nombre: 'FUMIPRO S.A',
      sigueSiendoCliente: true,
      ruc: '80119631-0',
      tipoPersona: 'JURIDICA',
      regimen: 'IRE – Régimen General',
      obligaciones: { IVA_GENERAL: true, PLANILLA_RG90: true, IRE: false, EEFF: null },
      otras: 'IPS',
      responsable: 'Lili',
    });
    expect(filas[1].codigo).toBe('007');
  });

  it('grita si no encuentra el encabezado, en vez de devolver vacío', () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Clientes');
    hoja.addRow(['algo', 'otra cosa']);
    expect(() => interpretarHojaDeClientes(hoja)).toThrow(/encabezado/);
  });

  it('grita si falta una columna obligatoria', () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Clientes');
    hoja.addRow(['Código', 'RUC completo']);
    hoja.addRow(['001', '6256615-6']);
    expect(() => interpretarHojaDeClientes(hoja)).toThrow(/Faltan columnas/);
  });

  /*
   * Lección 8: correr el código contra el archivo de verdad. Esta es la planilla
   * versionada que se mandó a EFFORT (sin devolver todavía).
   */
  it('lee la planilla real: 132 filas del 001 al 132; el 056 se da de alta SIN el RUC del 045 (DISCREPANCIAS 44)', async () => {
    const { filaEncabezado, filas } = await leerPlanilla(PLANILLA_POR_DEFECTO, ExcelJS);
    expect(filaEncabezado).toBe(2);
    expect(filas).toHaveLength(132);
    expect(filas[0].codigo).toBe('001');
    expect(filas.at(-1).codigo).toBe('132');

    // Una carpeta por fila, salvo los tres códigos que no tienen (045, 070, 099).
    const carpetas = filas.filter((f) => !['045', '070', '099'].includes(f.codigo)).map((f) => carpeta(f.codigo, f.nombre, null));
    const plan = planificarAlta({ filas, carpetas, conIds: false, existentes: null, validar });
    const c056 = plan.acciones.find((a) => a.codigo === '056');
    expect(c056.tipo).toBe('crear');
    expect(c056.datos.ruc).toBeNull();
    expect(c056.problemas.map((p) => p.texto).join(' ')).toMatch(/1300663-0 no corresponde.*queda «RUC pendiente»/);
    // Sin carpeta no hay alta: los clientes son los que tienen carpeta.
    expect(plan.acciones.find((a) => a.codigo === '045').tipo).toBe('sin_carpeta');
    // Los 5 del piloto no aparecen como «crear» aunque no se haya leído la base.
    const piloto = plan.acciones.filter((a) => ['002', '021', '032', '043', '068'].includes(a.codigo));
    expect(piloto.map((a) => a.tipo)).toEqual(Array(5).fill('existente_sin_verificar'));
  });
});

/* ------------------------------------------------------------------------- */

describe('planificar el alta', () => {
  it('crea un cliente nuevo con su código, su RUC válido y su carpeta', () => {
    const plan = planificar({ filas: [fila('001', { ruc: '6256615-6' })], carpetas: [carpeta('001')] });
    expect(plan.acciones[0].tipo).toBe('crear');
    expect(plan.acciones[0].datos).toMatchObject({
      codigo: '001', ruc: '6256615-6', tipoPersona: 'FISICA', carpetaOneDriveId: 'id-carpeta-001',
    });
    expect(plan.resumen.conCarpetaAConectar).toBe(1);
  });

  /* --- RUC pendiente (2026-11-01): nunca bloquea, nunca se inventa ---------- */

  it('sin RUC se da de alta igual, con el RUC pendiente: no se inventa uno', () => {
    const plan = planificar({ filas: [fila('004')], carpetas: [carpeta('004')] });
    expect(plan.acciones[0].tipo).toBe('crear');
    expect(plan.acciones[0].datos.ruc).toBeNull();
    expect(plan.resumen.crearConRucPendiente).toBe(1);
    expect(plan.resumen.faltaDeEffort.sinRuc).toBe(1);
  });

  it('un RUC con dígito verificador inválido no se carga: el cliente queda pendiente', () => {
    const plan = planificar({ filas: [fila('001', { ruc: '6256615-7' })], carpetas: [carpeta('001')] });
    expect(plan.acciones[0].tipo).toBe('crear');
    expect(plan.acciones[0].datos.ruc).toBeNull();
    expect(plan.acciones[0].problemas.some((p) => /dígito verificador.*RUC pendiente/.test(p.texto))).toBe(true);
  });

  it('un RUC repetido en dos filas no se le carga a ninguna de las dos', () => {
    const plan = planificar({
      filas: [fila('001', { ruc: '6256615-6' }), fila('003', { ruc: '6256615-6' })],
      carpetas: [carpeta('001'), carpeta('003')],
    });
    expect(plan.acciones.map((a) => [a.tipo, a.datos.ruc])).toEqual([['crear', null], ['crear', null]]);
    expect(plan.acciones[0].problemas.some((p) => /repetido.*003/.test(p.texto))).toBe(true);
  });

  it('el RUC propuesto para el 056 es del 045: el 056 se crea sin él; si EFFORT lo corrige, se carga', () => {
    const conElDel045 = planificar({ filas: [fila('056', { ruc: '1300663-0' })], carpetas: [carpeta('056')] });
    expect(conElDel045.acciones[0].tipo).toBe('crear');
    expect(conElDel045.acciones[0].datos.ruc).toBeNull();

    const corregido = planificar({ filas: [fila('056', { ruc: '6256615-6' })], carpetas: [carpeta('056')] });
    expect(corregido.acciones[0].datos.ruc).toBe('6256615-6');
  });

  it('un RUC «de 1 de 1» se carga, con aviso para confirmar', () => {
    const plan = planificar({
      filas: [fila('064', { ruc: '656187-0', origenRuc: 'Sale de 1 de 1 declaraciones de su carpeta.' })],
      carpetas: [carpeta('064')],
    });
    expect(plan.acciones[0].datos.ruc).toBe('656187-0');
    expect(plan.acciones[0].problemas.some((p) => /una sola declaración: confirmar/.test(p.texto))).toBe(true);
    expect(plan.resumen.faltaDeEffort.rucAConfirmar).toBe(1);
  });

  it('un RUC que en la base ya tiene otro cliente no se carga: el nuevo queda pendiente', () => {
    const plan = planificar({
      filas: [fila('001', { ruc: '80003112-1' })],
      carpetas: [carpeta('001')],
      existentes: [existente({ id: 'copesa', codigo: '021', nombre: 'COPESA', ruc: '80003112-1' })],
    });
    expect(plan.acciones[0].tipo).toBe('bloqueado');
    expect(plan.acciones[0].problemas.some((p) => /ya tiene el código 021/.test(p.texto))).toBe(true);
  });

  it('el 113 (PAVISA) se da de alta pero con aviso', () => {
    const plan = planificar({
      filas: [fila('113', { ruc: '80051798-9', tipoPersona: 'JURIDICA' })],
      carpetas: [carpeta('113', 'CASA VIVA')],
    });
    expect(plan.acciones[0].tipo).toBe('crear');
    expect(plan.acciones[0].problemas.some((p) => /PAVISA/.test(p.texto))).toBe(true);
  });

  it('régimen vacío es un aviso; una fila sin carpeta no se da de alta; la carpeta sin fila se lista', () => {
    const plan = planificar({
      filas: [fila('001', { ruc: '6256615-6' }), fila('045')],
      carpetas: [carpeta('001'), carpeta('200', 'NUEVO')],
    });
    expect(plan.acciones[0].tipo).toBe('crear');
    expect(plan.acciones[0].problemas.map((p) => p.texto).join(' | ')).toMatch(/régimen vacío/);
    expect(plan.acciones[1].tipo).toBe('sin_carpeta');
    expect(plan.resumen.sinCarpeta).toBe(1);
    expect(plan.carpetasSinCliente.map((c) => c.carpeta)).toEqual(['200 NUEVO']);
  });

  it('sin tipo de persona no se da de alta (el esquema lo exige)', () => {
    const plan = planificar({ filas: [fila('001', { ruc: '6256615-6', tipoPersona: null })], carpetas: [carpeta('001')] });
    expect(plan.acciones[0].tipo).toBe('bloqueado');
  });

  it('«¿Sigue siendo cliente?» = No: no se crea', () => {
    const plan = planificar({ filas: [fila('001', { ruc: '6256615-6', sigueSiendoCliente: false })] });
    expect(plan.acciones[0].tipo).toBe('baja');
  });

  /* --- Los 5 del piloto no se duplican, y lo cargado a mano no se pisa ---- */

  it('un cliente existente se reconoce por su código y no se duplica', () => {
    const plan = planificar({
      filas: [fila('021', { nombre: 'COPESA', ruc: '80003112-1', tipoPersona: 'JURIDICA' })],
      carpetas: [carpeta('021', 'COPESA', '01256M3REYI7YSD4RO2BDZLOCVJVVQUYFF')],
      existentes: [existente({ codigo: '021', nombre: 'COPESA CONSTRUCCIONES SA', carpetaOneDriveId: '01256M3REYI7YSD4RO2BDZLOCVJVVQUYFF' })],
    });
    expect(plan.acciones[0].tipo).toBe('sin_cambios');
    expect(plan.resumen.crear).toBe(0);
    // El nombre que se cargó a mano se conserva.
    expect(plan.acciones[0].conservados).toEqual([
      { campo: 'nombre', actual: 'COPESA CONSTRUCCIONES SA', propuesto: 'COPESA' },
    ]);
  });

  it('un cliente anterior sin código se reconoce por la carpeta y se le completa el código', () => {
    const plan = planificar({
      filas: [fila('021', { nombre: 'COPESA', ruc: '80003112-1', tipoPersona: 'JURIDICA' })],
      carpetas: [carpeta('021', 'COPESA', 'id-copesa')],
      existentes: [existente({ nombre: 'COPESA CONSTRUCCIONES SA', carpetaOneDriveId: 'id-copesa' })],
    });
    expect(plan.acciones[0].tipo).toBe('actualizar');
    expect(plan.acciones[0].cambios).toEqual({ codigo: '021' });
  });

  it('el código de un cliente no se pisa: si la carpeta es de otro código, se revisa a mano', () => {
    const plan = planificar({
      filas: [fila('021', { ruc: '80003112-1', tipoPersona: 'JURIDICA' })],
      carpetas: [carpeta('021', 'COPESA', 'id-copesa')],
      existentes: [existente({ codigo: '068', nombre: 'ECOAGRO', carpetaOneDriveId: 'id-copesa', ruc: '80022319-5' })],
      forzar: ['nombre'],
    });
    expect(plan.acciones[0].tipo).toBe('bloqueado');
    expect(plan.acciones[0].problemas.some((p) => /ya tiene el código 068/.test(p.texto))).toBe(true);
  });

  it('un cliente existente sin carpeta se reconoce por el RUC y se le completa la carpeta', () => {
    const plan = planificar({
      filas: [fila('021', { nombre: 'COPESA', ruc: '80003112-1', tipoPersona: 'JURIDICA', regimen: 'IRE – Régimen General' })],
      carpetas: [carpeta('021', 'COPESA')],
      existentes: [existente({ codigo: '021', nombre: 'COPESA CONSTRUCCIONES SA' })],
    });
    expect(plan.acciones[0].tipo).toBe('actualizar');
    expect(plan.acciones[0].cambios).toEqual({ carpetaOneDriveId: 'id-carpeta-021', regimenTributario: 'IRE – Régimen General' });
  });

  it('a un cliente existente con RUC pendiente se le carga el RUC cuando la planilla trae uno confiable', () => {
    const plan = planificar({
      filas: [fila('004', { ruc: '6256615-6' })],
      carpetas: [carpeta('004')],
      existentes: [existente({ codigo: '004', nombre: 'CLIENTE 004', ruc: null, tipoPersona: 'FISICA', carpetaOneDriveId: 'id-carpeta-004' })],
    });
    expect(plan.acciones[0].tipo).toBe('actualizar');
    expect(plan.acciones[0].cambios).toEqual({ ruc: '6256615-6' });
  });

  it('--forzar-campo permite pisar un dato ya cargado', () => {
    const plan = planificar({
      filas: [fila('021', { nombre: 'COPESA', ruc: '80003112-1', tipoPersona: 'JURIDICA' })],
      carpetas: [carpeta('021', 'COPESA')],
      existentes: [existente({ codigo: '021', nombre: 'COPESA CONSTRUCCIONES SA', carpetaOneDriveId: 'id-carpeta-021' })],
      forzar: ['nombre'],
    });
    expect(plan.acciones[0].cambios).toEqual({ nombre: 'COPESA' });
  });

  it('no desactiva a un cliente porque la planilla diga «No», salvo --forzar-campo activo', () => {
    const base = {
      filas: [fila('021', { ruc: '80003112-1', tipoPersona: 'JURIDICA', sigueSiendoCliente: false })],
      carpetas: [carpeta('021')],
      existentes: [existente({ codigo: '021', nombre: 'CLIENTE 021', carpetaOneDriveId: 'id-carpeta-021' })],
    };
    expect(planificar(base).acciones[0].cambios).toEqual({});
    expect(planificar({ ...base, forzar: ['activo'] }).acciones[0].cambios).toEqual({ activo: false });
  });

  it('si la carpeta es de un cliente y el RUC de otro, no se toca nada', () => {
    const plan = planificar({
      filas: [fila('021', { ruc: '80003112-1', tipoPersona: 'JURIDICA' })],
      carpetas: [carpeta('021')],
      existentes: [
        existente({ id: 'a', nombre: 'A', ruc: '80119631-0', carpetaOneDriveId: 'id-carpeta-021' }),
        existente({ id: 'b', nombre: 'B', ruc: '80003112-1' }),
      ],
    });
    expect(plan.acciones[0].tipo).toBe('bloqueado');
  });

  it('--codigos limita a esa tanda', () => {
    const plan = planificar({
      filas: [fila('001', { ruc: '6256615-6' }), fila('003', { ruc: '4416002-0' })],
      codigos: ['003'],
    });
    expect(plan.acciones.map((a) => a.codigo)).toEqual(['003']);
  });

  /* --- Obligaciones ---------------------------------------------------------- */

  const catalogo = [
    { id: 'o-iva', codigo: 'IVA_GENERAL' },
    { id: 'o-rg90', codigo: 'PLANILLA_RG90' },
    { id: 'o-ire', codigo: 'IRE' },
    { id: 'o-eeff', codigo: 'EEFF' },
  ];
  const conObligaciones = fila('001', {
    ruc: '6256615-6',
    obligaciones: { IVA_GENERAL: true, PLANILLA_RG90: true, IRE: false, EEFF: null },
  });

  it('sin --desde no asigna ninguna obligación (la fecha no se inventa)', () => {
    const plan = planificar({ filas: [conObligaciones], catalogo });
    expect(plan.acciones[0].obligaciones).toEqual([]);
    expect(plan.acciones[0].problemas.some((p) => /falta --desde/.test(p.texto))).toBe(true);
  });

  it('con --desde asigna solo las marcadas «Sí»', () => {
    const plan = planificar({ filas: [conObligaciones], catalogo, desde: '2026-01-01' });
    expect(plan.acciones[0].obligaciones).toEqual([
      { codigo: 'IVA_GENERAL', obligacionId: 'o-iva' },
      { codigo: 'PLANILLA_RG90', obligacionId: 'o-rg90' },
    ]);
  });

  it('no repite una ya asignada, y un «No» no quita la que ya estaba', () => {
    const plan = planificar({
      filas: [fila('021', { ruc: '80003112-1', tipoPersona: 'JURIDICA', obligaciones: { IVA_GENERAL: true, PLANILLA_RG90: null, IRE: false, EEFF: null } })],
      carpetas: [carpeta('021')],
      existentes: [existente({ codigo: '021', nombre: 'CLIENTE 021', carpetaOneDriveId: 'id-carpeta-021' })],
      asignaciones: [
        { clienteId: 'cli-1', obligacionId: 'o-iva' },
        { clienteId: 'cli-1', obligacionId: 'o-ire' },
      ],
      catalogo,
      desde: '2026-01-01',
    });
    expect(plan.acciones[0].tipo).toBe('sin_cambios');
    expect(plan.acciones[0].obligaciones).toEqual([]);
    expect(plan.acciones[0].problemas.some((p) => /dice «No» a IRE.*no se quita/.test(p.texto))).toBe(true);
  });

  it('el informe dice qué falta de EFFORT', () => {
    const plan = planificar({
      filas: [fila('001', { ruc: '6256615-6' }), fila('004'), fila('045')],
      carpetas: [carpeta('001'), carpeta('004')],
    });
    const texto = formatearInforme(plan, { fuenteCarpetas: 'doble' });
    expect(texto).toMatch(/crear: 2 \(con RUC pendiente: 1\)/);
    expect(texto).toMatch(/004 CLIENTE 004 +RUC PENDIENTE/);
    expect(texto).toMatch(/SIN CARPETA EN CLIENTES .*\(1\)/);
    expect(texto).toMatch(/RUC pendiente: 1 /);
  });
});

/* ------------------------------------------------------------------------- */

describe('aplicar el plan', () => {
  function dobles({ rucOcupado = null, codigoOcupado = null, fallaEn = null } = {}) {
    const llamadas = [];
    const clientes = {
      buscarPorRuc: async (ruc) => {
        llamadas.push(['buscarPorRuc', ruc]);
        return ruc === rucOcupado ? { id: 'otro', nombre: 'OTRO' } : null;
      },
      buscarPorCodigo: async (codigo) => (codigo === codigoOcupado ? { id: 'otro', nombre: 'OTRO' } : null),
      buscarPorId: async (id) => ({ id, nombre: 'COPESA CONSTRUCCIONES SA', carpetaOneDriveId: null, regimenTributario: null }),
      crear: async (datos) => {
        llamadas.push(['crear', datos.codigo, datos.ruc]);
        if (fallaEn && datos.ruc === fallaEn) throw new Error('Can\'t reach database server');
        return { id: `nuevo-${datos.codigo}`, ...datos };
      },
      actualizar: async (id, cambios) => {
        llamadas.push(['actualizar', id, cambios]);
        return { id, ...cambios };
      },
    };
    const obligaciones = {
      crear: async ({ data }) => {
        llamadas.push(['obligacion', data.clienteId, data.obligacionId, data.desde.toISOString().slice(0, 10)]);
        if (data.obligacionId === 'o-dup') throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      },
    };
    const eventos = [];
    const registrar = async (e) => eventos.push(e);
    return { clientes, obligaciones, registrar, llamadas, eventos };
  }

  const planDe = (acciones) => ({ acciones });
  const crear = (codigo, ruc, extra = {}) => ({
    codigo,
    nombre: `CLIENTE ${codigo}`,
    tipo: 'crear',
    datos: { nombre: `CLIENTE ${codigo}`, ruc, tipoPersona: 'FISICA', regimenTributario: null, email: null, telefono: null, carpetaOneDriveId: `id-${codigo}`, observaciones: null },
    cambios: {},
    obligaciones: [],
    ...extra,
  });

  it('crea, conecta la carpeta, asigna obligaciones y deja todo en la bitácora', async () => {
    const d = dobles();
    const r = await aplicarPlan(
      planDe([crear('001', '6256615-6', { obligaciones: [{ codigo: 'IVA_GENERAL', obligacionId: 'o-iva' }] })]),
      { ...d, operadorId: 'sistema', desde: '2026-01-01' },
    );
    expect(r).toEqual({ creados: 1, actualizados: 0, obligaciones: 1, fallos: [] });
    expect(d.llamadas).toEqual([
      ['buscarPorRuc', '6256615-6'],
      ['crear', '001', '6256615-6'],
      ['actualizar', 'nuevo-001', { carpetaOneDriveId: 'id-001' }],
      ['obligacion', 'nuevo-001', 'o-iva', '2026-01-01'],
    ]);
    expect(d.eventos.map((e) => e.accion)).toEqual(['cliente.creado', 'cliente.actualizado']);
    expect(d.eventos[0]).toMatchObject({ usuarioId: 'sistema', datosDespues: { codigo: '001', via: 'scripts/alta-masiva-clientes.mjs' } });
  });

  it('si el RUC apareció en la base después de simular, no lo duplica', async () => {
    const d = dobles({ rucOcupado: '6256615-6' });
    const r = await aplicarPlan(planDe([crear('001', '6256615-6')]), { ...d, operadorId: 's', desde: null });
    expect(r.creados).toBe(0);
    expect(r.fallos[0].motivo).toMatch(/ya existe/);
    expect(d.llamadas.filter(([q]) => q !== 'buscarPorRuc')).toEqual([]);
  });

  it('si el código apareció en la base después de simular, no lo duplica', async () => {
    const d = dobles({ codigoOcupado: '001' });
    const r = await aplicarPlan(planDe([crear('001', '6256615-6')]), { ...d, operadorId: 's', desde: null });
    expect(r.creados).toBe(0);
    expect(r.fallos[0].motivo).toMatch(/ya existe un cliente con el código 001/);
    expect(d.llamadas).toEqual([]);
  });

  it('crea con el RUC pendiente (null) sin buscar un RUC que no existe, y lo deja en la bitácora', async () => {
    const d = dobles();
    const r = await aplicarPlan(planDe([crear('004', null)]), { ...d, operadorId: 's', desde: null });
    expect(r.creados).toBe(1);
    expect(d.llamadas).toEqual([
      ['crear', '004', null],
      ['actualizar', 'nuevo-004', { carpetaOneDriveId: 'id-004' }],
    ]);
    expect(d.eventos[0]).toMatchObject({ accion: 'cliente.creado', datosDespues: { codigo: '004', ruc: null } });
  });

  it('un fallo de red en un cliente no corta a los demás', async () => {
    const d = dobles({ fallaEn: '6256615-6' });
    const r = await aplicarPlan(planDe([crear('001', '6256615-6'), crear('003', '4416002-0')]), { ...d, operadorId: 's', desde: null });
    expect(r.creados).toBe(1);
    expect(r.fallos).toEqual([{ codigo: '001', motivo: 'Can\'t reach database server' }]);
  });

  it('una obligación que ya estaba (unicidad) se saltea sin fallar: repetir es seguro', async () => {
    const d = dobles();
    const r = await aplicarPlan(
      planDe([{ codigo: '021', nombre: 'COPESA', tipo: 'actualizar', existente: { id: 'cli-1' }, cambios: {}, obligaciones: [{ codigo: 'IVA_GENERAL', obligacionId: 'o-dup' }] }]),
      { ...d, operadorId: 's', desde: '2026-01-01' },
    );
    expect(r).toEqual({ creados: 0, actualizados: 0, obligaciones: 0, fallos: [] });
  });

  it('actualiza solo los campos planificados y guarda el valor anterior', async () => {
    const d = dobles();
    await aplicarPlan(
      planDe([{ codigo: '021', nombre: 'COPESA', tipo: 'actualizar', existente: { id: 'cli-1' }, cambios: { carpetaOneDriveId: 'id-021' }, obligaciones: [] }]),
      { ...d, operadorId: 's', desde: null },
    );
    expect(d.llamadas).toEqual([['actualizar', 'cli-1', { carpetaOneDriveId: 'id-021' }]]);
    expect(d.eventos[0]).toMatchObject({ accion: 'cliente.actualizado', datosAntes: { carpetaOneDriveId: null } });
  });

  it('no escribe nada para los bloqueados, las bajas ni los sin cambios', async () => {
    const d = dobles();
    const r = await aplicarPlan(
      planDe([{ tipo: 'bloqueado' }, { tipo: 'baja' }, { tipo: 'sin_cambios' }, { tipo: 'existente_sin_verificar' }]),
      { ...d, operadorId: 's', desde: null },
    );
    expect(r).toEqual({ creados: 0, actualizados: 0, obligaciones: 0, fallos: [] });
    expect(d.llamadas).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- */

describe('respaldo del día', () => {
  const sistema = (archivos) => ({
    readdirSync: () => Object.keys(archivos),
    statSync: (ruta) => ({ size: archivos[ruta.replace(/\\/g, '/').split('/').pop()].length }),
    readFileSync: (ruta) => archivos[ruta.replace(/\\/g, '/').split('/').pop()],
  });
  const valido = JSON.stringify({ generadoEn: 'x', modelos: { cliente: [] } });
  const ahora = new Date('2026-11-01T15:00:00.000Z'); // 12:00 en Asunción

  it('encuentra el respaldo de hoy', () => {
    const ruta = buscarRespaldoDelDia({ carpeta: 'respaldos', ahora, sistema: sistema({ 'respaldo-2026-11-01T14-30-55.json': valido }) });
    expect(ruta).toMatch(/respaldo-2026-11-01T14-30-55\.json$/);
  });

  it('uno de ayer no cuenta', () => {
    expect(buscarRespaldoDelDia({ carpeta: 'respaldos', ahora, sistema: sistema({ 'respaldo-2026-10-31T14-30-55.json': valido }) })).toBeNull();
  });

  it('uno vacío o ilegible no cuenta', () => {
    expect(
      buscarRespaldoDelDia({
        carpeta: 'respaldos',
        ahora,
        sistema: sistema({ 'respaldo-2026-11-01T10-00-00.json': '', 'respaldo-2026-11-01T11-00-00.json': '{roto' }),
      }),
    ).toBeNull();
  });

  it('sin carpeta de respaldos, no hay respaldo', () => {
    const roto = { readdirSync: () => { throw new Error('ENOENT'); }, statSync: () => null, readFileSync: () => '' };
    expect(buscarRespaldoDelDia({ carpeta: 'no-existe', ahora, sistema: roto })).toBeNull();
  });
});

/* ------------------------------------------------------------------------- */

describe('lectura de carpetas en Microsoft Graph (solo GET)', () => {
  const entorno = {
    AZURE_TENANT_ID: 'inquilino',
    AZURE_CLIENT_ID: 'cliente',
    AZURE_CLIENT_SECRET: 'SECRETO-QUE-NO-DEBE-VERSE',
    AZURE_DRIVE_ID_ORIGEN: 'drive-1',
  };
  const respuesta = (cuerpo, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo, headers: { get: () => null } });

  function graphFalso(paginas) {
    const llamadas = [];
    const fetch = async (url, opciones = {}) => {
      llamadas.push({ url, metodo: opciones.method ?? 'GET', cuerpo: String(opciones.body ?? '') });
      if (url.startsWith('https://login.microsoftonline.com/')) return respuesta({ access_token: 'tk', expires_in: 3600 });
      const siguiente = paginas.shift();
      return typeof siguiente === 'function' ? siguiente() : respuesta(siguiente);
    };
    return { fetch, llamadas };
  }

  it('lee las carpetas con su id, sigue la paginación y deja aparte las que no son clientes', async () => {
    const g = graphFalso([
      {
        value: [
          { id: 'a', name: '002 FUMIPRO S.A', folder: {} },
          { id: 'b', name: '999 CLIENTE MUESTRA', folder: {} },
          { id: 'c', name: 'ZZ DUPLICADOS PARA REVISAR', folder: {} },
          { id: 'd', name: 'suelto.pdf', file: {} },
        ],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/drives/drive-1/items/x/children?$skiptoken=2',
      },
      { value: [{ id: 'e', name: '021 COPESA', folder: {} }] },
    ]);

    const leido = await leerCarpetasDeGraph({ fetch: g.fetch, entorno });

    expect(leido.carpetas).toEqual([
      { codigo: '002', nombre: 'FUMIPRO S.A', carpeta: '002 FUMIPRO S.A', id: 'a' },
      { codigo: '021', nombre: 'COPESA', carpeta: '021 COPESA', id: 'e' },
    ]);
    expect(leido.ignoradas).toEqual(['999 CLIENTE MUESTRA', 'ZZ DUPLICADOS PARA REVISAR']);
  });

  /* REGLA 5: el OneDrive de EFFORT es de solo lectura. */
  it('a Graph solo le hace GET; el único POST es el del token, y el secreto nunca va en una URL', async () => {
    const g = graphFalso([{ value: [] }]);
    await leerCarpetasDeGraph({ fetch: g.fetch, entorno });

    const aGraph = g.llamadas.filter((l) => l.url.startsWith('https://graph.microsoft.com/'));
    const otras = g.llamadas.filter((l) => !l.url.startsWith('https://graph.microsoft.com/'));
    expect(aGraph.length).toBeGreaterThan(0);
    expect(aGraph.every((l) => l.metodo === 'GET')).toBe(true);
    expect(otras).toHaveLength(1);
    expect(otras[0]).toMatchObject({ metodo: 'POST' });
    expect(otras[0].url).toMatch(/^https:\/\/login\.microsoftonline\.com\/inquilino\/oauth2\/v2\.0\/token$/);
    expect(g.llamadas.every((l) => !l.url.includes('SECRETO'))).toBe(true);
  });

  it('no manda el token a un servidor que no sea Graph', async () => {
    const g = graphFalso([{ value: [], '@odata.nextLink': 'https://otro-servidor.example/robar' }]);
    await expect(leerCarpetasDeGraph({ fetch: g.fetch, entorno })).rejects.toThrow(/fuera de Microsoft Graph/);
    expect(g.llamadas.some((l) => l.url.includes('otro-servidor'))).toBe(false);
  });

  it('reintenta ante un 429 y el error no lleva el secreto', async () => {
    const g = graphFalso([() => respuesta({}, 429), { value: [{ id: 'a', name: '001 ELIAS', folder: {} }] }]);
    const leido = await leerCarpetasDeGraph({ fetch: g.fetch, entorno, esperar: async () => {} });
    expect(leido.carpetas).toHaveLength(1);

    const g2 = graphFalso([() => respuesta({}, 403)]);
    const error = await leerCarpetasDeGraph({ fetch: g2.fetch, entorno }).catch((e) => e);
    expect(error.message).toMatch(/HTTP 403/);
    expect(error.message).not.toMatch(/SECRETO|tk/);
  });

  it('sin credenciales avisa qué falta sin llamar a nadie', async () => {
    const g = graphFalso([]);
    const leer = crearLectorDeGraph({ fetch: g.fetch, entorno: {} });
    await expect(leer('/me')).rejects.toThrow(/AZURE_TENANT_ID/);
    expect(g.llamadas).toEqual([]);
  });

  it('interpretarCarpetas ignora archivos y códigos de cuatro cifras', () => {
    const { carpetas } = interpretarCarpetas([
      { id: '1', name: '1234 NO ES CODIGO', folder: {} },
      { id: '2', name: '045 DAVID ROMERO', folder: {} },
    ]);
    expect(carpetas.map((c) => c.codigo)).toEqual(['045']);
  });
});

/* ------------------------------------------------------------------------- */

describe('fuentes de carpetas y argumentos', () => {
  it('usa el archivo con ids si existe; si no, los nombres (sin ids)', () => {
    const conIds = cargarCarpetas({
      rutaIds: 'ids.json',
      rutaNombres: 'nombres.json',
      leer: (r) => (r === 'ids.json' ? JSON.stringify({ leidoEn: 'hoy', carpetas: [carpeta('001')] }) : '{}'),
    });
    expect(conIds).toMatchObject({ conIds: true, fuente: 'ids.json' });

    const soloNombres = cargarCarpetas({
      rutaIds: 'ids.json',
      rutaNombres: 'nombres.json',
      leer: (r) => {
        if (r === 'ids.json') throw new Error('ENOENT');
        return JSON.stringify({ fecha: 'f', clientes: [{ codigo: '001', nombre: 'ELIAS', carpeta: '001 ELIAS' }] });
      },
    });
    expect(soloNombres).toMatchObject({ conIds: false, carpetas: [{ codigo: '001', id: null }] });
  });

  it('sin archivo de ids usa el plan del ordenamiento antes que el inventario viejo', () => {
    const plan = [
      { cod: '002', cliente: '002 FUMIPRO S.A' },
      { cod: '002', cliente: '002 FUMIPRO S.A' },
      { cod: '114', cliente: '114  GERARDO SOSA' },
      { cod: '999', cliente: '999 CLIENTE MUESTRA' },
    ];
    const r = cargarCarpetas({
      rutaIds: 'ids.json',
      rutaPlan: 'plan.json',
      rutaNombres: 'nombres.json',
      leer: (ruta) => {
        if (ruta === 'plan.json') return JSON.stringify(plan);
        throw new Error('ENOENT');
      },
    });
    expect(r).toMatchObject({ conIds: false, fuente: 'plan.json' });
    expect(r.carpetas).toEqual([
      { codigo: '002', nombre: 'FUMIPRO S.A', carpeta: '002 FUMIPRO S.A', id: null },
      { codigo: '114', nombre: 'GERARDO SOSA', carpeta: '114  GERARDO SOSA', id: null },
    ]);
  });

  it('carpetasDelPlan: una por código, sin el 999 ni códigos que no sean de 3 cifras', () => {
    expect(carpetasDelPlan([{ cod: '1234', cliente: 'x' }, { cod: null }, { cod: '021', cliente: '021 COPESA' }])).toEqual([
      { codigo: '021', nombre: 'COPESA', carpeta: '021 COPESA', id: null },
    ]);
  });

  it('lee argumentos con valor y listas', () => {
    const argv = ['--codigos', '001,003', '--aplicar', '--desde', '2026-01-01'];
    expect(listaDeArgumento(argv, 'codigos')).toEqual(['001', '003']);
    expect(argumento(argv, 'desde')).toBe('2026-01-01');
    expect(argumento(['--desde', '--aplicar'], 'desde')).toBeNull();
  });
});
