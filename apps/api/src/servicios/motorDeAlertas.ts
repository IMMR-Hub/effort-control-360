/**
 * Motor de alertas: convierte el estado real del sistema en avisos accionables.
 *
 * Hasta el 2026-09-10 esto no existía. La tabla `alerta` estaba desde el
 * principio, la pantalla también, y el repositorio sabía listarlas y cerrarlas
 * — pero no había forma de crear una. Nadie lo había notado porque una pantalla
 * de alertas vacía se parece mucho a "no hay nada que avisar".
 *
 * Las reglas de acá no inventan criterios nuevos: reusan los umbrales que ya
 * usa el radar de vencimientos (`nivelAlertaPorDias` de `@effort/core`), para
 * que la pantalla de Vencimientos y la de Alertas no puedan contradecirse.
 *
 * Es seguro de correr muchas veces: el índice único parcial de la base impide
 * dos alertas abiertas del mismo origen sobre la misma entidad.
 */

import {
  diasRestantes,
  fechaCivilDesdeIso,
  nivelAlertaPorDias,
  type NivelAlerta,
} from '@effort/core';

import type {
  AltaDeAlerta,
  RepositorioDeAlertas,
  RepositorioDeProcesoMensual,
  RepositorioDeVencimientos,
} from '../puertos-dominio.js';

export interface DependenciasDelMotorDeAlertas {
  readonly alertas: RepositorioDeAlertas;
  readonly vencimientos: RepositorioDeVencimientos;
  readonly procesoMensual: RepositorioDeProcesoMensual;
  /**
   * Comprobantes con riesgo de multa, agrupados por cliente y período.
   *
   * Se pide agrupado y no fila por fila a propósito. En los datos reales del
   * piloto hay 49 comprobantes con riesgo: una alerta por cada uno serían 49
   * líneas nuevas en la pantalla, y una pantalla con 49 alertas del mismo tipo
   * es una pantalla que nadie mira — que es exactamente el problema que este
   * motor existe para evitar.
   */
  readonly riesgoDeLibro: RepositorioDeRiesgoDeLibro;
  /**
   * Declaraciones archivadas bajo el cliente equivocado.
   *
   * Opcional porque las dos llamadas al motor existían antes que esto y un
   * módulo que falte no puede dejar al sistema sin las alertas de vencimientos,
   * que es lo que más caro sale no tener — el mismo criterio que `riesgoDeLibro`.
   */
  readonly declaracionesAjenas?: RepositorioDeDeclaracionesAjenas | undefined;
}

/** Resumen de lo que hay que revisar en el libro de un cliente y período. */
export interface RiesgoDeLibroPorPeriodo {
  readonly clienteId: string;
  readonly periodo: string;
  /**
   * La liquidación de ese período, que es la entidad con la que se relaciona
   * la alerta.
   *
   * Hace falta porque `entidad_relacionada_id` es una columna UUID y la única
   * que evita alertas repetidas es `(origen, entidad_relacionada_id)`. El
   * primer intento armó una clave compuesta `clienteId|periodo` y Postgres la
   * rechazó: no es un UUID. Los tests no lo agarraron porque el doble no valida
   * el tipo — solo la base real lo hace.
   *
   * La liquidación del período ya ES esa entidad, con su propio identificador.
   * No hacía falta inventar una clave: había que mirar mejor el modelo.
   */
  readonly liquidacionId: string;
  readonly comprobantes: number;
  /** Cuánto IVA está en juego, en valor absoluto. */
  readonly ivaEnRiesgo: bigint;
}

export interface RepositorioDeRiesgoDeLibro {
  porPeriodo(): Promise<readonly RiesgoDeLibroPorPeriodo[]>;
}

/**
 * Una declaración que está en la carpeta de un cliente pero es de otro
 * contribuyente.
 *
 * Trae el nombre del archivo y el RUC ajeno porque el aviso tiene que poder
 * leerse sin abrir nada: quien lo mira necesita saber CUÁL archivo y DE QUIÉN
 * es, ahí mismo.
 */
