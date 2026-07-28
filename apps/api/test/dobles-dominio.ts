/**
 * Dobles de prueba de los repositorios de negocio.
 *
 * Recordatorio de la lección del roadmap: estos dobles prueban rutas, permisos
 * y flujo. **No prueban la consulta.** El bug de `buscarPorId` (una condición
 * pisando a la otra) pasó 31 tests con dobles porque el doble implementaba la
 * lógica a mano y correctamente. Todo repositorio necesita además su test de
 * integración contra Postgres real.
 */

import { randomUUID } from 'node:crypto';

import type {
  AlertaAlmacenada,
  AltaDeDocumento,
  AltaDeReglaDeNotificacion,
  AltaDeReglaImpositiva,
  AltaDeVencimiento,
  BalanceAlmacenado,
  CamposEditablesDelProceso,
  CamposEditablesDeReglaDeNotificacion,
  CamposEditablesDeReglaImpositiva,
  CifrasDeBalance,
  DocumentoAlmacenado,
  FiltroDeCartera,
  ProcesoMensualAlmacenado,
  ReglaDeNotificacionAlmacenada,
  ReglaImpositivaAlmacenada,
  RepositorioDeAlertas,
  RepositorioDeBalances,
  RepositorioDeDocumentos,
  RepositorioDeProcesoMensual,
  RepositorioDeReglasDeNotificacion,
  RepositorioDeReglasImpositivas,
  RepositorioDeVencimientos,
  VencimientoAlmacenado,
  AltaDeExportacionSiga,
  AltaDeLiquidacion,
  ComprobanteSigaAlmacenado,
  DatosDeEnvio,
  ExportacionSigaAlmacenada,
  LiquidacionAlmacenada,
  RepositorioDeExportacionesSiga,
  RepositorioDeLiquidaciones,
} from '../src/puertos-dominio.js';

/** Aplica el filtro de cartera igual que lo haría el SQL. */
function alcanza(filtro: FiltroDeCartera, clienteId: string): boolean {
  return filtro === null || filtro.includes(clienteId);
}

/**
 * Igual que `alcanza`, pero para columnas de cliente nulleables (alerta).
 *
 * Replica `porCartera` de Prisma: sin filtro, `{}` no restringe nada — pasa
 * hasta lo que no tiene cliente. Con filtro, la condición es `clienteId IN
 * (...)`, y `NULL` nunca matchea un `IN`, así que una alerta sin cliente queda
 * afuera para cualquier usuario con cartera acotada.
 */
function alcanzaAlerta(filtro: FiltroDeCartera, clienteId: string | null): boolean {
  if (filtro === null) return true;
  if (clienteId === null) return false;
  return filtro.includes(clienteId);
}

export class DocumentosFalsos implements RepositorioDeDocumentos {
  readonly documentos: DocumentoAlmacenado[] = [];

