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
  AltaDeDocumento,
  AltaDeVencimiento,
  BalanceAlmacenado,
  CamposEditablesDelProceso,
  CifrasDeBalance,
  DocumentoAlmacenado,
  FiltroDeCartera,
  ProcesoMensualAlmacenado,
  RepositorioDeBalances,
  RepositorioDeDocumentos,
  RepositorioDeProcesoMensual,
  RepositorioDeVencimientos,
  VencimientoAlmacenado,
} from '../src/puertos-dominio.js';

/** Aplica el filtro de cartera igual que lo haría el SQL. */
function alcanza(filtro: FiltroDeCartera, clienteId: string): boolean {
  return filtro === null || filtro.includes(clienteId);
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

  async comprobantesDelPeriodo(
    clienteId: string,
    periodo: string,
  ): Promise<DocumentoAlmacenado[]> {
    return this.documentos.filter(
      (doc) =>
        doc.clienteId === clienteId &&
        doc.periodo === periodo &&
        !['RECHAZADO', 'DUPLICADO'].includes(doc.estado) &&
        doc.numeroComprobante !== null,
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
