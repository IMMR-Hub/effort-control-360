import { describe, expect, it } from 'vitest';

import {
  ErrorDeAutorizacion,
  MATRIZ,
  exigirPermiso,
  filtroDeClientes,
  puede,
  puedeAccederAlCliente,
  requiereSegundoFactor,
  type Accion,
  type Recurso,
  type SujetoAutenticado,
} from '../src/seguridad/rbac.js';

const ROLES = [
  'direccion',
  'responsable',
  'coordinador',
  'auxiliar',
  'revisor_balance',
  'solo_lectura',
] as const;

const RECURSOS: Recurso[] = [
  'cliente', 'usuario', 'documento', 'evidencia', 'proceso_mensual', 'exportacion_siga',
  'liquidacion', 'balance', 'vencimiento', 'alerta', 'obligacion', 'regla_notificacion',
  'contacto', 'constancia', 'evento', 'configuracion', 'regla_impositiva',
];

const ACCIONES: Accion[] = ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'exportar', 'cerrar'];

function sujeto(parcial: Partial<SujetoAutenticado> = {}): SujetoAutenticado {
  return {
    usuarioId: 'usr-1',
    rol: 'auxiliar',
    activo: true,
    veTodosLosClientes: false,
    clientesAsignados: ['cli-1'],
    ...parcial,
  };
}

describe('la matriz cubre toda combinación posible', () => {
  it('cada rol x recurso x acción tiene una respuesta explícita', () => {
    const celdas: string[] = [];

    for (const rol of ROLES) {
      for (const recurso of RECURSOS) {
        for (const accion of ACCIONES) {
          const resultado = puede(sujeto({ rol }), recurso, accion);
          expect(typeof resultado).toBe('boolean');
          celdas.push(`${rol}|${recurso}|${accion}=${resultado}`);
        }
      }
    }

    // 6 roles x 17 recursos x 7 acciones. Si crece un recurso y nadie decide
    // sus permisos, este número cambia y el test obliga a mirarlo.
    expect(celdas).toHaveLength(6 * 17 * 7);
  });

  it('niega por defecto: un recurso que no figura en el rol queda cerrado', () => {
    // 'configuracion' no está en la matriz de auxiliar.
    expect(MATRIZ.auxiliar.configuracion).toBeUndefined();
    expect(puede(sujeto({ rol: 'auxiliar' }), 'configuracion', 'ver')).toBe(false);
  });

  it('nadie puede eliminar nada: los registros se dan de baja, no se borran', () => {
    for (const rol of ROLES) {
      for (const recurso of RECURSOS) {
        expect(puede(sujeto({ rol }), recurso, 'eliminar')).toBe(false);
      }
    }
  });
});

describe('aprobación de balances', () => {
  it('solo dirección y revisor de balance pueden aprobar', () => {
    const puedenAprobar = ROLES.filter((rol) => puede(sujeto({ rol }), 'balance', 'aprobar'));
    expect(puedenAprobar).toEqual(['direccion', 'revisor_balance']);
  });

  it('un coordinador puede editar el balance pero no aprobarlo', () => {
    const coordinador = sujeto({ rol: 'coordinador' });
    expect(puede(coordinador, 'balance', 'editar')).toBe(true);
    expect(puede(coordinador, 'balance', 'aprobar')).toBe(false);
  });
});