export interface DeclaracionAjena {
  /** La evidencia es la entidad de la alerta: su id es un UUID de verdad. */
  readonly evidenciaId: string;
  readonly clienteId: string;
  readonly nombreDelCliente: string;
  readonly nombreArchivo: string;
  /** RUC que dice el PDF, sin dígito verificador. */
  readonly rucDelDocumento: string;
  /** Número de formulario de la DNIT, si se reconoció. */
  readonly formulario: string | null;
  readonly periodo: string | null;
}

export interface RepositorioDeDeclaracionesAjenas {
  listar(): Promise<readonly DeclaracionAjena[]>;
}

/**
 * Usuario al que se le atribuye un cierre automático.
 *
 * Se deja explícito en la bitácora que cerró el sistema y no una persona: una
 * alerta cerrada por alguien y una que se resolvió sola son cosas distintas
 * cuando después hay que rendir cuentas.
 */
const CERRADA_POR_EL_SISTEMA = 'El problema que la originó ya no existe.';

export interface ResumenDeAlertas {
  readonly creadas: number;
  readonly yaEstabanAbiertas: number;
  readonly evaluadas: number;
  /** Cerradas solas porque el problema que las originó ya no existe. */
  readonly resueltas: number;
  /** Abiertas cuyo texto, criticidad o fecha se pusieron al día en esta corrida. */
  readonly actualizadas: number;
}

export const ORIGEN_VENCIMIENTO = 'vencimiento_por_vencer';
export const ORIGEN_DOCUMENTACION = 'documentacion_faltante';
/**
 * Presentación hecha fuera de término (tarea 147).
 *
 * Es un aviso distinto de todos los demás: no pide hacer algo hoy, deja
 * constancia de algo que ya pasó. De ahí las tres reglas que lo separan del
 * resto — INFORMATIVA, no se cierra sola, y no se vuelve a levantar una vez
 * que una persona la cerró con motivo.
 *
 * **Nunca dice "multa"** (Daniel, 2026-09-15): el sistema informa días de
 * atraso; cuánto se multa lo decide la DNIT.
 *
 * Depende de que las prórrogas estén cargadas: el atraso se mide contra
 * `fechaVencimiento`, que es la prorrogada cuando hubo resolución. Sin la RG
 * 50/2026 cargada, esto habría avisado de tres atrasos que no existen.
 */
export const ORIGEN_PRESENTADO_CON_ATRASO = 'presentado_con_atraso';
/**
 * Comprobantes del libro cuyo IVA declarado no coincide con la regla.
 *
 * Daniel, 2026-09-13: *"estas discrepancias también tienen que alertar, ya que
 * al final puede representar una multa administrativa"*. El monto en juego es
 * chico —decenas de guaraníes en todo el piloto— y decirlo es parte del aviso:
 * el problema no es la plata, es que la DNIT cruza estos datos contra los del
 * proveedor y una diferencia dispara una revisión.
 */
export const ORIGEN_LIBRO_RIESGO = 'libro_con_riesgo_de_multa';

/**
 * Una declaración de otro contribuyente guardada en la carpeta de un cliente.
 *
 * Descubierto el 2026-09-20 al bajar un formulario 120 real: `120-07-2026.pdf`
 * estaba en la carpeta de COPESA y adentro decía MACOMA ENVIRONMENTAL
 * TECHNOLOGIES. Había tres casos así en el piloto.
 *
 * El detector de presentaciones ya se defendía —compara el RUC antes de marcar
 * un vencimiento como presentado, así que ninguno apagó una alerta— pero
 * descartaba el archivo **en silencio**, y ese silencio es el problema.
 *
 * Daniel, 2026-09-20: *"puede costar una multa luego por que capaz al
 * transcribir al SIGA se equivocan también"*. Ahí está el riesgo de verdad, y
 * es peor que el del vencimiento: el sistema se defiende de SU error, pero no
 * del error humano. Un archivo con el nombre correcto, en la carpeta correcta,
 * con la fecha correcta y otra empresa adentro es exactamente lo que nadie
 * abre para verificar — y los números terminan en la contabilidad de quien no
 * corresponde.
 *
 * Va en ALTA y no en CRITICA: no hay una multa en curso, hay una equivocación
 * esperando a que alguien la cometa.
 */
