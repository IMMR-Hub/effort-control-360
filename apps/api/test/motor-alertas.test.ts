/**
 * Motor de alertas.
 *
 * Lo que importa acá: que levante lo que hay que levantar, que NO levante lo
 * que todavía no urge, y sobre todo que correrlo muchas veces no llene la
 * pantalla con la misma alerta repetida — porque el plan es que corra solo
 * cada 15 minutos, y una pantalla con la misma alerta cien veces es una
 * pantalla que nadie mira.
 */

import { describe, expect, it } from 'vitest';

import {
  evaluarAlertas,
  ORIGEN_DOCUMENTACION,
  ORIGEN_LIBRO_RIESGO,
  ORIGEN_DECLARACION_AJENA,
  ORIGEN_VENCIMIENTO,
  type DeclaracionAjena,
  type RiesgoDeLibroPorPeriodo,
} from '../src/servicios/motorDeAlertas.js';
import { AlertasFalsas, ProcesoMensualFalso, VencimientosFalsos } from './dobles-dominio.js';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
/*
 * La liquidación del período es la entidad con la que se relaciona la alerta.
 * Es un UUID de verdad a propósito: `entidad_relacionada_id` es una columna
 * UUID, y la primera versión armó una clave compuesta `clienteId|periodo` que
 * Postgres rechazó. El doble no valida el tipo y no lo agarró — solo lo vio la
 * base real. Usar un UUID acá hace que el test se parezca a la realidad.
 */
const LIQUIDACION = '22222222-2222-4222-8222-222222222222';
/** Reloj congelado: los días restantes tienen que ser deterministas. */
const HOY = new Date('2026-04-21T13:00:00Z');

function armar(
  riesgos: readonly RiesgoDeLibroPorPeriodo[] = [],
  ajenas: readonly DeclaracionAjena[] | null = [],
) {
  return {
    alertas: new AlertasFalsas(),
    vencimientos: new VencimientosFalsos(),
    procesoMensual: new ProcesoMensualFalso(),
    riesgoDeLibro: { porPeriodo: async () => riesgos },
    // `null` simula que el módulo no está conectado, que no es lo mismo que
    // "está conectado y no encontró nada".
    declaracionesAjenas: ajenas === null ? undefined : { listar: async () => ajenas },
  };
}

async function agregarVencimiento(deps: ReturnType<typeof armar>, fechaIso: string) {
  return deps.vencimientos.registrar({
    clienteId: CLIENTE,
    tipoDocumento: 'IVA_GENERAL',
    descripcion: 'IVA General — período 2026-03',
    entidad: 'DNIT',
    fechaEmision: null,
    fechaVencimiento: new Date(`${fechaIso}T00:00:00Z`),
    responsableId: null,
    riesgo: 'MEDIO',
    evidenciaId: null,
    proximaAccion: null,
    creadoPorUsuarioId: 'usr-1',
  });
}

