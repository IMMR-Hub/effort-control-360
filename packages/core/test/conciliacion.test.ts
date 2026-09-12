import { describe, expect, it } from 'vitest';

import {
  claveNatural,
  conciliarConSiga,
  detectarDuplicados,
  fechaCivilDesdeIso,
  gs,
  magnitudDeLasDiferencias,
  resumirLibro,
  totalizar,
  DIVISORES_CONFIRMADOS_POR_EFFORT,
  type Comprobante,
} from '../src/index.js';

function comprobante(parcial: Partial<Comprobante> & { numero: string }): Comprobante {
  return {
    rucEmisor: '80012345-6',
    timbrado: '12345678',
    tipo: 'FACTURA',
    origen: 'COMPRA',
    fecha: fechaCivilDesdeIso('2026-03-15'),
    total: gs(1100000),
    tasa: 'DIEZ',
    anulado: false,
    ...parcial,
  };
}

describe('clave natural', () => {
  it('identifica un comprobante por RUC, timbrado y número', () => {
    expect(claveNatural(comprobante({ numero: '001-001-0000001' }))).toBe(
      '80012345-6|12345678|001-001-0000001',
    );
  });

  it('ignora espacios y mayúsculas, que varían según quién cargó el dato', () => {
    const a = comprobante({ numero: ' 001-001-0000001 ', rucEmisor: ' 80012345-6 ' });
    const b = comprobante({ numero: '001-001-0000001', rucEmisor: '80012345-6' });
    expect(claveNatural(a)).toBe(claveNatural(b));
  });

  it('no normaliza ceros a la izquierda: fusionar dos comprobantes distintos sería peor que reportar de más', () => {
    const largo = comprobante({ numero: '001-001-0000001' });
    const corto = comprobante({ numero: '1-1-1' });
    expect(claveNatural(largo)).not.toBe(claveNatural(corto));
  });
});

describe('detección de duplicados', () => {
  it('conserva el primero y rechaza los siguientes, sin fusionar importes', () => {
    const primero = comprobante({ numero: '001-001-0000001', total: gs(1100000) });
    const repetido = comprobante({ numero: '001-001-0000001', total: gs(2200000) });
    const otro = comprobante({ numero: '001-001-0000002' });

    const resultado = detectarDuplicados([primero, repetido, otro]);

    expect(resultado.unicos).toHaveLength(2);
    expect(resultado.duplicados).toHaveLength(1);
    expect(resultado.duplicados[0]?.conservado.total).toBe(gs(1100000));
    expect(resultado.duplicados[0]?.rechazados).toHaveLength(1);
    // El importe del rechazado no se suma ni se promedia con el conservado.
    expect(resultado.unicos.map((c) => c.total)).toEqual([gs(1100000), gs(1100000)]);
  });

  it('no reporta duplicados cuando todas las claves son distintas', () => {
    const resultado = detectarDuplicados([
      comprobante({ numero: '001-001-0000001' }),
      comprobante({ numero: '001-001-0000002' }),
    ]);
    expect(resultado.duplicados).toHaveLength(0);
    expect(resultado.unicos).toHaveLength(2);
  });

  it('una lista vacía no produce nada', () => {
    const resultado = detectarDuplicados([]);
    expect(resultado.unicos).toHaveLength(0);
    expect(resultado.duplicados).toHaveLength(0);
  });
});

describe('libro de compras y ventas', () => {
  it('un comprobante anulado figura en el libro pero no suma', () => {
    const resumen = resumirLibro([
      comprobante({ numero: '001-001-0000001', total: gs(1100000) }),
      comprobante({ numero: '001-001-0000002', total: gs(2200000), anulado: true }),
      comprobante({ numero: '001-001-0000003', total: gs(3300000) }),
    ]);

    expect(resumen.cantidadFilas).toBe(3);
    expect(resumen.cantidadAnuladas).toBe(1);
    expect(resumen.cantidadComputables).toBe(2);
    expect(resumen.total).toBe(gs(4400000));
  });

  it('el IVA se despeja por comprobante y recién después se suma, igual que en SIGA', () => {
    // Tres comprobantes de 1.000.000 al 10%: cada uno redondea a 90.909.
    const totales = totalizar([
      { total: gs(1000000), tasa: 'DIEZ' },
      { total: gs(1000000), tasa: 'DIEZ' },
      { total: gs(1000000), tasa: 'DIEZ' },
    ], DIVISORES_CONFIRMADOS_POR_EFFORT);

    expect(totales.ivaDiez).toBe(gs(272727));
    // Despejar sobre la suma daría 3.000.000/11 = 272.727 también acá, pero la
    // identidad que importa es que gravado + iva reconstruye el total exacto:
    expect(totales.gravadoDiez + totales.ivaDiez).toBe(totales.totalGeneral);
  });

  it('separa las tasas y las exentas', () => {
    const totales = totalizar([
      { total: gs(1100000), tasa: 'DIEZ' },
      { total: gs(1050000), tasa: 'CINCO' },
      { total: gs(500000), tasa: 'EXENTA' },
    ], DIVISORES_CONFIRMADOS_POR_EFFORT);

    expect(totales.ivaDiez).toBe(gs(100000));
    expect(totales.ivaCinco).toBe(gs(50000));
    expect(totales.exentas).toBe(gs(500000));
    expect(totales.ivaTotal).toBe(gs(150000));
    expect(totales.totalGeneral).toBe(gs(2650000));
  });
});

