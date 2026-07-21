import { describe, expect, it } from 'vitest';

import {
  ErrorDeAprobacion,
  aprobarBalance,
  gs,
  revisarBalance,
  verificarEcuacionPatrimonial,
  verificarResultadoCruzado,
  verificarSumatoriaEstadoResultados,
  type CifrasBalance,
  type CifrasEstadoResultados,
  type ContextoOperativoBalance,
} from '../src/index.js';

const balanceQueCierra: CifrasBalance = {
  activo: gs(1_000_000_000),
  pasivo: gs(400_000_000),
  patrimonioNeto: gs(600_000_000),
  resultadoEjercicio: gs(150_000_000),
};

const estadoResultadosCoherente: CifrasEstadoResultados = {
  ingresos: gs(500_000_000),
  costos: gs(200_000_000),
  gastos: gs(150_000_000),
  resultado: gs(150_000_000),
};

const contextoLimpio: ContextoOperativoBalance = {
  documentosFaltantes: 0,
  diferenciasConSiga: 0,
  liquidacionEnviada: true,
  extractosBancariosRecibidos: true,
  conciliacionBancariaRealizada: true,
};

describe('ecuación patrimonial', () => {
  it('acepta un balance donde activo = pasivo + patrimonio neto', () => {
    expect(verificarEcuacionPatrimonial(balanceQueCierra)).toBeNull();
  });

  it('detecta una diferencia de un solo guaraní', () => {
    const inconsistencia = verificarEcuacionPatrimonial({
      ...balanceQueCierra,
      activo: gs(1_000_000_001),
    });

    expect(inconsistencia?.codigo).toBe('ECUACION_PATRIMONIAL_NO_CIERRA');
    expect(inconsistencia?.gravedad).toBe('BLOQUEANTE');
    expect(inconsistencia?.diferencia).toBe(gs(1));
  });

  it('reporta la diferencia en valor absoluto sin importar el sentido', () => {
    const faltante = verificarEcuacionPatrimonial({
      ...balanceQueCierra,
      activo: gs(900_000_000),
    });
    expect(faltante?.diferencia).toBe(gs(100_000_000));
  });
});

describe('estado de resultados', () => {
  it('acepta un resultado igual a ingresos - costos - gastos', () => {
    expect(verificarSumatoriaEstadoResultados(estadoResultadosCoherente)).toBeNull();
  });

  it('detecta un resultado mal sumado', () => {
    const inconsistencia = verificarSumatoriaEstadoResultados({
      ...estadoResultadosCoherente,
      resultado: gs(200_000_000),
    });

    expect(inconsistencia?.codigo).toBe('RESULTADO_ESTADO_RESULTADOS_MAL_SUMADO');
    expect(inconsistencia?.diferencia).toBe(gs(50_000_000));
  });

  it('detecta que el resultado del balance no coincide con el del estado de resultados', () => {
    const inconsistencia = verificarResultadoCruzado(
      { ...balanceQueCierra, resultadoEjercicio: gs(140_000_000) },
      estadoResultadosCoherente,
    );

    expect(inconsistencia?.codigo).toBe('RESULTADO_NO_COINCIDE_CON_ESTADO_RESULTADOS');
    expect(inconsistencia?.diferencia).toBe(gs(10_000_000));
  });
});