export const ORIGEN_DECLARACION_AJENA = 'declaracion_de_otro_contribuyente';

/**
 * Desde qué período se alerta sobre los libros.
 *
 * Desde la tarea 141 el sistema lee planillas de 2022 en adelante (COPESA), y
 * sin un límite cada diferencia de un libro de hace cuatro años abría una alerta
 * CRITICA. El sistema opera desde 2025 (las carteras de clientes empiezan el
 * 2025-01-01). El valor está pendiente de confirmar con EFFORT (plan maestro,
 * pregunta P5); los libros anteriores se siguen calculando y mostrando en la
 * pantalla de IVA, solo no alertan.
 */
export const PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO = '2025-01';

/**
 * Motivo de cierre de una alerta de libro que quedó fuera del período vigilado.
 * No es "el problema ya no existe": el problema puede seguir ahí, y decir lo
 * contrario sería falso en la bitácora.
 */
const CERRADA_FUERA_DE_PERIODO =
  `El período es anterior a ${PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO}: sobre esos libros ya no se alerta. ` +
  'Las diferencias siguen visibles en la pantalla de IVA.';

/**
 * Un vencimiento solo levanta alerta cuando entra en zona de riesgo.
 *
 * `INFORMATIVA` y `SIN_ALERTA` no generan nada: avisar de algo que vence en 25
 * días, todos los días, es la forma más rápida de que la gente deje de mirar
 * las alertas — y entonces tampoco ve la que sí importaba.
 */
const CRITICIDAD_POR_NIVEL: Partial<Record<NivelAlerta, string>> = {
  VENCIDO: 'CRITICA',
  CRITICA: 'CRITICA',
  ALTA: 'ALTA',
  MEDIA: 'MEDIA',
};

function fechaAIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export async function evaluarAlertas(
  deps: DependenciasDelMotorDeAlertas,
  ahora: Date,
  periodo: string,
  usuarioId: string,
): Promise<ResumenDeAlertas> {
  const [vencimientos, presentados, procesos, abiertas, riesgos, ajenas, yaAvisadas] =
    await Promise.all([
      deps.vencimientos.listar(null),
      deps.vencimientos.listarPresentados(null),
      deps.procesoMensual.listar(periodo, null),
      deps.alertas.listar(null),
      deps.riesgoDeLibro.porPeriodo(),
      deps.declaracionesAjenas?.listar() ?? [],
      // En cualquier estado, no solo abiertas: ver `ORIGEN_PRESENTADO_CON_ATRASO`.
      deps.alertas.yaRegistradas(ORIGEN_PRESENTADO_CON_ATRASO),
    ]);

  // Clave de lo que ya está abierto, para no recontar como "creada" algo que
  // la base va a saltar igual. La base es la que garantiza que no se duplique;
  // esto solo hace que el resumen que ve la persona sea honesto.
  const yaAbiertas = new Set(
    abiertas.map((alerta) => `${alerta.origen}|${alerta.entidadRelacionadaId ?? ''}`),
  );

  const candidatas: AltaDeAlerta[] = [];

  for (const vencimiento of vencimientos) {
    /*
     * Lo ya presentado no alerta. El repositorio ya lo filtra, así que esta
     * línea parece redundante — y sin embargo hace falta.
     *
     * El texto de la alerta AFIRMA "todavía no está registrado como
     * presentado". Una afirmación así no puede depender de que un repositorio,
     * en otro archivo, se acuerde de filtrar: el día que alguien agregue otra
     * forma de traer vencimientos, el motor empezaría a decirle a EFFORT que no
     * presentó algo que sí presentó. La regla vive donde se afirma, y acá tiene
     * un test que la fija.
     */
    if (vencimiento.estado === 'PRESENTADO' || vencimiento.estado === 'NO_APLICA') continue;

    const dias = diasRestantes(fechaCivilDesdeIso(fechaAIso(vencimiento.fechaVencimiento)), ahora);
    const criticidad = CRITICIDAD_POR_NIVEL[nivelAlertaPorDias(dias)];
    if (!criticidad) continue;

    const vencido = dias < 0;
    candidatas.push({
      clienteId: vencimiento.clienteId,
      periodo: null,
      origen: ORIGEN_VENCIMIENTO,
      criticidad,
      /*
       * Lo que el sistema sabe es que NO HAY comprobante archivado, no que no se
       * presentó (B4 del roadmap; Daniel, 2026-09-22: «todo está presentado,
       * solo que no subieron al OneDrive»). El texto no afirma ninguna de las
       * dos cosas, dice qué hacer en cada caso, y sigue siendo CRÍTICA: si de
       * verdad no se presentó, es una multa.
       */
      titulo: vencido
        ? `Vencido sin comprobante de presentación: ${vencimiento.descripcion}`
        : `Vence en ${dias} día${dias === 1 ? '' : 's'}: ${vencimiento.descripcion}`,
      detalle: vencido
        ? `Venció el ${fechaAIso(vencimiento.fechaVencimiento)} ante ${vencimiento.entidad} y en ` +
          `OneDrive no hay ninguna declaración que pruebe la presentación. Si ya se presentó, ` +
          `falta archivar el comprobante en la carpeta del cliente; si no, hay que presentarlo.`
        : `Vence el ${fechaAIso(vencimiento.fechaVencimiento)} ante ${vencimiento.entidad}.`,
      entidadRelacionada: 'vencimiento',
      entidadRelacionadaId: vencimiento.id,
      fechaLimite: vencimiento.fechaVencimiento,
    });
  }

  /*
   * Presentaciones fuera de término. Van después de los vencimientos porque
   * son el otro lado de la misma moneda: aquello ya se presentó, así que no
   * urge — pero que se haya presentado tarde tiene que quedar dicho una vez.
   */
  for (const presentado of presentados) {
    if (!presentado.fechaPresentacion) continue;

    const atraso = Math.round(
      (presentado.fechaPresentacion.getTime() - presentado.fechaVencimiento.getTime()) / 86_400_000,
    );
    if (atraso <= 0) continue;

    // Una vez levantada, no se vuelve a levantar: si una persona la cerró con
    // motivo, reabrirla cada 15 minutos haría que cerrarla no signifique nada.
    if (yaAvisadas.has(presentado.id)) continue;

    const dias = `${atraso} día${atraso === 1 ? '' : 's'}`;
    candidatas.push({
      clienteId: presentado.clienteId,
      periodo: null,
      origen: ORIGEN_PRESENTADO_CON_ATRASO,
      criticidad: 'INFORMATIVA',
      titulo: `Presentado con ${dias} de atraso: ${presentado.descripcion}`,
      detalle:
        `Vencía el ${fechaAIso(presentado.fechaVencimiento)} ante ${presentado.entidad} y se ` +
        `presentó el ${fechaAIso(presentado.fechaPresentacion)}: ${dias} de atraso. ` +
        `Queda como constancia; la cierra una persona cuando corresponda.`,
      entidadRelacionada: 'vencimiento',
      entidadRelacionadaId: presentado.id,
      fechaLimite: presentado.fechaVencimiento,
    });
  }

  for (const proceso of procesos) {
    if (proceso.documentosFaltantes <= 0) continue;

    candidatas.push({
      clienteId: proceso.clienteId,
      periodo: proceso.periodo,
      origen: ORIGEN_DOCUMENTACION,
      criticidad: proceso.documentosFaltantes > 5 ? 'ALTA' : 'MEDIA',
      titulo: `Faltan ${proceso.documentosFaltantes} documentos del período ${proceso.periodo}`,
      detalle:
        `El proceso mensual de ${proceso.periodo} registra ${proceso.documentosFaltantes} ` +
        `documentos faltantes. Sin ellos no se puede cerrar la liquidación del período.`,
      entidadRelacionada: 'proceso_mensual',
      entidadRelacionadaId: proceso.id,
      fechaLimite: null,
    });
  }

  /*
   * Una alerta por cliente y período, no una por comprobante.
   *
   * Va en CRITICA porque una multa administrativa lo es, y porque la ventana
   * para corregir se cierra cuando se presenta la declaración: después ya no se
   * arregla, se rectifica.
   */
  for (const riesgo of riesgos) {
    if (riesgo.comprobantes <= 0) continue;
    if (riesgo.periodo < PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO) continue;

    const plural = riesgo.comprobantes === 1 ? 'comprobante' : 'comprobantes';
    candidatas.push({
      clienteId: riesgo.clienteId,
      periodo: riesgo.periodo,
      origen: ORIGEN_LIBRO_RIESGO,
      criticidad: 'CRITICA',
      titulo:
        `${riesgo.comprobantes} ${plural} con riesgo de multa en el libro de ${riesgo.periodo}`,
      detalle:
        `El IVA declarado en ${riesgo.comprobantes} ${plural} no coincide con el que ` +
        `corresponde por la regla (Gs. ${riesgo.ivaEnRiesgo} en juego). Revisalos: si el ` +
        'período todavía no se presentó, antes de presentarlo; si ya se presentó, puede hacer ' +
        'falta una rectificativa. La DNIT cruza estos datos contra los del proveedor, y una diferencia ' +
        'dispara una revisión que cuesta mucho más que la diferencia. En la pantalla de IVA ' +
        'cada uno se acepta con motivo o se manda a revisar; la alerta se cierra sola cuando ' +
        'todos están aceptados.',
      entidadRelacionada: 'liquidacion_iva_rg90',
      entidadRelacionadaId: riesgo.liquidacionId,
      fechaLimite: null,
    });
  }

  /*
   * Un aviso por archivo mal archivado.
   *
   * No se agrupa por cliente como el riesgo de libro: acá cada archivo es una
   * cosa distinta que alguien tiene que ir a mirar y mover, y el aviso sirve
   * justamente porque nombra CUÁL. "Hay 3 archivos raros en COPESA" no le
   * ahorra el trabajo a nadie.
   *
   * Se cierra sola cuando el archivo deja de estar mal ubicado: si EFFORT lo
   * mueve, la evidencia deja de aparecer en la carpeta de ese cliente y el
   * cierre automático de más abajo la baja sin que nadie la toque.
   */
  for (const ajena of ajenas) {
    const queEs = ajena.formulario ? `El formulario ${ajena.formulario}` : 'La declaración';
    const deQuePeriodo = ajena.periodo ? ` del período ${ajena.periodo}` : '';

    candidatas.push({
      clienteId: ajena.clienteId,
      periodo: ajena.periodo,
      origen: ORIGEN_DECLARACION_AJENA,
      criticidad: 'ALTA',
      titulo: `"${ajena.nombreArchivo}" está en ${ajena.nombreDelCliente} pero es de otro contribuyente`,
      detalle:
        `${queEs}${deQuePeriodo} guardado como "${ajena.nombreArchivo}" en la carpeta de ` +
        `${ajena.nombreDelCliente} declara el RUC ${ajena.rucDelDocumento}, que no es el de ese ` +
        'cliente. **No uses estos números**: si se transcriben al SIGA, van a parar a la ' +
        'contabilidad de quien no corresponde, y eso se arregla con una rectificativa. ' +
        'El sistema NO lo tomó como presentado y NO tocó nada en OneDrive: mover o borrar el ' +
        'archivo lo decide EFFORT. Revisá también si falta el documento que sí correspondía a ' +
        'este cliente y período — puede estar sin presentar y nadie haberse enterado.',
      entidadRelacionada: 'evidencia',
      entidadRelacionadaId: ajena.evidenciaId,
      fechaLimite: null,
    });
  }

  const nuevas = candidatas.filter(
    (alta) => !yaAbiertas.has(`${alta.origen}|${alta.entidadRelacionadaId ?? ''}`),
  );

  const creadas = await deps.alertas.crear(nuevas);

  /*
   * Puesta al día de lo que ya estaba abierto. Hasta el 2026-09-23 una alerta
   * se escribía una vez y no se tocaba más: en producción había dos que decían
   * «Vence en 1 día» con nueve días de vencidas, y una «Vence en 8 días»,
   * MEDIA, ya vencida. El motor corre cada hora; lo que dice una alerta
   * abierta tiene que ser lo de hoy, y su criticidad también.
   */
  const candidataPorClave = new Map(
    candidatas.map((alta) => [`${alta.origen}|${alta.entidadRelacionadaId ?? ''}`, alta]),
  );
  let actualizadas = 0;
  for (const alerta of abiertas) {
    const vigente = candidataPorClave.get(`${alerta.origen}|${alerta.entidadRelacionadaId ?? ''}`);
    if (!vigente) continue;
    const fechaNueva = vigente.fechaLimite?.getTime() ?? null;
    const fechaVieja = alerta.fechaLimite?.getTime() ?? null;
    if (
      alerta.titulo === vigente.titulo &&
      alerta.detalle === vigente.detalle &&
      alerta.criticidad === vigente.criticidad &&
      fechaNueva === fechaVieja
    ) {
      continue;
    }
    await deps.alertas.actualizar(alerta.id, {
      titulo: vigente.titulo,
      detalle: vigente.detalle,
      criticidad: vigente.criticidad,
      fechaLimite: vigente.fechaLimite,
    });
    actualizadas += 1;
  }

  /*
   * Cierre automático: una alerta abierta cuya causa ya no aparece entre las
   * candidatas es una alerta resuelta.
   *
   * Esto es lo que reemplaza al "ignorar". Daniel fue explícito el 2026-09-11:
   * el sistema NUNCA puede dejar que se ignore una alerta. La única forma de
   * sacarla de la pantalla es que el problema deje de existir — que el
   * vencimiento quede presentado, o que los documentos faltantes se carguen.
   * Entonces se cierra sola, acá, y queda escrito por qué.
   */
  const vigentes = new Set(
    candidatas.map((alta) => `${alta.origen}|${alta.entidadRelacionadaId ?? ''}`),
  );

  let resueltas = 0;
  for (const alerta of abiertas) {
    /*
     * Solo las que levanta este motor, y ni siquiera todas: las de
     * `ORIGEN_PRESENTADO_CON_ATRASO` quedan deliberadamente fuera de esta
     * lista. Un hecho consumado no deja de ser cierto porque el motor vuelva a
     * correr — presentar tarde no se "resuelve". La cierra una persona.
     */
    if (
      alerta.origen !== ORIGEN_VENCIMIENTO &&
      alerta.origen !== ORIGEN_DOCUMENTACION &&
      alerta.origen !== ORIGEN_LIBRO_RIESGO &&
      alerta.origen !== ORIGEN_DECLARACION_AJENA
    ) {
      continue;
    }

    /*
     * Sin el módulo conectado, `ajenas` viene vacío y TODAS las alertas de
     * archivos mal ubicados parecerían resueltas. Cerrarlas sería mentir: el
     * archivo puede seguir ahí. Mejor dejarlas abiertas.
     */
    if (alerta.origen === ORIGEN_DECLARACION_AJENA && !deps.declaracionesAjenas) continue;

    const clave = `${alerta.origen}|${alerta.entidadRelacionadaId ?? ''}`;
    if (vigentes.has(clave)) continue;

    const fueraDePeriodo =
      alerta.origen === ORIGEN_LIBRO_RIESGO &&
      alerta.periodo !== null &&
      alerta.periodo < PRIMER_PERIODO_CON_ALERTAS_DE_LIBRO;
    await deps.alertas.cerrar(
      alerta.id,
      fueraDePeriodo ? CERRADA_FUERA_DE_PERIODO : CERRADA_POR_EL_SISTEMA,
      usuarioId,
      ahora,
    );
    resueltas += 1;
  }

  return {
    creadas,
    yaEstabanAbiertas: candidatas.length - creadas,
    evaluadas: vencimientos.length + procesos.length + riesgos.length + ajenas.length,
    resueltas,
    actualizadas,
  };
}
