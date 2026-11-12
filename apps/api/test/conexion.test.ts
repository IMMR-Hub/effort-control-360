/**
 * Por dónde entra la aplicación a la base (2026-11-12): la entrada de sesión de
 * Supabase cuesta una ida y vuelta por consulta; la de transacciones, cinco.
 * Las cadenas de acá son inventadas: ninguna es una credencial real.
 */

import { describe, expect, it } from 'vitest';

import { conexionDeLaApp } from '../src/repositorios/conexion.js';

const TRANSACCIONES =
  'postgresql://postgres.abcdefgh:clave-de-prueba@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

describe('conexión de la aplicación a la base', () => {
  it('en modo sesión pasa del puerto 6543 al 5432, con el mismo usuario, clave y servidor', () => {
    const { url, descripcion } = conexionDeLaApp(TRANSACCIONES, 'sesion', 5);
    const resultado = new URL(url);

    expect(resultado.port).toBe('5432');
    expect(resultado.hostname).toBe('aws-0-sa-east-1.pooler.supabase.com');
    expect(resultado.username).toBe('postgres.abcdefgh');
    expect(resultado.password).toBe('clave-de-prueba');
    expect(resultado.pathname).toBe('/postgres');
    expect(resultado.searchParams.has('pgbouncer')).toBe(false);
    expect(descripcion).toMatch(/sesión/);
  });

  it('fija el tope de conexiones: en modo sesión cada una ocupa un lugar real en Supabase', () => {
    const { url } = conexionDeLaApp(TRANSACCIONES, 'sesion', 5);
    expect(new URL(url).searchParams.get('connection_limit')).toBe('5');

    const conOtroTope = conexionDeLaApp(`${TRANSACCIONES}&connection_limit=40`, 'sesion', 7);
    expect(new URL(conOtroTope.url).searchParams.get('connection_limit')).toBe('7');
  });

  it('el interruptor «transacciones» deja la cadena exactamente como estaba', () => {
    expect(conexionDeLaApp(TRANSACCIONES, 'transacciones', 5).url).toBe(TRANSACCIONES);
  });

  it('no toca una cadena que no es el pooler de transacciones de Supabase', () => {
    for (const cadena of [
      'postgresql://usuario:clave@localhost:5432/effort',
      'postgresql://usuario:clave@localhost:6543/effort',
      'postgresql://postgres.abcdefgh:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
      'esto no es una url',
    ]) {
      expect(conexionDeLaApp(cadena, 'sesion', 5).url).toBe(cadena);
    }
  });

  it('lo que se anota en el log nunca incluye la cadena ni la clave', () => {
    for (const modo of ['sesion', 'transacciones'] as const) {
      const { descripcion } = conexionDeLaApp(TRANSACCIONES, modo, 5);
      expect(descripcion).not.toContain('clave-de-prueba');
      expect(descripcion).not.toContain('postgres.abcdefgh');
      expect(descripcion).not.toContain('pooler.supabase.com');
    }
  });
});
