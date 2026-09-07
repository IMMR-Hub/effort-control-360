import { describe, expect, it } from 'vitest';

import {
  ErrorDeCredenciales,
  codigosCoinciden,
  generarCodigosDeRecuperacion,
  generarSecretoTotp,
  hashearContrasena,
  validarFortaleza,
  verificarCodigoTotp,
  verificarContrasena,
} from '../src/seguridad/credenciales.js';
import {
  DURACION_ABSOLUTA_MS,
  DURACION_POR_INACTIVIDAD_MS,
  evaluarSesion,
  generarTokenDeSesion,
  hashDelToken,
  hashesCoinciden,
  nombreCookieSesion,
  opcionesDeCookie,
  sesionUtilizable,
  type Sesion,
} from '../src/seguridad/sesiones.js';
import {
  AlmacenEnMemoria,
  POLITICA_DE_ACCESO,
  claveDeIntento,
  registrarExito,
  registrarFallo,
  verificarIntento,
} from '../src/seguridad/limites.js';
import {
  enmascararEmail,
  mensajePublicoDeError,
  sanear,
  truncarIp,
} from '../src/seguridad/privacidad.js';

/* ------------------------------------------------------------------------- */

describe('contraseñas', () => {
  it('exige al menos 12 caracteres', () => {
    expect(() => validarFortaleza('corta123')).toThrow(ErrorDeCredenciales);
    expect(() => validarFortaleza('una frase larga y memorable')).not.toThrow();
  });

  it('rechaza términos previsibles, incluido el nombre de la empresa', () => {
    expect(() => validarFortaleza('EffortControl2026')).toThrow(ErrorDeCredenciales);
    expect(() => validarFortaleza('miPassword12345')).toThrow(ErrorDeCredenciales);
  });

  it('produce un hash argon2id y verifica correctamente', async () => {
    const hash = await hashearContrasena('una frase larga y memorable');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verificarContrasena('una frase larga y memorable', hash)).toBe(true);
    expect(await verificarContrasena('otra frase distinta aca', hash)).toBe(false);
  });

  it('dos hashes de la misma contraseña difieren: la sal es aleatoria', async () => {
    const a = await hashearContrasena('una frase larga y memorable');
    const b = await hashearContrasena('una frase larga y memorable');
    expect(a).not.toBe(b);
  });

  it('un hash corrupto se trata como credencial incorrecta, no como error del servidor', async () => {
    expect(await verificarContrasena('cualquier cosa', 'basura')).toBe(false);
    expect(await verificarContrasena('cualquier cosa', '')).toBe(false);
  });

  it('no acepta guardar una contraseña débil aunque se llame directo al hasheo', async () => {
    await expect(hashearContrasena('123')).rejects.toThrow(ErrorDeCredenciales);
  });
});

describe('segundo factor', () => {
  it('rechaza códigos mal formados sin consultar el secreto', () => {
    const secreto = generarSecretoTotp();
    expect(verificarCodigoTotp('12345', secreto)).toBe(false);
    expect(verificarCodigoTotp('abcdef', secreto)).toBe(false);
    expect(verificarCodigoTotp('', secreto)).toBe(false);
  });

  it('rechaza un código de seis dígitos incorrecto', () => {
    expect(verificarCodigoTotp('000000', generarSecretoTotp())).toBe(false);
  });

  it('los códigos de recuperación son únicos entre sí', () => {
    const codigos = generarCodigosDeRecuperacion(8);
    expect(codigos).toHaveLength(8);
    expect(new Set(codigos).size).toBe(8);
  });

  it('los códigos de recuperación se comparan sin filtrar tiempo', () => {
    const [codigo] = generarCodigosDeRecuperacion(1);
    expect(codigosCoinciden(codigo!, codigo!.toLowerCase())).toBe(true);
    expect(codigosCoinciden(codigo!, 'AAAAA-AAAAA')).toBe(false);
  });
});

/* ------------------------------------------------------------------------- */

const AHORA = new Date('2026-07-21T12:00:00Z');

function sesion(parcial: Partial<Sesion> = {}): Sesion {
  return {
    id: 'ses-1',
    hashDelToken: hashDelToken('token'),
    usuarioId: 'usr-1',
    rol: 'coordinador',
    creadaEn: AHORA,
    ultimoUsoEn: AHORA,
    segundoFactorSuperado: true,
    ipTruncada: '190.128.50.0',
    agenteUsuario: 'Mozilla/5.0',
    revocadaEn: null,
    ...parcial,
  };
}

