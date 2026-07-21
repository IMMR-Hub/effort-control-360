/**
 * Límite de intentos y bloqueo progresivo.
 *
 * Impide dos cosas distintas:
 *   - que alguien pruebe contraseñas contra una cuenta concreta;
 *   - que un bot recorra la API pidiendo cualquier cosa a alta frecuencia.
 *
 * El contador va por (IP, correo) y no solo por IP: detrás de una misma IP
 * está toda la oficina de EFFORT, y bloquear la IP dejaría afuera a gente que
 * no hizo nada. Tampoco va solo por correo, porque entonces cualquiera podría
 * bloquear la cuenta de Laura a propósito probando contraseñas incorrectas.
 *
 * El almacenamiento se inyecta: hoy es memoria, mañana Redis, sin tocar la lógica.
 */

export interface RegistroDeIntentos {
  readonly intentosFallidos: number;
  readonly primerIntentoEn: Date;
  readonly bloqueadoHasta: Date | null;
}

export interface AlmacenDeIntentos {
  obtener(clave: string): RegistroDeIntentos | undefined;
  guardar(clave: string, registro: RegistroDeIntentos): void;
  borrar(clave: string): void;
}

export class AlmacenEnMemoria implements AlmacenDeIntentos {
  readonly #datos = new Map<string, RegistroDeIntentos>();

  obtener(clave: string): RegistroDeIntentos | undefined {
    return this.#datos.get(clave);
  }

  guardar(clave: string, registro: RegistroDeIntentos): void {
    this.#datos.set(clave, registro);
  }

  borrar(clave: string): void {
    this.#datos.delete(clave);
  }

  /** Limpia registros vencidos; lo llama una tarea periódica. */
  purgar(ahora: Date, ventanaMs: number): number {
    let purgados = 0;
    for (const [clave, registro] of this.#datos) {
      const vencido = ahora.getTime() - registro.primerIntentoEn.getTime() > ventanaMs;
      const desbloqueado = !registro.bloqueadoHasta || registro.bloqueadoHasta <= ahora;
      if (vencido && desbloqueado) {
        this.#datos.delete(clave);
        purgados += 1;
      }
    }
    return purgados;
  }
}

export interface PoliticaDeIntentos {
  readonly maximoIntentos: number;
  readonly ventanaMs: number;
  /** Bloqueos sucesivos, en milisegundos. El último se repite si sigue fallando. */
  readonly escalaDeBloqueoMs: readonly number[];
}

export const POLITICA_DE_ACCESO: PoliticaDeIntentos = Object.freeze({
  maximoIntentos: 5,
  ventanaMs: 15 * 60 * 1000,
  // 1 min, 5 min, 15 min, 1 h. Progresivo: molesta poco a quien se equivocó
  // de verdad y encarece mucho un ataque sostenido.
  escalaDeBloqueoMs: Object.freeze([60_000, 300_000, 900_000, 3_600_000]),
});

export function claveDeIntento(ip: string, identificador: string): string {
  return `${ip}|${identificador.trim().toLowerCase()}`;
}

export interface ResultadoDeVerificacion {
  readonly permitido: boolean;
  readonly intentosRestantes: number;
  readonly bloqueadoHasta: Date | null;
  readonly segundosParaReintentar: number;
}

export function verificarIntento(
  almacen: AlmacenDeIntentos,
  clave: string,
  ahora: Date,
  politica: PoliticaDeIntentos = POLITICA_DE_ACCESO,
): ResultadoDeVerificacion {
  const registro = almacen.obtener(clave);

  if (!registro) {
    return {
      permitido: true,
      intentosRestantes: politica.maximoIntentos,
      bloqueadoHasta: null,
      segundosParaReintentar: 0,
    };
  }

  if (registro.bloqueadoHasta && registro.bloqueadoHasta > ahora) {
    return {
      permitido: false,
      intentosRestantes: 0,
      bloqueadoHasta: registro.bloqueadoHasta,
      segundosParaReintentar: Math.ceil(
        (registro.bloqueadoHasta.getTime() - ahora.getTime()) / 1000,
      ),
    };
  }

  // La ventana venció sin llegar al tope: el contador arranca de nuevo.
  if (ahora.getTime() - registro.primerIntentoEn.getTime() > politica.ventanaMs) {
    return {
      permitido: true,
      intentosRestantes: politica.maximoIntentos,
      bloqueadoHasta: null,
      segundosParaReintentar: 0,
    };
  }

  return {
    permitido: registro.intentosFallidos < politica.maximoIntentos,
    intentosRestantes: Math.max(0, politica.maximoIntentos - registro.intentosFallidos),
    bloqueadoHasta: null,
    segundosParaReintentar: 0,
  };
}

/** Cuántos bloqueos ya se aplicaron, para saber en qué escalón está. */
function escalonDeBloqueo(intentosFallidos: number, politica: PoliticaDeIntentos): number {
  return Math.floor(intentosFallidos / politica.maximoIntentos) - 1;
}

export function registrarFallo(
  almacen: AlmacenDeIntentos,
  clave: string,
  ahora: Date,
  politica: PoliticaDeIntentos = POLITICA_DE_ACCESO,
): RegistroDeIntentos {
  const previo = almacen.obtener(clave);

  const ventanaVencida =
    previo && ahora.getTime() - previo.primerIntentoEn.getTime() > politica.ventanaMs;

  const intentosFallidos = !previo || ventanaVencida ? 1 : previo.intentosFallidos + 1;
  const primerIntentoEn = !previo || ventanaVencida ? ahora : previo.primerIntentoEn;

  let bloqueadoHasta: Date | null = null;
  if (intentosFallidos >= politica.maximoIntentos && intentosFallidos % politica.maximoIntentos === 0) {
    const escalon = Math.min(
      Math.max(0, escalonDeBloqueo(intentosFallidos, politica)),
      politica.escalaDeBloqueoMs.length - 1,
    );
    const duracion = politica.escalaDeBloqueoMs[escalon] ?? 0;
    bloqueadoHasta = new Date(ahora.getTime() + duracion);
  } else if (previo?.bloqueadoHasta && previo.bloqueadoHasta > ahora) {
    bloqueadoHasta = previo.bloqueadoHasta;
  }

  const registro: RegistroDeIntentos = { intentosFallidos, primerIntentoEn, bloqueadoHasta };
  almacen.guardar(clave, registro);
  return registro;
}

/** Un acceso correcto limpia el contador de esa combinación. */
export function registrarExito(almacen: AlmacenDeIntentos, clave: string): void {
  almacen.borrar(clave);
}
