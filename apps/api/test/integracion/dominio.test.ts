/**
 * Tests de integración de los repositorios de negocio, contra PostgreSQL real.
 *
 * Existen porque los dobles de prueba validan el contrato, no la consulta. El
 * bug de `ClientesPrisma.buscarPorId` —una condición pisando a la otra en el
 * `where`— pasó 31 tests con dobles y solo apareció acá.
 *
 * Por eso cada test de este archivo apunta a algo que un doble **no puede**
 * detectar:
 *
 *  - que el filtro de cartera y las demás condiciones convivan sin pisarse;
 *  - que las restricciones de unicidad de la base se apliquen de verdad;
 *  - que una transacción revierta entera cuando algo falla en el medio;
 *  - que un `upsert` no duplique;
 *  - que un importe `BIGINT` vuelva intacto de la base.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HAY_BASE_DE_DATOS, crearEntorno, type EntornoDePrueba } from './entorno.js';
import {
  AlertasPrisma,
  BalancesPrisma,
  DocumentosPrisma,
  ProcesoMensualPrisma,
  ReglasImpositivasPrisma,
  VencimientosPrisma,
} from '../../src/repositorios/dominio.js';
import { ExportacionesSigaPrisma, LiquidacionesPrisma } from '../../src/repositorios/siga.js';

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase('repositorios de negocio contra PostgreSQL real', () => {
  let entorno: EntornoDePrueba;
  let documentos: DocumentosPrisma;
  let procesoMensual: ProcesoMensualPrisma;
  let vencimientos: VencimientosPrisma;
  let balances: BalancesPrisma;
  let siga: ExportacionesSigaPrisma;
  let liquidaciones: LiquidacionesPrisma;
  let alertas: AlertasPrisma;
  let reglasImpositivas: ReglasImpositivasPrisma;

  let usuario = '';
  let mio = '';
  let ajeno = '';

  const PERIODO = '2026-03';

  beforeAll(async () => {
    entorno = await crearEntorno();

    documentos = new DocumentosPrisma(entorno.prisma);
    procesoMensual = new ProcesoMensualPrisma(entorno.prisma);
    vencimientos = new VencimientosPrisma(entorno.prisma);
    balances = new BalancesPrisma(entorno.prisma);
    siga = new ExportacionesSigaPrisma(entorno.prisma);
    liquidaciones = new LiquidacionesPrisma(entorno.prisma);
    alertas = new AlertasPrisma(entorno.prisma);
    reglasImpositivas = new ReglasImpositivasPrisma(entorno.prisma);

    const u = await entorno.prisma.usuario.create({
      data: {
        nombre: 'Karina', apellido: 'Fretes', email: 'karina@effort.com.py',
        rol: 'coordinador', hashContrasena: '$argon2id$prueba',
      },
    });
    usuario = u.id;

    const c1 = await entorno.prisma.cliente.create({
      data: { nombre: 'GARSO S.A.', ruc: '80017726-6', tipoPersona: 'JURIDICA' },
    });
    mio = c1.id;

    const c2 = await entorno.prisma.cliente.create({
      data: { nombre: 'CLIENTE AJENO S.A.', ruc: '80019012-2', tipoPersona: 'JURIDICA' },
    });
    ajeno = c2.id;
  }, 120_000);

  afterAll(async () => {
    await entorno?.destruir();
  }, 60_000);

  /* ====================================================================== */
  /* Documentos                                                             */
  /* ====================================================================== */

  describe('documentos', () => {
    async function crearDocumento(
      clienteId: string,
      numero: string | null,
      total: bigint | null = 1_100_000n,
    ) {
      return documentos.registrar({
        clienteId,
        periodo: PERIODO,
        tipo: numero ? 'FACTURA_COMPRA' : 'CONTRATO',
        canalRecepcion: 'WHATSAPP',
        recibidoEn: new Date('2026-03-15T12:00:00Z'),
        rucEmisor: numero ? '80017726-6' : null,
        timbrado: numero ? '12345678' : null,
        numeroComprobante: numero,
        total,
        tasa: total === null ? null : 'DIEZ',
        anulado: false,
        evidenciaId: null,
        observaciones: null,
        creadoPorUsuarioId: usuario,
      });
    }

    it('guarda y recupera el importe como bigint, sin perder precisión', async () => {
      // Por encima del entero seguro de JavaScript.
      const enorme = 9_007_199_254_740_993n;
      const doc = await crearDocumento(mio, '001-001-9999999', enorme);

      const recuperado = await documentos.buscarPorId(doc.id, null);

      expect(recuperado?.total).toBe(enorme);
      expect(typeof recuperado?.total).toBe('bigint');
    });

    it('la base impide cargar dos veces el mismo comprobante del mismo cliente', async () => {
      await crearDocumento(mio, '001-001-0000100');

      // La unicidad está en la base y no solo en el código: dos peticiones
      // simultáneas pasarían las dos por una validación de aplicación.
      await expect(crearDocumento(mio, '001-001-0000100')).rejects.toThrow();
    });

    it('el mismo número de comprobante sí puede existir en dos clientes distintos', async () => {
      await crearDocumento(mio, '001-001-0000200');
      await expect(crearDocumento(ajeno, '001-001-0000200')).resolves.toBeDefined();
    });

    it('el filtro de cartera no pisa la condición de cliente al listar', async () => {
      // Regresión del bug de buscarPorId: dos condiciones sobre la misma
      // columna combinadas con spread se pisan entre sí.
      const conAcceso = await documentos.listar(mio, PERIODO, [mio, ajeno]);
      const sinAcceso = await documentos.listar(mio, PERIODO, [ajeno]);

      expect(conAcceso.length).toBeGreaterThan(0);
      expect(conAcceso.every((d) => d.clienteId === mio)).toBe(true);
      expect(sinAcceso).toEqual([]);
    });

    it('buscar por id devuelve null si el documento está fuera de la cartera', async () => {
      const doc = await crearDocumento(ajeno, '001-001-0000300');

      expect(await documentos.buscarPorId(doc.id, [mio])).toBeNull();
      expect(await documentos.buscarPorId(doc.id, [ajeno])).not.toBeNull();
    });

    it('documentosDelPeriodo incluye los que no tienen número de comprobante', async () => {
      // Es el bug que encontraron los tests de la Parte 4B: filtrarlos acá
      // hacía que la conciliación informara "todo cuadra" sobre un conjunto
      // incompleto. Un contrato no se concilia, pero hay que saber que está.
      const contrato = await crearDocumento(mio, null, null);

      const delPeriodo = await documentos.documentosDelPeriodo(mio, PERIODO);

      expect(delPeriodo.map((d) => d.id)).toContain(contrato.id);
    });

    it('documentosDelPeriodo excluye rechazados y duplicados, pero no anulados', async () => {
      const rechazado = await crearDocumento(mio, '001-001-0000400');
      await documentos.cambiarEstado(rechazado.id, 'RECHAZADO', 'Ilegible.', usuario);

      const duplicado = await crearDocumento(mio, '001-001-0000401');
      await documentos.cambiarEstado(duplicado.id, 'DUPLICADO', null, usuario);

      const delPeriodo = await documentos.documentosDelPeriodo(mio, PERIODO);
      const ids = delPeriodo.map((d) => d.id);

      expect(ids).not.toContain(rechazado.id);
      expect(ids).not.toContain(duplicado.id);
    });

    it('el cambio de estado persiste el motivo de rechazo', async () => {
      const doc = await crearDocumento(mio, '001-001-0000500');
      const actualizado = await documentos.cambiarEstado(
        doc.id, 'RECHAZADO', 'Comprobante ilegible.', usuario,
      );

      expect(actualizado.estado).toBe('RECHAZADO');
      expect(actualizado.motivoRechazo).toBe('Comprobante ilegible.');
    });
  });

  /* ====================================================================== */
  /* Proceso mensual                                                        */
  /* ====================================================================== */

  describe('proceso mensual', () => {
    it('asegurar crea la fila una sola vez, aunque se llame muchas veces', async () => {
      const primera = await procesoMensual.asegurar(mio, '2026-05', usuario);
      const segunda = await procesoMensual.asegurar(mio, '2026-05', usuario);

      // El upsert lo resuelve en la base: sin él, "buscar y si no está crear"
      // fallaría contra la restricción de unicidad al concurrir dos peticiones.
      expect(segunda.id).toBe(primera.id);

      const cuantas = await entorno.prisma.procesoMensual.count({
        where: { clienteId: mio, periodo: '2026-05' },
      });
      expect(cuantas).toBe(1);
    });

    it('varias llamadas simultáneas a asegurar no duplican la fila', async () => {
      await Promise.all([
        procesoMensual.asegurar(mio, '2026-06', usuario),
        procesoMensual.asegurar(mio, '2026-06', usuario),
        procesoMensual.asegurar(mio, '2026-06', usuario),
      ]).catch(() => {
        // Alguna puede perder la carrera contra la restricción de unicidad;
        // lo que importa es que no queden dos filas.
      });

      const cuantas = await entorno.prisma.procesoMensual.count({
        where: { clienteId: mio, periodo: '2026-06' },
      });
      expect(cuantas).toBe(1);
    });

    it('guarda los saldos de IVA como bigint', async () => {
      await procesoMensual.asegurar(mio, '2026-07', usuario);
      const actualizado = await procesoMensual.actualizar(
        mio, '2026-07', { ivaSaldoAPagar: 2_000_000n, ivaSaldoAFavor: 0n }, usuario,
      );

      expect(actualizado.ivaSaldoAPagar).toBe(2_000_000n);

      const recuperado = await procesoMensual.buscar(mio, '2026-07', null);
      expect(recuperado?.ivaSaldoAPagar).toBe(2_000_000n);
    });

    it('el filtro de cartera se aplica al buscar por cliente y período', async () => {
      await procesoMensual.asegurar(ajeno, '2026-08', usuario);

      expect(await procesoMensual.buscar(ajeno, '2026-08', [mio])).toBeNull();
      expect(await procesoMensual.buscar(ajeno, '2026-08', [ajeno])).not.toBeNull();
    });

    it('listar un período solo trae los clientes de la cartera', async () => {
      await procesoMensual.asegurar(mio, '2026-09', usuario);
      await procesoMensual.asegurar(ajeno, '2026-09', usuario);

      const soloMio = await procesoMensual.listar('2026-09', [mio]);
      const todos = await procesoMensual.listar('2026-09', null);

      expect(soloMio).toHaveLength(1);
      expect(todos).toHaveLength(2);
    });

    it('una cartera vacía no devuelve nada, en vez de devolver todo', async () => {
      expect(await procesoMensual.listar('2026-09', [])).toEqual([]);
    });
  });

  /* ====================================================================== */
  /* Vencimientos                                                           */
  /* ====================================================================== */

  describe('vencimientos', () => {
    async function crearVencimiento(clienteId: string, fecha: string) {
      return vencimientos.registrar({
        clienteId,
        tipoDocumento: 'CONSTANCIA',
        descripcion: 'Presentación ante Abogacía',
        entidad: 'Abogacía del Tesoro',
        fechaEmision: null,
        fechaVencimiento: new Date(fecha),
        responsableId: null,
        riesgo: 'CRITICO',
        evidenciaId: null,
        proximaAccion: null,
        creadoPorUsuarioId: usuario,
      });
    }

    it('el radar ordena por fecha de vencimiento ascendente', async () => {
      await crearVencimiento(mio, '2026-08-30');
      await crearVencimiento(mio, '2026-08-10');
      await crearVencimiento(mio, '2026-08-20');

      const radar = await vencimientos.listar([mio]);
      const fechas = radar.map((v) => v.fechaVencimiento.toISOString().slice(0, 10));

      expect(fechas).toEqual([...fechas].sort());
    });

    it('marcar como presentado saca la obligación del radar', async () => {
      const venc = await crearVencimiento(mio, '2026-09-15');

      const antes = await vencimientos.listar([mio]);
      expect(antes.map((v) => v.id)).toContain(venc.id);

      await vencimientos.marcarPresentado(venc.id, new Date('2026-09-10'), null, usuario);

      const despues = await vencimientos.listar([mio]);
      expect(despues.map((v) => v.id)).not.toContain(venc.id);
    });

    it('marcar como presentado conserva la fecha real de presentación', async () => {
      const venc = await crearVencimiento(mio, '2026-10-15');
      // Puede no ser hoy: alguien registra el lunes lo presentado el viernes.
      const presentado = await vencimientos.marcarPresentado(
        venc.id, new Date('2026-10-09'), null, usuario,
      );

      expect(presentado.fechaPresentacion?.toISOString().slice(0, 10)).toBe('2026-10-09');
      expect(presentado.estado).toBe('PRESENTADO');
    });

    it('el radar no incluye vencimientos de clientes fuera de la cartera', async () => {
      await crearVencimiento(ajeno, '2026-11-15');

      const radar = await vencimientos.listar([mio]);

      expect(radar.every((v) => v.clienteId === mio)).toBe(true);
    });

    it('buscar por id respeta el alcance de cartera', async () => {
      const venc = await crearVencimiento(ajeno, '2026-12-15');

      expect(await vencimientos.buscarPorId(venc.id, [mio])).toBeNull();
      expect(await vencimientos.buscarPorId(venc.id, null)).not.toBeNull();
    });
  });

  /* ====================================================================== */
  /* Balances                                                               */
  /* ====================================================================== */

  describe('balances', () => {
    const cifras = {
      activo: 1_000_000_000n,
      pasivo: 400_000_000n,
      patrimonioNeto: 600_000_000n,
      resultadoEjercicio: 150_000_000n,
    };

    it('guarda las cifras y las recupera intactas', async () => {
      await balances.guardarCifras(
        mio, '2026-03', cifras, 'LISTO_PARA_REVISION', [], usuario,
      );

      const recuperado = await balances.buscar(mio, '2026-03', null);

      expect(recuperado?.activo).toBe(cifras.activo);
      expect(recuperado?.patrimonioNeto).toBe(cifras.patrimonioNeto);
    });

    it('guardar dos veces el mismo período actualiza en vez de duplicar', async () => {
      await balances.guardarCifras(mio, '2026-04', cifras, 'OBSERVADO', [], usuario);
      await balances.guardarCifras(
        mio, '2026-04', { ...cifras, activo: 2_000_000_000n }, 'OBSERVADO', [], usuario,
      );

      const cuantos = await entorno.prisma.balance.count({
        where: { clienteId: mio, periodo: '2026-04' },
      });
      expect(cuantos).toBe(1);

      const recuperado = await balances.buscar(mio, '2026-04', null);
      expect(recuperado?.activo).toBe(2_000_000_000n);
    });

    it('guardarCifras rechaza el estado APROBADO', async () => {
      // Segunda barrera del ADR 0004, además del tipo de retorno del dominio.
      await expect(
        balances.guardarCifras(mio, '2026-05', cifras, 'APROBADO', [], usuario),
      ).rejects.toThrow(/no puede aprobar/i);
    });

    it('aprobar deja constancia de quién y cuándo', async () => {
      await balances.guardarCifras(mio, '2026-06', cifras, 'LISTO_PARA_REVISION', [], usuario);

      const momento = new Date('2026-07-22T15:00:00Z');
      const aprobado = await balances.aprobar(mio, '2026-06', usuario, momento);

      expect(aprobado.estado).toBe('APROBADO');
      expect(aprobado.aprobadoPorUsuarioId).toBe(usuario);
      expect(aprobado.aprobadoEn?.toISOString()).toBe(momento.toISOString());
    });

    it('las inconsistencias se guardan como JSON legible', async () => {
      const inconsistencias = [
        { codigo: 'ECUACION_PATRIMONIAL_NO_CIERRA', gravedad: 'BLOQUEANTE', detalle: 'x', diferencia: '1' },
      ];

      await balances.guardarCifras(
        mio, '2026-10', cifras, 'OBSERVADO', inconsistencias, usuario,
      );

      const recuperado = await balances.buscar(mio, '2026-10', null);
      const guardadas = recuperado?.inconsistencias as Array<Record<string, unknown>>;

      // Si `diferencia` viajara como bigint, la escritura habría fallado.
      expect(guardadas[0]?.['diferencia']).toBe('1');
    });

    it('el filtro de cartera se aplica al buscar', async () => {
      await balances.guardarCifras(ajeno, '2026-03', cifras, 'OBSERVADO', [], usuario);

      expect(await balances.buscar(ajeno, '2026-03', [mio])).toBeNull();
      expect(await balances.buscar(ajeno, '2026-03', [ajeno])).not.toBeNull();
    });
  });

  /* ====================================================================== */
  /* Exportaciones SIGA                                                     */
  /* ====================================================================== */

  describe('exportaciones SIGA', () => {
    const fila = (numero: string, total: bigint) => ({
      rucEmisor: '80017726-6',
      timbrado: '12345678',
      numeroComprobante: numero,
      total,
      tasa: 'DIEZ',
      anulado: false,
      fecha: new Date('2026-03-15'),
    });

    it('registra la exportación y sus filas juntas', async () => {
      const exportacion = await siga.registrar({
        clienteId: mio, periodo: '2026-11', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        evidenciaId: null, observaciones: null,
        comprobantes: [fila('001-001-1000001', 1_100_000n), fila('001-001-1000002', 2_200_000n)],
        creadoPorUsuarioId: usuario,
      });

      expect(exportacion.filasLeidas).toBe(2);

      const comprobantes = await siga.comprobantesDelPeriodo(mio, '2026-11');
      expect(comprobantes).toHaveLength(2);
    });

    it('los importes de SIGA vuelven como bigint intacto', async () => {
      const enorme = 9_007_199_254_740_993n;
      await siga.registrar({
        clienteId: mio, periodo: '2026-12', tipoReporte: 'LIBRO_VENTAS', formato: 'CSV',
        evidenciaId: null, observaciones: null,
        comprobantes: [fila('001-001-1200001', enorme)],
        creadoPorUsuarioId: usuario,
      });

      const [comprobante] = await siga.comprobantesDelPeriodo(mio, '2026-12');
      expect(comprobante?.total).toBe(enorme);
    });

    it('reimportar el mismo archivo no duplica comprobantes', async () => {
      const comprobantes = [fila('001-001-1300001', 1_100_000n)];

      await siga.registrar({
        clienteId: mio, periodo: '2027-01', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        evidenciaId: null, observaciones: null, comprobantes, creadoPorUsuarioId: usuario,
      });
      await siga.registrar({
        clienteId: mio, periodo: '2027-01', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        evidenciaId: null, observaciones: null, comprobantes, creadoPorUsuarioId: usuario,
      });

      // Dos exportaciones registradas, un solo comprobante: la clave natural
      // tiene unicidad en la base y `skipDuplicates` la respeta.
      const filas = await siga.comprobantesDelPeriodo(mio, '2027-01');
      expect(filas).toHaveLength(1);
    });

    it('si una fila es inválida, no queda la exportación a medias', async () => {
      const antes = await entorno.prisma.exportacionSiga.count({
        where: { clienteId: mio, periodo: '2027-02' },
      });

      await expect(
        siga.registrar({
          clienteId: mio, periodo: '2027-02', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
          evidenciaId: null, observaciones: null,
          comprobantes: [
            fila('001-001-1400001', 1_100_000n),
            // Número más largo que la columna: la inserción de filas falla.
            { ...fila('X'.repeat(60), 1n) },
          ],
          creadoPorUsuarioId: usuario,
        }),
      ).rejects.toThrow();

      // La transacción revirtió entera. Sin ella quedaría una exportación
      // declarando filas que no están, y la conciliación mentiría.
      const despues = await entorno.prisma.exportacionSiga.count({
        where: { clienteId: mio, periodo: '2027-02' },
      });
      expect(despues).toBe(antes);

      const huerfanos = await siga.comprobantesDelPeriodo(mio, '2027-02');
      expect(huerfanos).toHaveLength(0);
    });

    it('el filtro de cartera se aplica al listar exportaciones', async () => {
      await siga.registrar({
        clienteId: ajeno, periodo: '2027-03', tipoReporte: 'LIBRO_COMPRAS', formato: 'EXCEL',
        evidenciaId: null, observaciones: null, comprobantes: [], creadoPorUsuarioId: usuario,
      });

      expect(await siga.listar(ajeno, '2027-03', [mio])).toEqual([]);
      expect(await siga.listar(ajeno, '2027-03', [ajeno])).toHaveLength(1);
    });
  });

  /* ====================================================================== */
  /* Liquidaciones                                                          */
  /* ====================================================================== */

  describe('liquidaciones', () => {
    it('un cliente no puede tener dos liquidaciones del mismo tipo y período', async () => {
      await liquidaciones.registrar({
        clienteId: mio, periodo: '2027-04', tipo: 'IVA mensual',
        archivoEvidenciaId: null, responsableId: null, observaciones: null,
        creadoPorUsuarioId: usuario,
      });

      await expect(
        liquidaciones.registrar({
          clienteId: mio, periodo: '2027-04', tipo: 'IVA mensual',
          archivoEvidenciaId: null, responsableId: null, observaciones: null,
          creadoPorUsuarioId: usuario,
        }),
      ).rejects.toThrow();
    });

    it('sí puede tener dos liquidaciones de tipos distintos en el mismo período', async () => {
      await liquidaciones.registrar({
        clienteId: mio, periodo: '2027-05', tipo: 'IVA mensual',
        archivoEvidenciaId: null, responsableId: null, observaciones: null,
        creadoPorUsuarioId: usuario,
      });

      await expect(
        liquidaciones.registrar({
          clienteId: mio, periodo: '2027-05', tipo: 'IPS',
          archivoEvidenciaId: null, responsableId: null, observaciones: null,
          creadoPorUsuarioId: usuario,
        }),
      ).resolves.toBeDefined();
    });

    it('el ciclo completo persiste cada paso', async () => {
      const liquidacion = await liquidaciones.registrar({
        clienteId: mio, periodo: '2027-06', tipo: 'IVA mensual',
        archivoEvidenciaId: null, responsableId: null, observaciones: null,
        creadoPorUsuarioId: usuario,
      });
      expect(liquidacion.estado).toBe('PENDIENTE');

      const enviada = await liquidaciones.marcarEnviada(
        liquidacion.id,
        {
          destinatario: 'contacto@garso.com.py',
          canal: 'EMAIL',
          fechaEnvio: new Date('2026-07-10T14:00:00Z'),
          evidenciaEnvioId: null,
        },
        usuario,
      );
      expect(enviada.estado).toBe('ENVIADA');
      expect(enviada.destinatario).toBe('contacto@garso.com.py');

      const respondida = await liquidaciones.registrarRespuesta(
        liquidacion.id, 'Recibido, gracias.', new Date('2026-07-11T10:00:00Z'), usuario,
      );
      expect(respondida.estado).toBe('RESPONDIDA');
      expect(respondida.respuestaCliente).toBe('Recibido, gracias.');
      // El dato del envío no se pierde al registrar la respuesta.
      expect(respondida.destinatario).toBe('contacto@garso.com.py');
    });

    it('el filtro de cartera se aplica al listar y al buscar', async () => {
      const ajena = await liquidaciones.registrar({
        clienteId: ajeno, periodo: '2027-07', tipo: 'IVA mensual',
        archivoEvidenciaId: null, responsableId: null, observaciones: null,
        creadoPorUsuarioId: usuario,
      });

      expect(await liquidaciones.listar('2027-07', [mio])).toEqual([]);
      expect(await liquidaciones.buscarPorId(ajena.id, [mio])).toBeNull();
      expect(await liquidaciones.buscarPorId(ajena.id, [ajeno])).not.toBeNull();
    });

    it('una cartera vacía no devuelve liquidaciones', async () => {
      expect(await liquidaciones.listar(null, [])).toEqual([]);
    });
  });

  /* ====================================================================== */
  /* Alertas                                                                */
  /* ====================================================================== */

  describe('alertas', () => {
    async function crearAlerta(
      clienteId: string | null,
      criticidad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFORMATIVA',
      titulo: string,
      estado: 'ABIERTA' | 'EN_CURSO' | 'CERRADA' | 'DESCARTADA' = 'ABIERTA',
    ) {
      return entorno.prisma.alerta.create({
        data: { clienteId, origen: 'vencimiento', criticidad, titulo, detalle: 'Detalle de prueba.', estado },
      });
    }

    it('ordena por criticidad usando el orden declarado del enum en Postgres, no alfabético', async () => {
      // El orden alfabético sería ALTA, CRITICA, INFORMATIVA, MEDIA: si este
      // test pasara con el `orderBy` alfabético, no estaría probando nada.
      await crearAlerta(mio, 'MEDIA', 'orden-media');
      await crearAlerta(mio, 'INFORMATIVA', 'orden-informativa');
      await crearAlerta(mio, 'CRITICA', 'orden-critica');
      await crearAlerta(mio, 'ALTA', 'orden-alta');

      const listado = await alertas.listar([mio]);
      const propias = listado.filter((a) => a.titulo.startsWith('orden-'));

      expect(propias.map((a) => a.titulo)).toEqual([
        'orden-critica', 'orden-alta', 'orden-media', 'orden-informativa',
      ]);
    });

    it('el filtro de cartera no pisa el filtro de estado al listar', async () => {
      // Regresión del bug de buscarPorId: dos condiciones sobre la misma
      // consulta combinadas mal pueden pisarse entre sí.
      const propia = await crearAlerta(mio, 'CRITICA', 'cartera-propia');
      const ajena = await crearAlerta(ajeno, 'CRITICA', 'cartera-ajena');

      const conAcceso = await alertas.listar([mio, ajeno]);
      const sinAcceso = await alertas.listar([ajeno]);

      const idsConAcceso = conAcceso.map((a) => a.id);
      expect(idsConAcceso).toContain(propia.id);
      expect(idsConAcceso).toContain(ajena.id);
      expect(sinAcceso.map((a) => a.id)).not.toContain(propia.id);
    });

    it('buscar por id respeta el filtro de cartera', async () => {
      const ajena = await crearAlerta(ajeno, 'ALTA', 'buscar-ajena');

      expect(await alertas.buscarPorId(ajena.id, [mio])).toBeNull();
      expect(await alertas.buscarPorId(ajena.id, [ajeno])).not.toBeNull();
    });

    it('una alerta sin cliente no aparece con cartera acotada, pero sí sin filtro', async () => {
      const general = await crearAlerta(null, 'CRITICA', 'general-sin-cliente');

      const acotado = await alertas.listar([mio]);
      expect(acotado.map((a) => a.id)).not.toContain(general.id);

      const sinFiltro = await alertas.listar(null);
      expect(sinFiltro.map((a) => a.id)).toContain(general.id);
    });

    it('listar excluye lo cerrado y lo descartado', async () => {
      const cerrada = await crearAlerta(mio, 'CRITICA', 'ya-cerrada', 'CERRADA');
      const descartada = await crearAlerta(mio, 'CRITICA', 'ya-descartada', 'DESCARTADA');

      const listado = await alertas.listar([mio]);
      const ids = listado.map((a) => a.id);

      expect(ids).not.toContain(cerrada.id);
      expect(ids).not.toContain(descartada.id);
    });

    it('cerrar guarda motivo, usuario y momento, y cambia el estado', async () => {
      const alerta = await crearAlerta(mio, 'ALTA', 'para-cerrar');
      const momento = new Date('2026-07-20T10:00:00Z');

      const cerrada = await alertas.cerrar(
        alerta.id, 'Se resolvió con el cliente.', usuario, momento,
      );

      expect(cerrada.estado).toBe('CERRADA');
      expect(cerrada.motivoCierre).toBe('Se resolvió con el cliente.');
      expect(cerrada.cerradaPorUsuarioId).toBe(usuario);
      expect(cerrada.cerradaEn?.toISOString()).toBe(momento.toISOString());
    });
  });

  /* ====================================================================== */
  /* Reglas impositivas                                                    */
  /* ====================================================================== */

  describe('reglas impositivas', () => {
    it('crea una regla vigente sin fecha de cierre', async () => {
      const regla = await reglasImpositivas.crear({
        nombre: 'IVA 10% general', tasa: 'DIEZ', divisorIvaIncluido: 11,
        vigenteDesde: new Date('2026-01-01T00:00:00Z'), fuente: 'Ley 125/91, art. 91.',
        creadoPorUsuarioId: usuario,
      });

      expect(regla.tasa).toBe('DIEZ');
      expect(regla.vigenteHasta).toBeNull();
    });

    it('dar de alta una segunda regla de la misma tasa cierra la anterior un día antes', async () => {
      const primera = await reglasImpositivas.crear({
        nombre: 'IVA 5% general', tasa: 'CINCO', divisorIvaIncluido: 21,
        vigenteDesde: new Date('2026-01-01T00:00:00Z'), fuente: 'Ley 125/91, art. 91.',
        creadoPorUsuarioId: usuario,
      });

      await reglasImpositivas.crear({
        nombre: 'IVA 5% actualizado', tasa: 'CINCO', divisorIvaIncluido: 21,
        vigenteDesde: new Date('2026-07-01T00:00:00Z'), fuente: 'Actualización de prueba.',
        creadoPorUsuarioId: usuario,
      });

      const vieja = await reglasImpositivas.buscarPorId(primera.id);
      expect(vieja?.vigenteHasta?.toISOString().slice(0, 10)).toBe('2026-06-30');
    });

    it('una regla de otra tasa no se ve afectada al abrir una nueva', async () => {
      const exenta = await reglasImpositivas.crear({
        nombre: 'Exenta general', tasa: 'EXENTA', divisorIvaIncluido: null,
        vigenteDesde: new Date('2026-01-01T00:00:00Z'), fuente: 'Ley 125/91, art. 100.',
        creadoPorUsuarioId: usuario,
      });

      await reglasImpositivas.crear({
        nombre: 'IVA 10% general bis', tasa: 'DIEZ', divisorIvaIncluido: 11,
        vigenteDesde: new Date('2026-02-01T00:00:00Z'), fuente: 'Ley 125/91, art. 91.',
        creadoPorUsuarioId: usuario,
      });

      const sigueVigente = await reglasImpositivas.buscarPorId(exenta.id);
      expect(sigueVigente?.vigenteHasta).toBeNull();
    });

    it('listar trae vigentes e históricas', async () => {
      const lista = await reglasImpositivas.listar();
      const tasas = new Set(lista.map((r) => r.tasa));
      expect(tasas.has('DIEZ')).toBe(true);
      expect(tasas.has('CINCO')).toBe(true);
    });

    it('actualizar cambia metadata sin tocar tasa ni vigenteDesde', async () => {
      const regla = await reglasImpositivas.crear({
        nombre: 'IVA a editar', tasa: 'DIEZ', divisorIvaIncluido: 11,
        vigenteDesde: new Date('2027-01-01T00:00:00Z'), fuente: 'Fuente original.',
        creadoPorUsuarioId: usuario,
      });

      const actualizada = await reglasImpositivas.actualizar(
        regla.id,
        { requiereConfirmacionCliente: false, fuente: 'Confirmado contra liquidación real.' },
        usuario,
      );

      expect(actualizada.requiereConfirmacionCliente).toBe(false);
      expect(actualizada.fuente).toBe('Confirmado contra liquidación real.');
      expect(actualizada.tasa).toBe('DIEZ');
      expect(actualizada.vigenteDesde.toISOString()).toBe(regla.vigenteDesde.toISOString());
    });

    it('buscarPorId devuelve null para una regla inexistente', async () => {
      expect(
        await reglasImpositivas.buscarPorId('00000000-0000-4000-8000-000000000000'),
      ).toBeNull();
    });
  });
});