describe('sesiones', () => {
  it('el token tiene entropía suficiente y no se repite', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generarTokenDeSesion()));
    expect(tokens.size).toBe(200);
    expect(generarTokenDeSesion().length).toBeGreaterThanOrEqual(42);
  });

  it('el token en claro nunca se guarda: solo su hash', () => {
    const token = generarTokenDeSesion();
    const hash = hashDelToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
  });

  it('compara hashes en tiempo constante y sin falsos positivos', () => {
    const a = hashDelToken('token-a');
    expect(hashesCoinciden(a, a)).toBe(true);
    expect(hashesCoinciden(a, hashDelToken('token-b'))).toBe(false);
    expect(hashesCoinciden(a, 'corto')).toBe(false);
  });

  it('una sesión recién creada es utilizable', () => {
    expect(sesionUtilizable(sesion(), AHORA)).toBe(true);
  });

  it('expira por inactividad a las 8 horas', () => {
    const justoAntes = new Date(AHORA.getTime() + DURACION_POR_INACTIVIDAD_MS - 1000);
    const justoDespues = new Date(AHORA.getTime() + DURACION_POR_INACTIVIDAD_MS);

    expect(evaluarSesion(sesion(), justoAntes)).toBe('VIGENTE');
    expect(evaluarSesion(sesion(), justoDespues)).toBe('EXPIRADA_POR_INACTIVIDAD');
  });

  it('expira a las 24 horas aunque se la esté usando todo el tiempo', () => {
    const activa = sesion({
      creadaEn: AHORA,
      ultimoUsoEn: new Date(AHORA.getTime() + DURACION_ABSOLUTA_MS - 1000),
    });

    expect(evaluarSesion(activa, new Date(AHORA.getTime() + DURACION_ABSOLUTA_MS))).toBe(
      'EXPIRADA_POR_TIEMPO_ABSOLUTO',
    );
  });

  it('una sesión revocada deja de servir en el acto', () => {
    expect(evaluarSesion(sesion({ revocadaEn: AHORA }), AHORA)).toBe('REVOCADA');
  });

  it('sin segundo factor superado, la sesión no habilita nada', () => {
    const aMedias = sesion({ segundoFactorSuperado: false });
    expect(evaluarSesion(aMedias, AHORA)).toBe('SEGUNDO_FACTOR_PENDIENTE');
    expect(sesionUtilizable(aMedias, AHORA)).toBe(false);
  });

  it('la cookie es httpOnly, SameSite strict y con prefijo __Host- en producción', () => {
    const opciones = opcionesDeCookie(true);
    expect(opciones.httpOnly).toBe(true);
    expect(opciones.sameSite).toBe('strict');
    expect(opciones.secure).toBe(true);
    expect(opciones.path).toBe('/');
    expect(nombreCookieSesion(true).startsWith('__Host-')).toBe(true);
  });

  it('secure y el prefijo __Host- solo se apagan fuera de producción', () => {
    // El prefijo `__Host-` obliga al navegador a exigir `Secure` — con
    // `secure: false` (fuera de producción, sin HTTPS local), un nombre con
    // ese prefijo haría que el navegador descarte el `Set-Cookie` en
    // silencio: el login devolvería 200 pero la sesión nunca quedaría
    // guardada. Encontrado con los tests end-to-end de Playwright (`e2e/`),
    // el primer lugar que ejercitó un navegador real contra HTTP real.
    expect(opcionesDeCookie(false).secure).toBe(false);
    expect(opcionesDeCookie(true).secure).toBe(true);
    expect(nombreCookieSesion(false).startsWith('__Host-')).toBe(false);
    expect(nombreCookieSesion(true).startsWith('__Host-')).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */

describe('límite de intentos de acceso', () => {
  const clave = claveDeIntento('190.128.50.10', 'Laura@Effort.com.py');

  it('la clave combina IP y correo, normalizada', () => {
    expect(clave).toBe('190.128.50.10|laura@effort.com.py');
  });

  it('permite los primeros cinco intentos', () => {
    const almacen = new AlmacenEnMemoria();

    for (let intento = 1; intento <= POLITICA_DE_ACCESO.maximoIntentos; intento += 1) {
      expect(verificarIntento(almacen, clave, AHORA).permitido).toBe(true);
      registrarFallo(almacen, clave, AHORA);
    }

    expect(verificarIntento(almacen, clave, AHORA).permitido).toBe(false);
  });

  it('bloquea un minuto al quinto fallo y va escalando', () => {
    const almacen = new AlmacenEnMemoria();

    for (let intento = 0; intento < 5; intento += 1) registrarFallo(almacen, clave, AHORA);
    const primerBloqueo = verificarIntento(almacen, clave, AHORA);
    expect(primerBloqueo.permitido).toBe(false);
    expect(primerBloqueo.segundosParaReintentar).toBe(60);

    // Pasa el bloqueo y vuelve a fallar cinco veces más.
    const despues = new Date(AHORA.getTime() + 61_000);
    for (let intento = 0; intento < 5; intento += 1) registrarFallo(almacen, clave, despues);
    expect(verificarIntento(almacen, clave, despues).segundosParaReintentar).toBe(300);
  });

  it('un acceso correcto limpia el contador', () => {
    const almacen = new AlmacenEnMemoria();
    for (let intento = 0; intento < 5; intento += 1) registrarFallo(almacen, clave, AHORA);
    expect(verificarIntento(almacen, clave, AHORA).permitido).toBe(false);

    registrarExito(almacen, clave);
    expect(verificarIntento(almacen, clave, AHORA).permitido).toBe(true);
  });

  it('el contador se reinicia al vencer la ventana de 15 minutos', () => {
    const almacen = new AlmacenEnMemoria();
    for (let intento = 0; intento < 4; intento += 1) registrarFallo(almacen, clave, AHORA);

    const pasadaLaVentana = new Date(AHORA.getTime() + POLITICA_DE_ACCESO.ventanaMs + 1000);
    const resultado = verificarIntento(almacen, clave, pasadaLaVentana);
    expect(resultado.permitido).toBe(true);
    expect(resultado.intentosRestantes).toBe(5);
  });

  it('bloquear a un usuario no bloquea a los demás de la misma oficina', () => {
    const almacen = new AlmacenEnMemoria();
    const deLaura = claveDeIntento('190.128.50.10', 'laura@effort.com.py');
    const deKarina = claveDeIntento('190.128.50.10', 'karina@effort.com.py');

    for (let intento = 0; intento < 5; intento += 1) registrarFallo(almacen, deLaura, AHORA);

    expect(verificarIntento(almacen, deLaura, AHORA).permitido).toBe(false);
    expect(verificarIntento(almacen, deKarina, AHORA).permitido).toBe(true);
  });

  it('purga registros vencidos para no crecer sin límite', () => {
    const almacen = new AlmacenEnMemoria();
    registrarFallo(almacen, clave, AHORA);

    const muchoDespues = new Date(AHORA.getTime() + 60 * 60 * 1000);
    expect(almacen.purgar(muchoDespues, POLITICA_DE_ACCESO.ventanaMs)).toBe(1);
    expect(almacen.obtener(clave)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------------- */

describe('privacidad en logs y errores', () => {
  it('oculta credenciales sin importar cómo se llame el campo', () => {
    const saneado = sanear({
      email: 'laura.sosa@effort.com.py',
      password: 'secreta12345',
      hash_contrasena: '$argon2id$...',
      secretoTotp: 'JBSWY3DPEHPK3PXP',
      Authorization: 'Bearer abc',
      nombre: 'Laura',
    }) as Record<string, unknown>;

    expect(saneado['password']).toBe('[oculto]');
    expect(saneado['hash_contrasena']).toBe('[oculto]');
    expect(saneado['secretoTotp']).toBe('[oculto]');
    expect(saneado['Authorization']).toBe('[oculto]');
    expect(saneado['nombre']).toBe('Laura');
  });

  it('enmascara datos identificatorios en vez de borrarlos, para poder investigar', () => {
    const saneado = sanear({ email: 'laura.sosa@effort.com.py', ruc: '80012345-6' }) as Record<
      string,
      unknown
    >;

    expect(saneado['email']).toBe('l***@effort.com.py');
    // Quedan los últimos cinco caracteres: alcanzan para cotejar contra un
    // registro conocido, y no permiten reconstruir el RUC completo.
    expect(saneado['ruc']).toBe('***345-6');
  });

  it('sanea estructuras anidadas y arreglos', () => {
    const saneado = sanear({
      usuarios: [{ email: 'a@b.com', token: 'xyz' }],
    }) as { usuarios: Record<string, unknown>[] };

    expect(saneado.usuarios[0]?.['token']).toBe('[oculto]');
    expect(saneado.usuarios[0]?.['email']).toBe('a***@b.com');
  });

  it('no se cuelga con estructuras circulares', () => {
    const circular: Record<string, unknown> = { nombre: 'x' };
    circular['propio'] = circular;
    expect(() => sanear(circular)).not.toThrow();
  });

  it('serializa bigint, que es como viaja el dinero', () => {
    expect(sanear({ total: 6_000_000n })).toEqual({ total: '6000000' });
  });

  it('trunca IPv4 al último octeto e IPv6 al prefijo', () => {
    expect(truncarIp('190.128.50.77')).toBe('190.128.50.0');
    expect(truncarIp('::ffff:190.128.50.77')).toBe('190.128.50.0');
    expect(truncarIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
    expect(truncarIp(null)).toBeNull();
  });

  it('un error interno no filtra su mensaje original', () => {
    const publico = mensajePublicoDeError(500, 'pet-abc123');
    expect(publico).toContain('pet-abc123');
    expect(publico).not.toContain('SELECT');
    expect(mensajePublicoDeError(400, 'pet-abc123')).not.toContain('pet-abc123');
  });

  it('enmascara correos sin dominio válido en vez de dejarlos pasar', () => {
    expect(enmascararEmail('sin-arroba')).toBe('[oculto]');
    expect(enmascararEmail('@solodominio.com')).toBe('[oculto]');
  });
});