describe('restricciones por rol', () => {
  it('solo_lectura no puede modificar nada', () => {
    const lector = sujeto({ rol: 'solo_lectura' });
    for (const recurso of RECURSOS) {
      for (const accion of ['crear', 'editar', 'eliminar', 'aprobar', 'cerrar'] as Accion[]) {
        expect(puede(lector, recurso, accion)).toBe(false);
      }
    }
  });

  it('solo dirección administra usuarios', () => {
    const administran = ROLES.filter((rol) => puede(sujeto({ rol }), 'usuario', 'crear'));
    expect(administran).toEqual(['direccion']);
  });

  it('solo dirección cambia las reglas impositivas: ahí se define cuánto IVA se calcula', () => {
    const editan = ROLES.filter((rol) => puede(sujeto({ rol }), 'regla_impositiva', 'editar'));
    expect(editan).toEqual(['direccion']);
  });

  it('un auxiliar no ve el registro de eventos', () => {
    expect(puede(sujeto({ rol: 'auxiliar' }), 'evento', 'ver')).toBe(false);
  });

  it('un usuario desactivado no puede hacer absolutamente nada', () => {
    const desactivado = sujeto({ rol: 'direccion', activo: false, veTodosLosClientes: true });
    for (const recurso of RECURSOS) {
      for (const accion of ACCIONES) {
        expect(puede(desactivado, recurso, accion)).toBe(false);
      }
    }
    expect(puedeAccederAlCliente(desactivado, 'cli-1')).toBe(false);
  });
});

describe('alcance por cliente: la capa que evita fugas entre empresas', () => {
  it('un usuario con cartera limitada solo alcanza sus clientes', () => {
    const auxiliar = sujeto({ clientesAsignados: ['cli-1', 'cli-2'] });
    expect(puedeAccederAlCliente(auxiliar, 'cli-1')).toBe(true);
    expect(puedeAccederAlCliente(auxiliar, 'cli-9')).toBe(false);
  });

  it('un usuario sin clientes asignados no ve ninguno, en vez de verlos todos', () => {
    const sinCartera = sujeto({ clientesAsignados: [], veTodosLosClientes: false });
    expect(puedeAccederAlCliente(sinCartera, 'cli-1')).toBe(false);
    expect(filtroDeClientes(sinCartera)).toEqual([]);
  });

  it('quien ve toda la cartera no lleva filtro', () => {
    expect(filtroDeClientes(sujeto({ veTodosLosClientes: true }))).toBeNull();
  });

  it('el rol amplio no sobreescribe el alcance de cartera', () => {
    // Un responsable puede editar clientes, pero no los que no tiene asignados.
    const responsable = sujeto({ rol: 'responsable', clientesAsignados: ['cli-1'] });
    expect(puede(responsable, 'cliente', 'editar')).toBe(true);
    expect(() => exigirPermiso(responsable, 'cliente', 'editar', 'cli-9')).toThrow(
      ErrorDeAutorizacion,
    );
    expect(() => exigirPermiso(responsable, 'cliente', 'editar', 'cli-1')).not.toThrow();
  });
});

describe('exigirPermiso', () => {
  it('no revela si el cliente existe', () => {
    const auxiliar = sujeto({ clientesAsignados: ['cli-1'] });
    let mensajeSinPermisoDeRol = '';
    let mensajeSinAccesoAlCliente = '';

    try {
      exigirPermiso(auxiliar, 'usuario', 'crear');
    } catch (error) {
      mensajeSinPermisoDeRol = (error as Error).message;
    }
    try {
      exigirPermiso(auxiliar, 'documento', 'crear', 'cli-secreto');
    } catch (error) {
      mensajeSinAccesoAlCliente = (error as Error).message;
    }

    // El mismo texto en ambos casos: la diferencia delataría la existencia del cliente.
    expect(mensajeSinPermisoDeRol).toBe(mensajeSinAccesoAlCliente);
    expect(mensajeSinAccesoAlCliente).not.toContain('cli-secreto');
  });

  it('responde 403', () => {
    try {
      exigirPermiso(sujeto(), 'usuario', 'crear');
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect((error as ErrorDeAutorizacion).codigoHttp).toBe(403);
    }
  });
});

describe('segundo factor obligatorio', () => {
  it('lo exige a dirección y responsable, que son quienes ven toda la cartera', () => {
    expect(requiereSegundoFactor('direccion')).toBe(true);
    expect(requiereSegundoFactor('responsable')).toBe(true);
    expect(requiereSegundoFactor('auxiliar')).toBe(false);
  });
});
