/**
 * Respaldo diario de la base, guardado en el OneDrive del sistema.
 *
 * Existe por el incidente del 2026-09-13: se borró la base de producción entera
 * —11 usuarios, 5 clientes, 1574 documentos y la bitácora de auditoría— y **no
 * había ningún respaldo**. Supabase en plan Free no los incluye y nunca los
 * incluyó, así que la exposición estaba desde el primer día del proyecto. El
 * accidente no la creó: la puso a la vista.
 *
 * Lo que se perdió y no volvió fue la bitácora. Los documentos se pudieron
 * reindexar porque los archivos siguen en OneDrive; el registro de quién hizo
 * qué no tenía de dónde volver.
 *
 * ---
 *
 * **Tres decisiones, y ninguna es de comodidad:**
 *
 *  1. **Solo lee.** No hay una sola escritura a la base en este archivo. La
 *     herramienta que existe para proteger los datos no puede ser capaz de
 *     dañarlos — si algo sale mal acá, lo peor que pasa es que no haya respaldo,
 *     no que haya menos datos.
 *  2. **Va a OneDrive, no al disco del contenedor.** El contenedor se reemplaza
 *     en cada despliegue y se lleva lo que tenga adentro. Un respaldo que
 *     desaparece con el servidor no es un respaldo.
 *  3. **Se guarda uno por día y se conservan los últimos.** Un respaldo de hace
 *     una hora no sirve si el problema se descubre a la semana — que es lo
 *     normal cuando lo que se rompió es un dato y no el sistema.
 */

import type { FastifyBaseLogger } from 'fastify';

import type { DriveDeArchivos } from '@effort/drive';

/** Carpeta propia del sistema. Ver `CLAUDE.md`, regla 5. */
const CARPETA_DE_RESPALDOS = 'EFFORT Control 360/Respaldo';

/**
 * Aviso cuando el respaldo crece más de lo esperado.
 *
 * No es un límite: es una señal. El volcado completo pesaba 0,05 MB con 1574
 * documentos indexados, porque la base guarda metadatos y no archivos. Si algún
 * día pasa de esto, algo cambió de naturaleza —alguien guardó contenido en una
 * columna, por ejemplo— y conviene enterarse antes de que el respaldo deje de
 * caber en memoria.
 */
const TAMANO_QUE_LLAMA_LA_ATENCION_MB = 50;

/**
 * Modelos a respaldar, en orden de dependencia.
 *
 * El orden importa al restaurar: un documento referencia un cliente, así que el
 * cliente entra primero. Restaurar en orden inverso falla por claves foráneas.
 */
const MODELOS = [
  'usuario',
  'cliente',
  'obligacionTributaria',
  'obligacionDeCliente',
  'reglaImpositiva',
  'reglaNotificacion',
  'evidencia',
  'archivoDeOrigen',
  'documento',
  'procesoMensual',
  'vencimiento',
  'balance',
  'exportacionSiga',
  'comprobanteSiga',
  'liquidacion',
  'liquidacionIvaRg90',
  'hallazgoDeLibroRg90',
  'alerta',
  'registroContacto',
  'envioNotificacion',
  'eventLog',
] as const;

/** Lo mínimo que este servicio necesita saber leer. Un cliente de Prisma sirve. */
export interface LectorDeTablas {
  [modelo: string]: { findMany: () => Promise<unknown[]> } | unknown;
}

export interface ResumenDeRespaldo {
  readonly archivo: string;
  readonly filas: number;
  readonly tamanoMb: number;
  readonly modelosSalteados: readonly string[];
}

/**
 * `BigInt` no es serializable a JSON.
 *
 * Se guarda envuelto en vez de como texto plano para que al restaurar se
 * distinga un importe de una cadena que casualmente tiene dígitos. El dinero
 * son guaraníes en `bigint` (ADR 0002) y perder esa distinción sería perder
 * precisión sin que nadie lo note.
 */
function serializar(_clave: string, valor: unknown): unknown {
  return typeof valor === 'bigint' ? { __bigint: valor.toString() } : valor;
}