describe('motor de alertas', () => {
  it('levanta una alerta crítica por un vencimiento ya vencido sin presentar', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-13');

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(1);
    const alerta = deps.alertas.alertas[0]!;
    expect(alerta.criticidad).toBe('CRITICA');
    expect(alerta.origen).toBe(ORIGEN_VENCIMIENTO);
    expect(alerta.titulo).toMatch(/Vencido sin presentar/);
  });

  it('no avisa de algo que vence dentro de mucho: sería ruido que tapa lo urgente', async () => {
    const deps = armar();
    // Faltan más de 30 días.
    await agregarVencimiento(deps, '2026-07-15');

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(0);
    expect(deps.alertas.alertas).toHaveLength(0);
  });

  it('la criticidad sigue los mismos umbrales que el radar de vencimientos', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-22'); // falta 1 día → CRITICA
    await agregarVencimiento(deps, '2026-04-27'); // faltan 6 → ALTA
    await agregarVencimiento(deps, '2026-05-05'); // faltan 14 → MEDIA

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    const criticidades = deps.alertas.alertas.map((a) => a.criticidad).sort();
    expect(criticidades).toEqual(['ALTA', 'CRITICA', 'MEDIA']);
  });

  // El caso que justifica el índice único de la base: el motor está pensado
  // para correr solo cada 15 minutos.
  it('correrlo muchas veces no repite la alerta', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-13');

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    const tercera = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.creadas).toBe(0);
    expect(tercera.creadas).toBe(0);
    expect(segunda.yaEstabanAbiertas).toBe(1);
    expect(deps.alertas.alertas).toHaveLength(1);
  });

  it('avisa de la documentación faltante del período', async () => {
    const deps = armar();
    const proceso = await deps.procesoMensual.asegurar(CLIENTE, '2026-03', 'usr-1');
    await deps.procesoMensual.actualizar(
      CLIENTE,
      '2026-03',
      { ...proceso, documentosFaltantes: 3 } as never,
      'usr-1',
    );

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(1);
    expect(deps.alertas.alertas[0]!.origen).toBe(ORIGEN_DOCUMENTACION);
    expect(deps.alertas.alertas[0]!.titulo).toMatch(/Faltan 3 documentos/);
  });

  /**
   * La regla que pidió Daniel el 2026-09-11, textual: "en NINGÚN punto el
   * sistema puede ignorarlas". No hay forma de descartar una alerta; la única
   * manera de que salga de la pantalla es que el problema deje de existir.
   * Acá se comprueba el otro lado de eso: cuando el vencimiento queda
   * presentado, la alerta se cierra sola.
   */
  it('al presentar el vencimiento, la alerta se cierra sola', async () => {
    const deps = armar();
    const vencimiento = await agregarVencimiento(deps, '2026-04-13');
    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    expect(deps.alertas.alertas[0]!.estado).toBe('ABIERTA');

    await deps.vencimientos.marcarPresentado(vencimiento.id, new Date('2026-04-12'), null, 'usr-1');
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.resueltas).toBe(1);
    expect(deps.alertas.alertas[0]!.estado).toBe('CERRADA');
    expect(deps.alertas.alertas[0]!.motivoCierre).toMatch(/ya no existe/);
  });

  it('mientras el problema siga, la alerta NO se cierra sola', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-13');

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.resueltas).toBe(0);
    expect(deps.alertas.alertas[0]!.estado).toBe('ABIERTA');
  });

  it('al cargarse los documentos faltantes, esa alerta también se cierra sola', async () => {
    const deps = armar();
    const proceso = await deps.procesoMensual.asegurar(CLIENTE, '2026-03', 'usr-1');
    await deps.procesoMensual.actualizar(
      CLIENTE, '2026-03', { ...proceso, documentosFaltantes: 3 } as never, 'usr-1',
    );
    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    // Los cargaron: ya no falta ninguno.
    await deps.procesoMensual.actualizar(
      CLIENTE, '2026-03', { ...proceso, documentosFaltantes: 0 } as never, 'usr-1',
    );
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.resueltas).toBe(1);
    expect(deps.alertas.alertas[0]!.estado).toBe('CERRADA');
  });

  it('un período sin faltantes no genera nada', async () => {
    const deps = armar();
    await deps.procesoMensual.asegurar(CLIENTE, '2026-03', 'usr-1');

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(0);
  });

  /*
   * Lo que pidió Daniel el 2026-09-13: "estas discrepancias también tienen que
   * alertar ya que al final puede representar una multa administrativa".
   *
   * El monto en juego es chico —decenas de guaraníes en todo el piloto— y por
   * eso el aviso explica por qué importa igual: la DNIT cruza estos datos contra
   * los del proveedor, y una diferencia dispara una revisión que cuesta mucho
   * más que la diferencia.
   */
  /*
   * Desde la tarea 141 se calculan libros de 2022 en adelante: sin un límite,
   * cada diferencia vieja abría una alerta CRITICA (y un correo).
   */
  it('no alerta sobre libros anteriores al período vigilado', async () => {
    const deps = armar([
      { clienteId: CLIENTE, periodo: '2023-06', liquidacionId: LIQUIDACION, comprobantes: 4, ivaEnRiesgo: 9n },
    ]);

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(0);
    expect(deps.alertas.alertas).toEqual([]);
  });

  it('una alerta de libro vieja que ya estaba abierta se cierra diciendo por qué, sin afirmar que se resolvió', async () => {
    const deps = armar([]);
    await deps.alertas.crear([
      {
        clienteId: CLIENTE,
        periodo: '2023-06',
        origen: ORIGEN_LIBRO_RIESGO,
        criticidad: 'CRITICA',
        titulo: 'viejo',
        detalle: 'viejo',
        entidadRelacionada: 'liquidacion_iva_rg90',
        entidadRelacionadaId: LIQUIDACION,
        fechaLimite: null,
      },
    ]);

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.resueltas).toBe(1);
    expect(deps.alertas.alertas[0]!.motivoCierre).toMatch(/anterior a 2025-01/);
    expect(deps.alertas.alertas[0]!.motivoCierre).not.toMatch(/ya no existe/);
  });

  it('el texto de la alerta de libro no da por hecho que el período no se presentó', async () => {
    const deps = armar([
      { clienteId: CLIENTE, periodo: '2026-03', liquidacionId: LIQUIDACION, comprobantes: 2, ivaEnRiesgo: 3n },
    ]);

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(deps.alertas.alertas[0]!.detalle).toMatch(/si ya se presentó, puede hacer falta una rectificativa/);
  });

  it('avisa de los comprobantes con riesgo de multa', async () => {
    const deps = armar([
      { clienteId: CLIENTE, periodo: '2026-03', liquidacionId: LIQUIDACION, comprobantes: 7, ivaEnRiesgo: 12n },
    ]);

    const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(resumen.creadas).toBe(1);
    const alerta = deps.alertas.alertas[0]!;
    expect(alerta.origen).toBe(ORIGEN_LIBRO_RIESGO);
    expect(alerta.criticidad).toBe('CRITICA');
    expect(alerta.titulo).toMatch(/7 comprobantes con riesgo de multa/);
    expect(alerta.detalle).toMatch(/cruza estos datos/);
    // Se relaciona con la LIQUIDACIÓN del período, que es una entidad real con
    // su UUID. La primera versión inventaba una clave `clienteId|periodo` y la
    // base la rechazaba por no ser un UUID; el doble no lo notaba.
    expect(alerta.entidadRelacionada).toBe('liquidacion_iva_rg90');
    expect(alerta.entidadRelacionadaId).toBe(LIQUIDACION);
  });

  /*
   * UNA alerta por cliente y período, no una por comprobante.
   *
   * En los datos reales del piloto hay 49 comprobantes con riesgo. Una alerta
   * por cada uno serían 49 líneas del mismo tipo en la pantalla — y una pantalla
   * con 49 alertas iguales es una pantalla que nadie mira, que es justo el
   * problema que este motor existe para evitar.
   */
  it('agrupa: una sola alerta aunque sean muchos comprobantes', async () => {
    const deps = armar([
      { clienteId: CLIENTE, periodo: '2026-03', liquidacionId: LIQUIDACION, comprobantes: 49, ivaEnRiesgo: 73n },
    ]);

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(deps.alertas.alertas).toHaveLength(1);
    expect(deps.alertas.alertas[0]!.titulo).toMatch(/49 comprobantes/);
  });

  it('un solo comprobante se nombra en singular', async () => {
    const deps = armar([
      { clienteId: CLIENTE, periodo: '2026-03', liquidacionId: LIQUIDACION, comprobantes: 1, ivaEnRiesgo: 12n },
    ]);

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(deps.alertas.alertas[0]!.titulo).toMatch(/1 comprobante con riesgo/);
  });

  // Corregida la planilla y recalculado el IVA, el hallazgo desaparece y la
  // alerta se cierra sola — igual que un vencimiento que se presenta.
  it('al corregirse el libro, la alerta se cierra sola', async () => {
    let riesgos: readonly RiesgoDeLibroPorPeriodo[] = [
      { clienteId: CLIENTE, periodo: '2026-03', liquidacionId: LIQUIDACION, comprobantes: 3, ivaEnRiesgo: 5n },
    ];
    const deps = {
      alertas: new AlertasFalsas(),
      vencimientos: new VencimientosFalsos(),
      procesoMensual: new ProcesoMensualFalso(),
      riesgoDeLibro: { porPeriodo: async () => riesgos },
    };

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    expect(deps.alertas.alertas[0]!.estado).toBe('ABIERTA');

    riesgos = [];
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.resueltas).toBe(1);
    expect(deps.alertas.alertas[0]!.estado).toBe('CERRADA');
  });

  it('correrlo muchas veces no repite la alerta del libro', async () => {
    const deps = armar([
      { clienteId: CLIENTE, periodo: '2026-03', liquidacionId: LIQUIDACION, comprobantes: 7, ivaEnRiesgo: 12n },
    ]);

    await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
    const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

    expect(segunda.creadas).toBe(0);
    expect(deps.alertas.alertas).toHaveLength(1);
  });

  /*
   * La regla que el texto de la alerta AFIRMA.
   *
   * Una alerta de vencimiento dice, con todas las letras, "todavía no está
   * registrado como presentado". Hoy eso es cierto porque el repositorio filtra
   * lo presentado antes de devolverlo — pero la afirmación la hace el motor, no
   * el repositorio, y una afirmación no puede depender de que otro archivo se
   * acuerde de filtrar. El día que alguien agregue otra forma de traer
   * vencimientos, el sistema le diría a EFFORT que no presentó algo que sí
   * presentó, que es exactamente el error que más caro sale acá.
   *
   * Por eso este test se saltea el repositorio a propósito: es el único modo de
   * probar la defensa del motor, porque el doble de pruebas filtra igual que el
   * repositorio real.
   */
  it('no alerta sobre algo presentado, aunque el repositorio se lo entregue', async () => {
    const deps = armar();
    await agregarVencimiento(deps, '2026-04-13');

    for (const estado of ['PRESENTADO', 'NO_APLICA']) {
      const yaPresentado = { ...deps.vencimientos.vencimientos[0]!, estado };
      const sinFiltrar = {
        ...deps,
        alertas: new AlertasFalsas(),
        vencimientos: { ...deps.vencimientos, listar: async () => [yaPresentado] },
      } as unknown as Parameters<typeof evaluarAlertas>[0];

      const resumen = await evaluarAlertas(sinFiltrar, HOY, '2026-03', 'usr-1');

      expect(resumen.creadas, `no debería alertar sobre un vencimiento ${estado}`).toBe(0);
    }
  });
  /*
   * Tarea 143. El caso real que la originó: `120-07-2026.pdf` en la carpeta de
   * COPESA, y adentro MACOMA ENVIRONMENTAL TECHNOLOGIES.
   */
  describe('declaraciones archivadas bajo el cliente equivocado', () => {
    const AJENA: DeclaracionAjena = {
      evidenciaId: '33333333-3333-4333-8333-333333333333',
      clienteId: CLIENTE,
      nombreDelCliente: 'COPESA CONSTRUCCIONES SA',
      nombreArchivo: '120-07-2026.pdf',
      rucDelDocumento: '80135322',
      formulario: '120',
      periodo: '2026-07',
    };

    it('levanta una alerta ALTA que nombra el archivo y el RUC ajeno', async () => {
      const deps = armar([], [AJENA]);

      const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

      expect(resumen.creadas).toBe(1);
      const alerta = deps.alertas.alertas[0]!;
      expect(alerta.origen).toBe(ORIGEN_DECLARACION_AJENA);
      expect(alerta.criticidad).toBe('ALTA');
      // Sin el nombre del archivo el aviso no sirve: nadie sabe cuál ir a mirar.
      expect(alerta.titulo).toContain('120-07-2026.pdf');
      expect(alerta.detalle).toContain('80135322');
      // La entidad es la evidencia, y su id tiene que ser el UUID: es lo que
      // impide que la misma alerta se levante dos veces.
      expect(alerta.entidadRelacionada).toBe('evidencia');
      expect(alerta.entidadRelacionadaId).toBe(AJENA.evidenciaId);
    });

    it('advierte que no se transcriban esos números', async () => {
      // El riesgo que señaló Daniel no es el vencimiento: es que alguien tome
      // esos importes y los cargue al SIGA del cliente equivocado.
      const deps = armar([], [AJENA]);

      await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

      expect(deps.alertas.alertas[0]!.detalle).toMatch(/SIGA/);
    });

    it('no se repite si el motor corre muchas veces', async () => {
      const deps = armar([], [AJENA]);

      await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');
      const segunda = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

      expect(segunda.creadas).toBe(0);
      expect(deps.alertas.alertas).toHaveLength(1);
    });

    it('se cierra sola cuando el archivo deja de estar mal ubicado', async () => {
      // EFFORT lo mueve a la carpeta que corresponde y el problema desaparece.
      const deps = armar([], [AJENA]);
      await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

      const yaMovido = {
        ...deps,
        declaracionesAjenas: { listar: async () => [] },
      };
      const resumen = await evaluarAlertas(yaMovido, HOY, '2026-03', 'usr-1');

      expect(resumen.resueltas).toBe(1);
      expect(deps.alertas.alertas[0]!.estado).not.toBe('ABIERTA');
    });

    it('NO la cierra cuando el módulo no está conectado', async () => {
      /*
       * La diferencia que importa: sin el módulo, la lista viene vacía igual
       * que cuando el archivo se movió. Cerrar la alerta ahí sería afirmar que
       * el problema se resolvió sin tener cómo saberlo — y el archivo puede
       * seguir exactamente donde estaba.
       */
      const deps = armar([], [AJENA]);
      await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

      const sinModulo = { ...deps, declaracionesAjenas: undefined };
      const resumen = await evaluarAlertas(sinModulo, HOY, '2026-03', 'usr-1');

      expect(resumen.resueltas).toBe(0);
      expect(deps.alertas.alertas[0]!.estado).toBe('ABIERTA');
    });

    it('sin el módulo conectado no inventa alertas', async () => {
      const deps = armar([], null);

      const resumen = await evaluarAlertas(deps, HOY, '2026-03', 'usr-1');

      expect(resumen.creadas).toBe(0);
    });
  });
});
