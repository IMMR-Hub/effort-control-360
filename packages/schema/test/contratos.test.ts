import { describe, expect, it } from 'vitest';

import {
  calcularDigitoVerificadorRuc,
  crearClienteSchema,
  crearRegistroContactoSchema,
  crearUsuarioSchema,
  fechaIsoSchema,
  guaraniesSchema,
  rucSchema,
  usuarioPublicoSchema,
  usuarioSchema,
} from '../src/index.js';

describe('dinero en el borde de la API', () => {
  it('acepta enteros como texto', () => {
    expect(guaraniesSchema.parse('6000000')).toBe('6000000');
    expect(guaraniesSchema.parse('-500000')).toBe('-500000');
    expect(guaraniesSchema.parse('0')).toBe('0');
  });

  it('rechaza decimales, separadores de miles y notación científica', () => {
    for (const invalido of ['1000.50', '1.000.000', '1,000', '1e6', '  ', 'mil']) {
      expect(() => guaraniesSchema.parse(invalido)).toThrow();
    }
  });

  it('no acepta números: JSON no distingue enteros de flotantes', () => {
    expect(() => guaraniesSchema.parse(6000000)).toThrow();
  });
});

describe('RUC paraguayo', () => {
  it('valida el dígito verificador', () => {
    expect(rucSchema.parse('80017726-6')).toBe('80017726-6');
    expect(() => rucSchema.parse('80017726-1')).toThrow();
  });

  it('el algoritmo es estable y devuelve un solo dígito', () => {
    for (const base of ['80017726', '1', '12345678', '4184961']) {
      const dv = calcularDigitoVerificadorRuc(base);
      expect(dv).toBeGreaterThanOrEqual(0);
      expect(dv).toBeLessThanOrEqual(9);
      expect(rucSchema.parse(`${base}-${dv}`)).toBe(`${base}-${dv}`);
    }
  });

  it('rechaza formatos que no son RUC', () => {
    for (const invalido of ['80017726', '80017726-', 'ABC-1', '800177266']) {
      expect(() => rucSchema.parse(invalido)).toThrow();
    }
  });

  it('safeParse nunca lanza para un RUC malformado: falla como validación, no como excepción', () => {
    // Regresión: el refine de calcularDigitoVerificadorRuc() se ejecutaba
    // incluso cuando el regex de formato ya había fallado, y esa función
    // lanza (en vez de devolver false) cuando la base no tiene dígitos.
    // Eso convertía cualquier RUC vacío o sin dígitos en un crash de
    // safeParse(), que por contrato nunca debería lanzar.
    for (const malformado of ['', 'ABC-1', '-', 'sin ruc', '   ']) {
      const resultado = rucSchema.safeParse(malformado);
      expect(resultado.success).toBe(false);
    }
  });
});

describe('fechas', () => {
  it('rechaza fechas que no existen en el calendario', () => {
    expect(fechaIsoSchema.parse('2028-02-29')).toBe('2028-02-29');
    expect(() => fechaIsoSchema.parse('2027-02-29')).toThrow();
    expect(() => fechaIsoSchema.parse('2026-04-31')).toThrow();
  });
});

describe('rechazo de campos desconocidos', () => {
  it('no deja colar un cambio de rol en un alta de cliente', () => {
    const cuerpoMalicioso = {
      nombre: 'GARSO S.A.',
      ruc: '80017726-6',
      tipoPersona: 'JURIDICA',
      regimenTributario: null,
      email: null,
      telefono: null,
      canalPreferido: null,
      responsableId: null,
      coordinadorId: null,
      auxiliarId: null,
      revisorBalanceId: null,
      carpetaOneDriveId: null,
      activo: true,
      observaciones: null,
      // Campo de más: si el esquema lo ignorara en silencio y la capa de datos
      // hiciera un spread del cuerpo, esto escalaría privilegios.
      rol: 'direccion',
    };

    expect(() => crearClienteSchema.parse(cuerpoMalicioso)).toThrow();
  });

  it('el alta de usuario no acepta campos que decide el servidor', () => {
    expect(() =>
      crearUsuarioSchema.parse({
        nombre: 'Ana', apellido: 'Pérez', email: 'ana@effort.com.py', rol: 'auxiliar',
        segundoFactorActivo: true,
      }),
    ).toThrow();

    expect(() =>
      crearUsuarioSchema.parse({
        nombre: 'Ana', apellido: 'Pérez', email: 'ana@effort.com.py', rol: 'auxiliar',
        hashContrasena: '$argon2id$loquesea',
      }),
    ).toThrow();
  });

  it('rechaza un rol inventado', () => {
    expect(() =>
      crearUsuarioSchema.parse({
        nombre: 'Ana', apellido: 'Pérez', email: 'ana@effort.com.py', rol: 'superadmin',
      }),
    ).toThrow();
  });
});

describe('la respuesta pública de usuario no lleva credenciales', () => {
  it('el esquema no define campos de credenciales', () => {
    const campos = Object.keys(usuarioSchema.shape);
    for (const sensible of ['hashContrasena', 'secretoTotp', 'contrasena', 'password']) {
      expect(campos).not.toContain(sensible);
    }
    expect(Object.keys(usuarioPublicoSchema.shape)).not.toContain('hashContrasena');
  });
});

describe('alta de contacto: las reglas de evidencia se validan en el borde', () => {
  const base = {
    clienteId: '11111111-1111-4111-8111-111111111111',
    periodo: '2026-03',
    canal: 'LLAMADA' as const,
    ocurridoEn: new Date('2026-04-10T13:00:00Z'),
    resumen: 'Se pidieron las facturas de marzo.',
  };

  it('acepta un contacto sin respuesta', () => {
    expect(() =>
      crearRegistroContactoSchema.parse({ ...base, huboRespuesta: false }),
    ).not.toThrow();
  });

  it('exige quién atendió cuando hubo respuesta', () => {
    expect(() => crearRegistroContactoSchema.parse({ ...base, huboRespuesta: true })).toThrow();
    expect(() =>
      crearRegistroContactoSchema.parse({
        ...base, huboRespuesta: true, quienAtendio: 'Sra. González',
      }),
    ).not.toThrow();
  });

  it('rechaza quién atendió si figura sin respuesta', () => {
    expect(() =>
      crearRegistroContactoSchema.parse({
        ...base, huboRespuesta: false, quienAtendio: 'Alguien',
      }),
    ).toThrow();
  });

  it('exige describir qué se habló: el registro es evidencia', () => {
    expect(() =>
      crearRegistroContactoSchema.parse({ ...base, resumen: '', huboRespuesta: false }),
    ).toThrow();
  });

  it('no permite antefechar ni posfechar un contacto al futuro', () => {
    const dentroDeUnaHora = new Date(Date.now() + 3_600_000);
    expect(() =>
      crearRegistroContactoSchema.parse({
        ...base, ocurridoEn: dentroDeUnaHora, huboRespuesta: false,
      }),
    ).toThrow();
  });
});