describe('conciliación contra la exportación de SIGA', () => {
  it('detecta lo que falta cargar en SIGA', () => {
    const recibidos = [
      comprobante({ numero: '001-001-0000001' }),
      comprobante({ numero: '001-001-0000002' }),
    ];
    const enSiga = [comprobante({ numero: '001-001-0000001' })];

    const resultado = conciliarConSiga(recibidos, enSiga);

    expect(resultado.faltaCargarEnSiga).toHaveLength(1);
    expect(resultado.faltaCargarEnSiga[0]?.numero).toBe('001-001-0000002');
    expect(resultado.conciliado).toBe(false);
  });

  it('detecta lo que SIGA tiene sin respaldo documental', () => {
    const resultado = conciliarConSiga(
      [comprobante({ numero: '001-001-0000001' })],
      [comprobante({ numero: '001-001-0000001' }), comprobante({ numero: '001-001-0000009' })],
    );

    expect(resultado.sinRespaldoDocumental).toHaveLength(1);
    expect(resultado.sinRespaldoDocumental[0]?.numero).toBe('001-001-0000009');
  });

  it('detecta diferencias de monto sin corregirlas', () => {
    const resultado = conciliarConSiga(
      [comprobante({ numero: '001-001-0000001', total: gs(1100000) })],
      [comprobante({ numero: '001-001-0000001', total: gs(1000000) })],
    );

    expect(resultado.diferenciasDeMonto).toHaveLength(1);
    expect(resultado.diferenciasDeMonto[0]?.diferencia).toBe(gs(100000));
    expect(magnitudDeLasDiferencias(resultado)).toBe(gs(100000));
    expect(resultado.conciliado).toBe(false);
  });

  it('suma la magnitud de las diferencias en valor absoluto, sin compensar unas con otras', () => {
    const resultado = conciliarConSiga(
      [
        comprobante({ numero: '001-001-0000001', total: gs(1100000) }),
        comprobante({ numero: '001-001-0000002', total: gs(900000) }),
      ],
      [
        comprobante({ numero: '001-001-0000001', total: gs(1000000) }),
        comprobante({ numero: '001-001-0000002', total: gs(1000000) }),
      ],
    );

    // +100.000 y -100.000 no se cancelan: hay 200.000 en discusión.
    expect(magnitudDeLasDiferencias(resultado)).toBe(gs(200000));
  });

  it('declara conciliado solo cuando no hay ninguna diferencia', () => {
    const mismos = [
      comprobante({ numero: '001-001-0000001' }),
      comprobante({ numero: '001-001-0000002' }),
    ];

    const resultado = conciliarConSiga(mismos, mismos);

    expect(resultado.conciliado).toBe(true);
    expect(resultado.coincidentes).toBe(2);
  });

  // Este test afirmaba lo contrario ("dos conjuntos vacíos concilian") y por
  // eso la pantalla de SIGA mostraba "Conciliado: Sí" en un período donde no se
  // había importado nada. Un período vacío no está conciliado: no se miró nada.
  // La diferencia importa porque el indicador verde es lo que habilita a cerrar
  // el período.
  it('dos conjuntos vacíos NO concilian: no hay nada que comparar', () => {
    const resultado = conciliarConSiga([], []);

    expect(resultado.conciliado).toBe(false);
    expect(resultado.sinDatos).toBe(true);
  });

  it('un período con datos y sin diferencias sí concilia, y no queda "sin datos"', () => {
    const mismos = [comprobante({ numero: '001-001-0000001' })];
    const resultado = conciliarConSiga(mismos, mismos);

    expect(resultado.conciliado).toBe(true);
    expect(resultado.sinDatos).toBe(false);
  });

  it('con documentos recibidos pero SIGA vacío no concilia ni es "sin datos"', () => {
    const resultado = conciliarConSiga([comprobante({ numero: '001-001-0000001' })], []);

    expect(resultado.sinDatos).toBe(false);
    expect(resultado.conciliado).toBe(false);
    expect(resultado.faltaCargarEnSiga).toHaveLength(1);
  });
});