describe('revisión previa', () => {
  it('un balance consistente y con la operación al día queda listo para revisión humana', () => {
    const revision = revisarBalance(balanceQueCierra, estadoResultadosCoherente, contextoLimpio);

    expect(revision.inconsistencias).toHaveLength(0);
    expect(revision.estadoSugerido).toBe('LISTO_PARA_REVISION');
  });

  it('un balance que no cierra queda observado', () => {
    const revision = revisarBalance(
      { ...balanceQueCierra, activo: gs(999_999_999) },
      estadoResultadosCoherente,
      contextoLimpio,
    );

    expect(revision.bloqueantes).toBeGreaterThan(0);
    expect(revision.estadoSugerido).toBe('OBSERVADO');
  });

  it('los documentos faltantes bloquean aunque las cifras cierren', () => {
    const revision = revisarBalance(balanceQueCierra, estadoResultadosCoherente, {
      ...contextoLimpio,
      documentosFaltantes: 4,
    });

    expect(revision.estadoSugerido).toBe('OBSERVADO');
    expect(revision.inconsistencias.map((i) => i.codigo)).toContain('DOCUMENTOS_FALTANTES');
  });

  it('las diferencias con SIGA bloquean', () => {
    const revision = revisarBalance(balanceQueCierra, estadoResultadosCoherente, {
      ...contextoLimpio,
      diferenciasConSiga: 2,
    });

    expect(revision.estadoSugerido).toBe('OBSERVADO');
  });

  it('la liquidación sin enviar advierte pero no bloquea la revisión', () => {
    const revision = revisarBalance(balanceQueCierra, estadoResultadosCoherente, {
      ...contextoLimpio,
      liquidacionEnviada: false,
    });

    expect(revision.bloqueantes).toBe(0);
    expect(revision.advertencias).toBe(1);
    expect(revision.estadoSugerido).toBe('LISTO_PARA_REVISION');
  });

  it('acumula todas las inconsistencias en vez de detenerse en la primera', () => {
    const revision = revisarBalance(
      { ...balanceQueCierra, activo: gs(1) },
      { ...estadoResultadosCoherente, resultado: gs(999) },
      {
        documentosFaltantes: 3,
        diferenciasConSiga: 1,
        liquidacionEnviada: false,
        extractosBancariosRecibidos: false,
        conciliacionBancariaRealizada: false,
      },
    );

    expect(revision.inconsistencias.length).toBeGreaterThanOrEqual(6);
  });
});

describe('aprobación de balance: solo por una persona habilitada', () => {
  const revisionLimpia = revisarBalance(
    balanceQueCierra,
    estadoResultadosCoherente,
    contextoLimpio,
  );

  it('el revisor de balance puede aprobar un balance sin bloqueantes', () => {
    const estado = aprobarBalance(revisionLimpia, {
      aprobadoPorUsuarioId: 'usr-laura-sosa',
      rolDelAprobador: 'revisor_balance',
      aprobadoEn: new Date('2026-07-21T13:00:00Z'),
    });

    expect(estado).toBe('APROBADO');
  });

  it('dirección también puede aprobar, de modo que la revisión no dependa de una sola persona', () => {
    expect(
      aprobarBalance(revisionLimpia, {
        aprobadoPorUsuarioId: 'usr-lili',
        rolDelAprobador: 'direccion',
        aprobadoEn: new Date('2026-07-21T13:00:00Z'),
      }),
    ).toBe('APROBADO');
  });

  it('un auxiliar no puede aprobar', () => {
    expect(() =>
      aprobarBalance(revisionLimpia, {
        aprobadoPorUsuarioId: 'usr-aracely-gaona',
        rolDelAprobador: 'auxiliar',
        aprobadoEn: new Date('2026-07-21T13:00:00Z'),
      }),
    ).toThrow(ErrorDeAprobacion);
  });

  it('un coordinador no puede aprobar', () => {
    expect(() =>
      aprobarBalance(revisionLimpia, {
        aprobadoPorUsuarioId: 'usr-karina-fretes',
        rolDelAprobador: 'coordinador',
        aprobadoEn: new Date('2026-07-21T13:00:00Z'),
      }),
    ).toThrow(ErrorDeAprobacion);
  });

  it('no se puede aprobar un balance con inconsistencias bloqueantes', () => {
    const revisionObservada = revisarBalance(
      { ...balanceQueCierra, activo: gs(1) },
      estadoResultadosCoherente,
      contextoLimpio,
    );

    expect(() =>
      aprobarBalance(revisionObservada, {
        aprobadoPorUsuarioId: 'usr-laura-sosa',
        rolDelAprobador: 'revisor_balance',
        aprobadoEn: new Date('2026-07-21T13:00:00Z'),
      }),
    ).toThrow(ErrorDeAprobacion);
  });

  it('la aprobación exige identificar al usuario: no existe aprobación anónima', () => {
    expect(() =>
      aprobarBalance(revisionLimpia, {
        aprobadoPorUsuarioId: '   ',
        rolDelAprobador: 'direccion',
        aprobadoEn: new Date('2026-07-21T13:00:00Z'),
      }),
    ).toThrow(ErrorDeAprobacion);
  });

  it('revisarBalance nunca sugiere APROBADO por su cuenta', () => {
    const revisiones = [
      revisarBalance(balanceQueCierra, estadoResultadosCoherente, contextoLimpio),
      revisarBalance({ ...balanceQueCierra, activo: gs(1) }, estadoResultadosCoherente, contextoLimpio),
    ];

    for (const revision of revisiones) {
      expect(revision.estadoSugerido).not.toBe('APROBADO');
    }
  });
});