export async function generarRespaldo(
  lector: LectorDeTablas,
  drive: DriveDeArchivos,
  ahora: Date,
): Promise<ResumenDeRespaldo> {
  const contenido: Record<string, unknown[]> = {};
  const salteados: string[] = [];
  let filas = 0;

  for (const modelo of MODELOS) {
    const tabla = lector[modelo] as { findMany?: () => Promise<unknown[]> } | undefined;
    if (typeof tabla?.findMany !== 'function') {
      // Un modelo que no existe en este esquema no es un error: el respaldo
      // tiene que seguir funcionando mientras el esquema evoluciona.
      salteados.push(modelo);
      continue;
    }

    const datos = await tabla.findMany();
    contenido[modelo] = datos;
    filas += datos.length;
  }

  const texto = JSON.stringify(
    { generadoEn: ahora.toISOString(), modelos: contenido },
    serializar,
  );
  const bytes = Buffer.from(texto, 'utf8');

  // Un respaldo por día: el nombre lleva la fecha y nada más. Si corre dos veces
  // el mismo día, OneDrive lo versiona en vez de duplicarlo.
  const nombre = `respaldo-${ahora.toISOString().slice(0, 10)}.json`;
  await drive.escribir(CARPETA_DE_RESPALDOS, nombre, bytes);

  return {
    archivo: `${CARPETA_DE_RESPALDOS}/${nombre}`,
    filas,
    tamanoMb: Number((bytes.byteLength / 1024 / 1024).toFixed(3)),
    modelosSalteados: salteados,
  };
}

/**
 * Programa el respaldo diario.
 *
 * Corre una vez al día y no cada hora: el valor de un respaldo está en que
 * exista, no en que sea de hace un rato, y escribir un archivo por hora en
 * OneDrive es ruido en una carpeta que alguien va a tener que mirar el día que
 * las cosas salgan mal.
 */
export function programarRespaldoDiario(
  deps: {
    lector: LectorDeTablas;
    drive: DriveDeArchivos | null;
    ahora: () => Date;
  },
  registrador: FastifyBaseLogger,
): void {
  if (!deps.drive) {
    registrador.warn(
      'Sin credenciales de OneDrive: el respaldo automático de la base queda apagado. ' +
        'Se puede generar a mano con scripts/respaldar-base.mjs.',
    );
    return;
  }

  const CADA_DIA = 24 * 60 * 60 * 1000;
  // La primera media hora después de arrancar es la de más movimiento: un
  // despliegue, migraciones, gente entrando. El respaldo espera a que pase.
  const ESPERA_INICIAL = 30 * 60 * 1000;

  let enCurso = false;

  async function correr(): Promise<void> {
    if (enCurso) return;
    enCurso = true;

    try {
      const resumen = await generarRespaldo(deps.lector, deps.drive!, deps.ahora());

      if (resumen.tamanoMb > TAMANO_QUE_LLAMA_LA_ATENCION_MB) {
        registrador.warn(
          { tamanoMb: resumen.tamanoMb },
          'El respaldo creció más de lo esperado. La base guarda metadatos, no archivos: ' +
            'conviene mirar qué cambió antes de que deje de caber en memoria.',
        );
      }

      registrador.info(
        { archivo: resumen.archivo, filas: resumen.filas, tamanoMb: resumen.tamanoMb },
        'Respaldo diario de la base guardado en OneDrive.',
      );
    } catch (error) {
      // Que falle el respaldo no puede tumbar el proceso. Pero tiene que
      // gritar: un respaldo que falla en silencio es peor que no tenerlo,
      // porque se cree que está.
      registrador.error({ err: error }, 'FALLÓ el respaldo automático de la base.');
    } finally {
      enCurso = false;
    }
  }

  const primera = setTimeout(() => {
    void correr();
    const periodico = setInterval(() => void correr(), CADA_DIA);
    periodico.unref();
  }, ESPERA_INICIAL);

  primera.unref();
}