  async listar(
    clienteId: string,
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<DocumentoAlmacenado[]> {
    if (!alcanza(filtro, clienteId)) return [];
    return this.documentos.filter(
      (doc) => doc.clienteId === clienteId && (!periodo || doc.periodo === periodo),
    );
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<DocumentoAlmacenado | null> {
    const doc = this.documentos.find((candidato) => candidato.id === id);
    if (!doc || !alcanza(filtro, doc.clienteId)) return null;
    return doc;
  }

  async registrar(datos: AltaDeDocumento): Promise<DocumentoAlmacenado> {
    const doc: DocumentoAlmacenado = {
      id: randomUUID(),
      clienteId: datos.clienteId,
      periodo: datos.periodo,
      tipo: datos.tipo,
      canalRecepcion: datos.canalRecepcion,
      recibidoEn: datos.recibidoEn,
      rucEmisor: datos.rucEmisor,
      timbrado: datos.timbrado,
      numeroComprobante: datos.numeroComprobante,
      total: datos.total,
      tasa: datos.tasa,
      anulado: datos.anulado,
      estado: 'RECIBIDO',
      motivoRechazo: null,
      evidenciaId: datos.evidenciaId,
      observaciones: datos.observaciones,
    };
    this.documentos.push(doc);
    return doc;
  }

  /**
   * Replica la restricción única real de `(clienteId, rucEmisor, timbrado,
   * numeroComprobante)` con `skipDuplicates`: NULL nunca colisiona con NULL
   * en un índice único de Postgres, así que una fila sin la terna completa
   * jamás se considera duplicada acá tampoco.
   */
  async registrarLote(datos: readonly AltaDeDocumento[]): Promise<DocumentoAlmacenado[]> {
    const clavesExistentes = new Set(
      this.documentos
        .filter((doc) => doc.rucEmisor && doc.timbrado && doc.numeroComprobante)
        .map((doc) => `${doc.clienteId}|${doc.rucEmisor}|${doc.timbrado}|${doc.numeroComprobante}`),
    );

    const insertados: DocumentoAlmacenado[] = [];
    for (const dato of datos) {
      const tieneTerna = Boolean(dato.rucEmisor && dato.timbrado && dato.numeroComprobante);
      const clave = tieneTerna
        ? `${dato.clienteId}|${dato.rucEmisor}|${dato.timbrado}|${dato.numeroComprobante}`
        : null;

      if (clave && clavesExistentes.has(clave)) continue;
      if (clave) clavesExistentes.add(clave);

      const doc = await this.registrar(dato);
      insertados.push(doc);
    }
    return insertados;
  }

  async cambiarEstado(
    id: string,
    estado: string,
    motivoRechazo: string | null,
  ): Promise<DocumentoAlmacenado> {
    const indice = this.documentos.findIndex((doc) => doc.id === id);
    const actualizado = { ...this.documentos[indice]!, estado, motivoRechazo };
    this.documentos[indice] = actualizado;
    return actualizado;
  }

  async documentosDelPeriodo(
    clienteId: string,
    periodo: string,
  ): Promise<DocumentoAlmacenado[]> {
    return this.documentos.filter(
      (doc) =>
        doc.clienteId === clienteId &&
        doc.periodo === periodo &&
        !['RECHAZADO', 'DUPLICADO'].includes(doc.estado),
    );
  }
}

function procesoVacio(clienteId: string, periodo: string): ProcesoMensualAlmacenado {
  return {
    id: randomUUID(),
    clienteId,
    periodo,
    comprobantesRetirados: false,
    fechaRetiro: null,
    documentosRecibidos: 0,
    documentosFaltantes: 0,
    documentosObservados: 0,
    comprasCargadasSiga: false,
    ventasCargadasSiga: false,
    retencionesCargadas: false,
    extractosRecibidos: false,
    conciliacionBancariaRealizada: false,
    ivaRevisado: false,
    ivaSaldoAPagar: null,
    ivaSaldoAFavor: null,
    liquidacionGenerada: false,
    liquidacionEnviada: false,
    balanceAplica: false,
    estadoGeneral: 'PENDIENTE',
    riesgo: 'BAJO',
    proximaAccion: null,
    fechaLimiteInterna: null,
    observaciones: null,
  };
}

export class ProcesoMensualFalso implements RepositorioDeProcesoMensual {
  readonly procesos: ProcesoMensualAlmacenado[] = [];

  async listar(periodo: string, filtro: FiltroDeCartera): Promise<ProcesoMensualAlmacenado[]> {
    return this.procesos.filter(
      (proceso) => proceso.periodo === periodo && alcanza(filtro, proceso.clienteId),
    );
  }

  async buscar(
    clienteId: string,
    periodo: string,
    filtro: FiltroDeCartera,
  ): Promise<ProcesoMensualAlmacenado | null> {
    if (!alcanza(filtro, clienteId)) return null;
    return (
      this.procesos.find(
        (proceso) => proceso.clienteId === clienteId && proceso.periodo === periodo,
      ) ?? null
    );
  }

  async asegurar(clienteId: string, periodo: string): Promise<ProcesoMensualAlmacenado> {
    const existente = this.procesos.find(
      (proceso) => proceso.clienteId === clienteId && proceso.periodo === periodo,
    );
    if (existente) return existente;

    const nuevo = procesoVacio(clienteId, periodo);
    this.procesos.push(nuevo);
    return nuevo;
  }

  async actualizar(
    clienteId: string,
    periodo: string,
    cambios: CamposEditablesDelProceso,
  ): Promise<ProcesoMensualAlmacenado> {
    const indice = this.procesos.findIndex(
      (proceso) => proceso.clienteId === clienteId && proceso.periodo === periodo,
    );
    const actualizado = { ...this.procesos[indice]!, ...cambios };
    this.procesos[indice] = actualizado;
    return actualizado;
  }
}

export class VencimientosFalsos implements RepositorioDeVencimientos {
  readonly vencimientos: VencimientoAlmacenado[] = [];

  async listar(filtro: FiltroDeCartera): Promise<VencimientoAlmacenado[]> {
    return this.vencimientos
      .filter(
        (venc) =>
          !['PRESENTADO', 'NO_APLICA'].includes(venc.estado) && alcanza(filtro, venc.clienteId),
      )
      .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime());
  }

  async listarPorCliente(
    clienteId: string,
    filtro: FiltroDeCartera,
  ): Promise<VencimientoAlmacenado[]> {
    if (!alcanza(filtro, clienteId)) return [];
    return this.vencimientos.filter((venc) => venc.clienteId === clienteId);
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<VencimientoAlmacenado | null> {
    const venc = this.vencimientos.find((candidato) => candidato.id === id);
    if (!venc || !alcanza(filtro, venc.clienteId)) return null;
    return venc;
  }

  async registrar(datos: AltaDeVencimiento): Promise<VencimientoAlmacenado> {
    const venc: VencimientoAlmacenado = {
      id: randomUUID(),
      clienteId: datos.clienteId,
      tipoDocumento: datos.tipoDocumento,
      descripcion: datos.descripcion,
      entidad: datos.entidad,
      fechaEmision: datos.fechaEmision,
      fechaVencimiento: datos.fechaVencimiento,
      fechaPresentacion: null,
      responsableId: datos.responsableId,
      estado: 'VIGENTE',
      riesgo: datos.riesgo,
      evidenciaId: datos.evidenciaId,
      proximaAccion: datos.proximaAccion,
    };
    this.vencimientos.push(venc);
    return venc;
  }

  async marcarPresentado(
    id: string,
    fechaPresentacion: Date,
    evidenciaId: string | null,
  ): Promise<VencimientoAlmacenado> {
    const indice = this.vencimientos.findIndex((venc) => venc.id === id);
    const actualizado: VencimientoAlmacenado = {
      ...this.vencimientos[indice]!,
      estado: 'PRESENTADO',
      fechaPresentacion,
      evidenciaId: evidenciaId ?? this.vencimientos[indice]!.evidenciaId,
    };
    this.vencimientos[indice] = actualizado;
    return actualizado;
  }
}

export class BalancesFalsos implements RepositorioDeBalances {
  readonly balances: BalanceAlmacenado[] = [];

  async listar(periodo: string | null, filtro: FiltroDeCartera): Promise<BalanceAlmacenado[]> {
    return this.balances.filter(
      (bal) => (!periodo || bal.periodo === periodo) && alcanza(filtro, bal.clienteId),
    );
  }

  async buscar(
    clienteId: string,
    periodo: string,
    filtro: FiltroDeCartera,
  ): Promise<BalanceAlmacenado | null> {
    if (!alcanza(filtro, clienteId)) return null;
    return (
      this.balances.find((bal) => bal.clienteId === clienteId && bal.periodo === periodo) ?? null
    );
  }

  async guardarCifras(
    clienteId: string,
    periodo: string,
    cifras: CifrasDeBalance,
    estado: string,
    inconsistencias: unknown,
    usuarioId: string,
  ): Promise<BalanceAlmacenado> {
    // El doble replica la barrera del repositorio real: si un test lograra
    // aprobar por esta vía, estaría probando algo que en producción no ocurre.
    if (estado === 'APROBADO') {
      throw new Error('guardarCifras no puede aprobar un balance.');
    }

    const indice = this.balances.findIndex(
      (bal) => bal.clienteId === clienteId && bal.periodo === periodo,
    );

    const balance: BalanceAlmacenado = {
      id: indice >= 0 ? this.balances[indice]!.id : randomUUID(),
      clienteId,
      periodo,
      activo: cifras.activo,
      pasivo: cifras.pasivo,
      patrimonioNeto: cifras.patrimonioNeto,
      resultadoEjercicio: cifras.resultadoEjercicio,
      estado,
      preparadoPorUsuarioId: usuarioId,
      aprobadoPorUsuarioId: null,
      aprobadoEn: null,
      inconsistencias,
      proximaAccion: null,
    };

    if (indice >= 0) this.balances[indice] = balance;
    else this.balances.push(balance);

    return balance;
  }

  async aprobar(
    clienteId: string,
    periodo: string,
    aprobadoPorUsuarioId: string,
    aprobadoEn: Date,
  ): Promise<BalanceAlmacenado> {
    const indice = this.balances.findIndex(
      (bal) => bal.clienteId === clienteId && bal.periodo === periodo,
    );
    const actualizado: BalanceAlmacenado = {
      ...this.balances[indice]!,
      estado: 'APROBADO',
      aprobadoPorUsuarioId,
      aprobadoEn,
    };
    this.balances[indice] = actualizado;
    return actualizado;
  }
}

export class ExportacionesSigaFalsas implements RepositorioDeExportacionesSiga {
  readonly exportaciones: ExportacionSigaAlmacenada[] = [];
  readonly comprobantes: ComprobanteSigaAlmacenado[] = [];

  async listar(
    clienteId: string,
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<ExportacionSigaAlmacenada[]> {
    if (!alcanza(filtro, clienteId)) return [];
    return this.exportaciones.filter(
      (exp) => exp.clienteId === clienteId && (!periodo || exp.periodo === periodo),
    );
  }

  async buscarPorId(
    id: string,
    filtro: FiltroDeCartera,
  ): Promise<ExportacionSigaAlmacenada | null> {
    const exp = this.exportaciones.find((candidata) => candidata.id === id);
    if (!exp || !alcanza(filtro, exp.clienteId)) return null;
    return exp;
  }

  async registrar(datos: AltaDeExportacionSiga): Promise<ExportacionSigaAlmacenada> {
    const exportacion: ExportacionSigaAlmacenada = {
      id: randomUUID(),
      clienteId: datos.clienteId,
      periodo: datos.periodo,
      tipoReporte: datos.tipoReporte,
      formato: datos.formato,
      evidenciaId: datos.evidenciaId,
      importadaEn: new Date(),
      filasLeidas: datos.comprobantes.length,
      estadoRevision: 'IMPORTADA',
      proximaAccion: null,
      observaciones: datos.observaciones,
    };
    this.exportaciones.push(exportacion);

    for (const fila of datos.comprobantes) {
      // Replica la unicidad de la clave natural que impone la base: reimportar
      // el mismo archivo no debe duplicar comprobantes.
      const yaEsta = this.comprobantes.some(
        (c) =>
          c.clienteId === datos.clienteId &&
          c.periodo === datos.periodo &&
          c.rucEmisor === fila.rucEmisor &&
          c.timbrado === fila.timbrado &&
          c.numeroComprobante === fila.numeroComprobante,
      );
      if (yaEsta) continue;

      this.comprobantes.push({
        id: randomUUID(),
        exportacionId: exportacion.id,
        clienteId: datos.clienteId,
        periodo: datos.periodo,
        rucEmisor: fila.rucEmisor,
        timbrado: fila.timbrado,
        numeroComprobante: fila.numeroComprobante,
        total: fila.total,
        tasa: fila.tasa,
        anulado: fila.anulado,
        fecha: fila.fecha,
      });
    }

    return exportacion;
  }

  async comprobantesDelPeriodo(
    clienteId: string,
    periodo: string,
  ): Promise<ComprobanteSigaAlmacenado[]> {
    return this.comprobantes.filter((c) => c.clienteId === clienteId && c.periodo === periodo);
  }

  async actualizarEstadoRevision(
    id: string,
    estado: string,
    proximaAccion: string | null,
  ): Promise<ExportacionSigaAlmacenada> {
    const indice = this.exportaciones.findIndex((e) => e.id === id);
    const actualizada = { ...this.exportaciones[indice]!, estadoRevision: estado, proximaAccion };
    this.exportaciones[indice] = actualizada;
    return actualizada;
  }
}

export class LiquidacionesFalsas implements RepositorioDeLiquidaciones {
  readonly liquidaciones: LiquidacionAlmacenada[] = [];

  async listar(
    periodo: string | null,
    filtro: FiltroDeCartera,
  ): Promise<LiquidacionAlmacenada[]> {
    return this.liquidaciones.filter(
      (l) => (!periodo || l.periodo === periodo) && alcanza(filtro, l.clienteId),
    );
  }

  async listarPorCliente(
    clienteId: string,
    filtro: FiltroDeCartera,
  ): Promise<LiquidacionAlmacenada[]> {
    if (!alcanza(filtro, clienteId)) return [];
    return this.liquidaciones.filter((l) => l.clienteId === clienteId);
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<LiquidacionAlmacenada | null> {
    const l = this.liquidaciones.find((candidata) => candidata.id === id);
    if (!l || !alcanza(filtro, l.clienteId)) return null;
    return l;
  }

  async registrar(datos: AltaDeLiquidacion): Promise<LiquidacionAlmacenada> {
    const liquidacion: LiquidacionAlmacenada = {
      id: randomUUID(),
      clienteId: datos.clienteId,
      periodo: datos.periodo,
      tipo: datos.tipo,
      archivoEvidenciaId: datos.archivoEvidenciaId,
      destinatario: null,
      canal: null,
      fechaEnvio: null,
      evidenciaEnvioId: null,
      responsableId: datos.responsableId,
      estado: datos.archivoEvidenciaId ? 'GENERADA' : 'PENDIENTE',
      respuestaCliente: null,
      respondidaEn: null,
      proximaAccion: null,
      observaciones: datos.observaciones,
    };
    this.liquidaciones.push(liquidacion);
    return liquidacion;
  }

  async marcarEnviada(id: string, envio: DatosDeEnvio): Promise<LiquidacionAlmacenada> {
    const indice = this.liquidaciones.findIndex((l) => l.id === id);
    const actualizada: LiquidacionAlmacenada = {
      ...this.liquidaciones[indice]!,
      estado: 'ENVIADA',
      destinatario: envio.destinatario,
      canal: envio.canal,
      fechaEnvio: envio.fechaEnvio,
      evidenciaEnvioId: envio.evidenciaEnvioId,
    };
    this.liquidaciones[indice] = actualizada;
    return actualizada;
  }

  async registrarRespuesta(
    id: string,
    respuesta: string,
    respondidaEn: Date,
  ): Promise<LiquidacionAlmacenada> {
    const indice = this.liquidaciones.findIndex((l) => l.id === id);
    const actualizada: LiquidacionAlmacenada = {
      ...this.liquidaciones[indice]!,
      estado: 'RESPONDIDA',
      respuestaCliente: respuesta,
      respondidaEn,
    };
    this.liquidaciones[indice] = actualizada;
    return actualizada;
  }
}

/** Mismo orden que el enum `Criticidad` en `schema.prisma`. */
const ORDEN_CRITICIDAD: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, INFORMATIVA: 3 };

export class AlertasFalsas implements RepositorioDeAlertas {
  readonly alertas: AlertaAlmacenada[] = [];

  async listar(filtro: FiltroDeCartera): Promise<AlertaAlmacenada[]> {
    return this.alertas
      .filter(
        (alerta) =>
          ['ABIERTA', 'EN_CURSO'].includes(alerta.estado) &&
          alcanzaAlerta(filtro, alerta.clienteId),
      )
      .sort((a, b) => ORDEN_CRITICIDAD[a.criticidad]! - ORDEN_CRITICIDAD[b.criticidad]!);
  }

  async buscarPorId(id: string, filtro: FiltroDeCartera): Promise<AlertaAlmacenada | null> {
    const alerta = this.alertas.find((candidata) => candidata.id === id);
    if (!alerta || !alcanzaAlerta(filtro, alerta.clienteId)) return null;
    return alerta;
  }

  async cerrar(
    id: string,
    motivoCierre: string,
    usuarioId: string,
    cerradaEn: Date,
  ): Promise<AlertaAlmacenada> {
    const indice = this.alertas.findIndex((alerta) => alerta.id === id);
    const actualizada: AlertaAlmacenada = {
      ...this.alertas[indice]!,
      estado: 'CERRADA',
      motivoCierre,
      cerradaPorUsuarioId: usuarioId,
      cerradaEn,
    };
    this.alertas[indice] = actualizada;
    return actualizada;
  }
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

export class ReglasImpositivasFalsas implements RepositorioDeReglasImpositivas {
  readonly reglas: ReglaImpositivaAlmacenada[] = [];

  async listar(): Promise<ReglaImpositivaAlmacenada[]> {
    return [...this.reglas].sort((a, b) => {
      if (a.tasa !== b.tasa) return a.tasa < b.tasa ? -1 : 1;
      return b.vigenteDesde.getTime() - a.vigenteDesde.getTime();
    });
  }

  async buscarPorId(id: string): Promise<ReglaImpositivaAlmacenada | null> {
    return this.reglas.find((candidata) => candidata.id === id) ?? null;
  }

  async crear(datos: AltaDeReglaImpositiva): Promise<ReglaImpositivaAlmacenada> {
    const indiceVigente = this.reglas.findIndex(
      (regla) => regla.tasa === datos.tasa && regla.vigenteHasta === null,
    );
    if (indiceVigente >= 0) {
      this.reglas[indiceVigente] = {
        ...this.reglas[indiceVigente]!,
        vigenteHasta: new Date(datos.vigenteDesde.getTime() - UN_DIA_MS),
      };
    }

    const nueva: ReglaImpositivaAlmacenada = {
      id: randomUUID(),
      nombre: datos.nombre,
      tasa: datos.tasa,
      divisorIvaIncluido: datos.divisorIvaIncluido,
      vigenteDesde: datos.vigenteDesde,
      vigenteHasta: null,
      requiereConfirmacionCliente: true,
      fuente: datos.fuente,
    };
    this.reglas.push(nueva);
    return nueva;
  }

  async actualizar(
    id: string,
    cambios: CamposEditablesDeReglaImpositiva,
  ): Promise<ReglaImpositivaAlmacenada> {
    const indice = this.reglas.findIndex((regla) => regla.id === id);
    const actualizada: ReglaImpositivaAlmacenada = { ...this.reglas[indice]!, ...cambios };
    this.reglas[indice] = actualizada;
    return actualizada;
  }
}

export class ReglasDeNotificacionFalsas implements RepositorioDeReglasDeNotificacion {
  readonly reglas: ReglaDeNotificacionAlmacenada[] = [];

  async listar(): Promise<ReglaDeNotificacionAlmacenada[]> {
    return [...this.reglas].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async buscarPorId(id: string): Promise<ReglaDeNotificacionAlmacenada | null> {
    return this.reglas.find((candidata) => candidata.id === id) ?? null;
  }

  async crear(datos: AltaDeReglaDeNotificacion): Promise<ReglaDeNotificacionAlmacenada> {
    const nueva: ReglaDeNotificacionAlmacenada = {
      id: randomUUID(),
      nombre: datos.nombre,
      activa: datos.activa,
      evento: datos.evento,
      diasHabilesDePlazo: datos.diasHabilesDePlazo,
      horaDeEnvio: datos.horaDeEnvio,
      reintentarCadaDiasHabiles: datos.reintentarCadaDiasHabiles,
      maximoRecordatorios: datos.maximoRecordatorios,
      escalarAPartirDelRecordatorio: datos.escalarAPartirDelRecordatorio,
      destinatariosIniciales: datos.destinatariosIniciales,
      destinatariosDeEscalamiento: datos.destinatariosDeEscalamiento,
      clientesAlcanzados: datos.clientesAlcanzados,
      plantillaId: datos.plantillaId,
    };
    this.reglas.push(nueva);
    return nueva;
  }

  async actualizar(
    id: string,
    cambios: CamposEditablesDeReglaDeNotificacion,
  ): Promise<ReglaDeNotificacionAlmacenada> {
    const indice = this.reglas.findIndex((regla) => regla.id === id);
    const actualizada: ReglaDeNotificacionAlmacenada = { ...this.reglas[indice]!, ...cambios };
    this.reglas[indice] = actualizada;
    return actualizada;
  }
}
