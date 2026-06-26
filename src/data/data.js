export const CLIENTES = [
  { id: 'CLI-001', nombre: 'GARSO S.A.', responsable: 'Laura Sosa', coordinador: 'Karina Fretes', auxiliar: 'Aracely Gaona', periodo: 'Abril 2026', canal: 'Drive / Físico', docsRecibidos: 36, docsPendientes: 4, estadoDocumental: 'Parcial', estadoSIGA: 'En proceso', estadoLiquidacion: 'Pendiente', estadoBalance: 'Pendiente', riesgo: 'Medio', estadoGeneral: 'En proceso', proximaAccion: 'Solicitar extracto bancario y confirmar carga SIGA' },
  { id: 'CLI-002', nombre: 'LAURA SOSA', responsable: 'Laura Sosa', coordinador: 'Karina Fretes', auxiliar: 'Aracely Gaona', periodo: 'Abril 2026', canal: 'Drive', docsRecibidos: 42, docsPendientes: 2, estadoDocumental: 'Controlado', estadoSIGA: 'Cargado', estadoLiquidacion: 'Enviada', estadoBalance: 'Pre-revisado', riesgo: 'Bajo', estadoGeneral: 'Controlado', proximaAccion: 'Revisión final de balance' },
  { id: 'CLI-003', nombre: 'RAMIRO GARCIA', responsable: 'Laura Sosa', coordinador: 'Karina Fretes', auxiliar: 'Aracely Gaona', periodo: 'Abril 2026', canal: 'WhatsApp / Físico', docsRecibidos: 28, docsPendientes: 9, estadoDocumental: 'Parcial', estadoSIGA: 'Parcial', estadoLiquidacion: 'Pendiente', estadoBalance: 'Bloqueado', riesgo: 'Alto', estadoGeneral: 'Observado', proximaAccion: 'Reclamar comprobantes faltantes y validar documentos con baja calidad' },
  { id: 'CLI-004', nombre: 'GERARDO SOSA', responsable: 'Laura Sosa', coordinador: 'Karina Fretes', auxiliar: 'Aracely Gaona', periodo: 'Abril 2026', canal: 'Email / Drive', docsRecibidos: 31, docsPendientes: 5, estadoDocumental: 'Parcial', estadoSIGA: 'En proceso', estadoLiquidacion: 'Reclamada', estadoBalance: 'Pendiente', riesgo: 'Medio', estadoGeneral: 'En proceso', proximaAccion: 'Revisar diferencias entre documentos recibidos y carga SIGA' },
  { id: 'CLI-005', nombre: 'NR REGISTROS GANADEROS', responsable: 'Laura Sosa', coordinador: 'Karina Fretes', auxiliar: 'Aracely Gaona', periodo: 'Abril 2026', canal: 'SIGA / PDF', docsRecibidos: 47, docsPendientes: 3, estadoDocumental: 'Controlado', estadoSIGA: 'Cargado', estadoLiquidacion: 'Enviada', estadoBalance: 'Pre-revisado', riesgo: 'Bajo', estadoGeneral: 'Controlado', proximaAccion: 'Enviar resumen ejecutivo mensual' },
]

export const KPIS = [
  { id: 'clientes', title: 'Clientes piloto', value: 5, unit: '', trend: 'Piloto inicial', status: 'info', icon: 'Users' },
  { id: 'docs_recibidos', title: 'Documentos recibidos', value: 184, unit: '', trend: '+38 esta semana', status: 'success', icon: 'FileText' },
  { id: 'docs_pendientes', title: 'Documentos pendientes', value: 23, unit: '', trend: 'Requieren seguimiento', status: 'warning', icon: 'Clock' },
  { id: 'vencimientos', title: 'Vencimientos próximos', value: 9, unit: '', trend: 'Próximos 30 días', status: 'warning', icon: 'CalendarClock' },
  { id: 'alertas', title: 'Alertas críticas', value: 4, unit: '', trend: 'Atención inmediata', status: 'danger', icon: 'AlertTriangle' },
  { id: 'balances', title: 'Balances pendientes', value: 3, unit: '', trend: 'Pre-revisión requerida', status: 'warning', icon: 'BarChart3' },
  { id: 'liquidaciones', title: 'Liquidaciones enviadas', value: 4, unit: '', trend: '80% del piloto', status: 'success', icon: 'Send' },
  { id: 'horas', title: 'Horas ahorradas est.', value: 31, unit: 'h', trend: 'Proyección mensual', status: 'success', icon: 'Timer' },
]

export const DOCUMENTOS = [
  { id: 'DOC-001', clienteId: 'CLI-005', cliente: 'NR REGISTROS GANADEROS', periodo: 'Abril 2026', tipo: 'Determinación IVA', canal: 'PDF / SIGA', fecha: '2026-05-12', confianza: 97, estado: 'Clasificado', requiereRevision: false, archivo: 'DETERMINACIÓN DEL IVA ABRIL 2026 NR REGISTROS G.pdf', datoClave: 'Saldo a pagar: Gs. 2.037.595' },
  { id: 'DOC-002', clienteId: 'CLI-005', cliente: 'NR REGISTROS GANADEROS', periodo: 'Abril 2026', tipo: 'Libro de Ventas', canal: 'PDF / SIGA', fecha: '2026-05-12', confianza: 95, estado: 'Clasificado', requiereRevision: false, archivo: 'LIBRO VENTAS ABRIL 2026 NR REGISTROS GANADEROS.pdf', datoClave: 'Ventas total: Gs. 43.236.500' },
  { id: 'DOC-003', clienteId: 'CLI-005', cliente: 'NR REGISTROS GANADEROS', periodo: 'Abril 2026', tipo: 'Libro de Compras', canal: 'PDF / SIGA', fecha: '2026-05-12', confianza: 95, estado: 'Clasificado', requiereRevision: false, archivo: 'LIBRO COMPRAS ABRIL 2026 NR REGISTROS G.pdf', datoClave: 'Compras total: Gs. 19.057.758' },
  { id: 'DOC-004', clienteId: 'CLI-002', cliente: 'LAURA SOSA', periodo: '2024', tipo: 'Estados Financieros', canal: 'MARANGATU / PDF', fecha: '2026-06-25', confianza: 93, estado: 'Clasificado', requiereRevision: false, archivo: 'Consultar adjuntos estados financieros MARANGATU.pdf', datoClave: 'Resultado: -Gs. 4.034.751' },
  { id: 'DOC-005', clienteId: 'CLI-003', cliente: 'RAMIRO GARCIA', periodo: 'Abril 2026', tipo: 'Factura / Comprobante', canal: 'WhatsApp', fecha: '2026-05-10', confianza: 72, estado: 'Revisión humana', requiereRevision: true, archivo: 'factura_ramiro_abril.jpg', datoClave: 'Requiere validación manual' },
  { id: 'DOC-006', clienteId: 'CLI-001', cliente: 'GARSO S.A.', periodo: 'Abril 2026', tipo: 'Extracto bancario', canal: 'Drive', fecha: '2026-05-08', confianza: 68, estado: 'Pendiente', requiereRevision: true, archivo: 'extracto_garso_abr26.pdf', datoClave: 'Pendiente confirmación' },
  { id: 'DOC-007', clienteId: 'CLI-004', cliente: 'GERARDO SOSA', periodo: 'Abril 2026', tipo: 'Comprobante SIGA', canal: 'Email', fecha: '2026-05-09', confianza: 88, estado: 'Clasificado', requiereRevision: false, archivo: 'comprobante_gerardo_abr26.pdf', datoClave: 'Diferencia de Gs. 320.000 detectada' },
]

export const IVA = [
  { cliente: 'NR REGISTROS GANADEROS', periodo: 'Abril 2026', ivaDebito10: 3930591, ivaCredito10: 1732524, ivaCredito5: 0, retenciones: 160473, saldoPagar: 2037595, ventasGravadas10: 39305910, ventasTotal: 43236500, comprasGravadas10: 17325235, comprasTotal: 19057758, estado: 'Controlado', alerta: null },
  { cliente: 'GARSO S.A.', periodo: 'Abril 2026', ivaDebito10: 2650000, ivaCredito10: 1410000, ivaCredito5: 0, retenciones: 0, saldoPagar: 1240000, ventasGravadas10: 26500000, ventasTotal: 29150000, comprasGravadas10: 14100000, comprasTotal: 15510000, estado: 'En proceso', alerta: 'Pendiente confirmar extracto bancario' },
  { cliente: 'RAMIRO GARCIA', periodo: 'Abril 2026', ivaDebito10: 1180000, ivaCredito10: 730000, ivaCredito5: 0, retenciones: 0, saldoPagar: 450000, ventasGravadas10: 11800000, ventasTotal: 12980000, comprasGravadas10: 7300000, comprasTotal: 8030000, estado: 'Observado', alerta: 'Documentos con baja confianza IA' },
]

export const VENCIMIENTOS = [
  { id: 'VEN-001', clienteId: 'CLI-001', cliente: 'GARSO S.A.', tipo: 'Presentación societaria', descripcion: 'Presentación anual pendiente', fechaVencimiento: '2026-07-10', diasRestantes: 15, responsable: 'Laura Sosa', estado: 'Próximo', riesgo: 'Alto', accion: 'Preparar documentación y asignar revisión antes de 7 días' },
  { id: 'VEN-002', clienteId: 'CLI-003', cliente: 'RAMIRO GARCIA', tipo: 'Presentación Abogacía', descripcion: 'Riesgo de multa si no se confirma presentación', fechaVencimiento: '2026-07-02', diasRestantes: 7, responsable: 'Karina Fretes', estado: 'Crítico', riesgo: 'Crítico', accion: 'Escalar hoy y confirmar evidencia en Drive' },
  { id: 'VEN-003', clienteId: 'CLI-002', cliente: 'LAURA SOSA', tipo: 'Certificado', descripcion: 'Certificado con vencimiento próximo', fechaVencimiento: '2026-07-25', diasRestantes: 30, responsable: 'Aracely Gaona', estado: 'Próximo', riesgo: 'Medio', accion: 'Solicitar renovación preventiva' },
  { id: 'VEN-004', clienteId: 'CLI-004', cliente: 'GERARDO SOSA', tipo: 'Contrato', descripcion: 'Contrato sin fecha final detectada', fechaVencimiento: null, diasRestantes: null, responsable: 'Karina Fretes', estado: 'Observado', riesgo: 'Medio', accion: 'Revisión humana del documento' },
]

export const BALANCES = [
  { id: 'BAL-001', clienteId: 'CLI-002', cliente: 'LAURA SOSA', periodo: '2024', activo: 191339953, pasivo: 50000, patrimonioNeto: 191289953, resultado: -4034751, estado: 'Pre-revisado', revisor: 'Pendiente de asignar', inconsistencias: ['Resultado del ejercicio negativo', 'Revisar composición de disponibilidades', 'Validar créditos por impuestos corrientes'], accion: 'Enviar al revisor principal con resumen ejecutivo' },
  { id: 'BAL-002', clienteId: 'CLI-005', cliente: 'NR REGISTROS GANADEROS', periodo: 'Abril 2026', activo: null, pasivo: null, patrimonioNeto: null, resultado: null, estado: 'Pendiente', revisor: 'Laura Sosa', inconsistencias: ['Falta exportación de balance del periodo', 'IVA y libros disponibles para control mensual'], accion: 'Solicitar exportación de balance desde SIGA' },
  { id: 'BAL-003', clienteId: 'CLI-003', cliente: 'RAMIRO GARCIA', periodo: 'Abril 2026', activo: null, pasivo: null, patrimonioNeto: null, resultado: null, estado: 'Bloqueado', revisor: 'Laura Sosa', inconsistencias: ['Documentos pendientes', 'Comprobantes con baja confianza IA'], accion: 'No enviar a revisión hasta completar documentación' },
]

export const SIGA = [
  { clienteId: 'CLI-005', cliente: 'NR REGISTROS GANADEROS', periodo: 'Abril 2026', exportacion: 'Disponible', docsRecibidos: 47, docsCargados: 44, diferencias: 3, estado: 'Controlado con observaciones', accion: 'Validar 3 documentos pendientes' },
  { clienteId: 'CLI-001', cliente: 'GARSO S.A.', periodo: 'Abril 2026', exportacion: 'Pendiente', docsRecibidos: 36, docsCargados: 27, diferencias: 9, estado: 'En proceso', accion: 'Subir exportación SIGA' },
  { clienteId: 'CLI-002', cliente: 'LAURA SOSA', periodo: 'Abril 2026', exportacion: 'Disponible', docsRecibidos: 42, docsCargados: 42, diferencias: 0, estado: 'Cargado completo', accion: 'Cerrar periodo' },
  { clienteId: 'CLI-003', cliente: 'RAMIRO GARCIA', periodo: 'Abril 2026', exportacion: 'Parcial', docsRecibidos: 28, docsCargados: 19, diferencias: 9, estado: 'Parcial', accion: 'Completar documentos faltantes' },
  { clienteId: 'CLI-004', cliente: 'GERARDO SOSA', periodo: 'Abril 2026', exportacion: 'Disponible', docsRecibidos: 31, docsCargados: 26, diferencias: 5, estado: 'En proceso', accion: 'Revisar diferencias con responsable' },
]

export const LIQUIDACIONES = [
  { id: 'LIQ-001', clienteId: 'CLI-005', cliente: 'NR REGISTROS GANADEROS', periodo: 'Abril 2026', archivo: 'liquidacion_iva_abril_2026_nr.pdf', destinatario: 'cliente@demo.com', canal: 'Email', fechaEnvio: '2026-05-13', estado: 'Enviada', comprobante: 'Guardado', accion: 'Esperar confirmación' },
  { id: 'LIQ-002', clienteId: 'CLI-002', cliente: 'LAURA SOSA', periodo: 'Abril 2026', archivo: 'liquidacion_abril_2026_laura.pdf', destinatario: 'cliente@demo.com', canal: 'Email', fechaEnvio: '2026-05-13', estado: 'Respondida', comprobante: 'Guardado', accion: 'Cerrar' },
  { id: 'LIQ-003', clienteId: 'CLI-003', cliente: 'RAMIRO GARCIA', periodo: 'Abril 2026', archivo: 'pendiente', destinatario: 'cliente@demo.com', canal: 'WhatsApp', fechaEnvio: null, estado: 'Pendiente', comprobante: 'No disponible', accion: 'Completar documentos antes de enviar' },
  { id: 'LIQ-004', clienteId: 'CLI-004', cliente: 'GERARDO SOSA', periodo: 'Abril 2026', archivo: 'liquidacion_gerardo_abr26.pdf', destinatario: 'cliente@demo.com', canal: 'Email', fechaEnvio: '2026-05-14', estado: 'Reclamada', comprobante: 'Parcial', accion: 'Enviar comprobante completo' },
]

export const ALERTAS = [
  { id: 'ALT-001', nivel: 'Crítica', clienteId: 'CLI-003', cliente: 'RAMIRO GARCIA', mensaje: 'Presentación de Abogacía vence en 7 días.', impacto: 'Puede generar multa si no se confirma presentación.', responsable: 'Karina Fretes', accion: 'Escalar hoy y cargar evidencia', estado: 'Abierta' },
  { id: 'ALT-002', nivel: 'Alta', clienteId: 'CLI-001', cliente: 'GARSO S.A.', mensaje: 'Exportación SIGA pendiente. No se puede validar carga completa.', impacto: 'Retrasa cierre del periodo.', responsable: 'Aracely Gaona', accion: 'Solicitar exportación Excel/PDF', estado: 'Abierta' },
  { id: 'ALT-003', nivel: 'Media', clienteId: 'CLI-005', cliente: 'NR REGISTROS GANADEROS', mensaje: '3 documentos pendientes de validación contra SIGA.', impacto: 'Podría quedar diferencia documental.', responsable: 'Aracely Gaona', accion: 'Validar documentos', estado: 'En proceso' },
  { id: 'ALT-004', nivel: 'Alta', clienteId: 'CLI-003', cliente: 'RAMIRO GARCIA', mensaje: 'Balance bloqueado por documentos faltantes.', impacto: 'Puede retrasar revisión principal.', responsable: 'Laura Sosa', accion: 'Completar checklist documental', estado: 'Abierta' },
]

export const RESPONSABLES = [
  { nombre: 'Laura Sosa', rol: 'Responsable', clientes: 5, docsAsignados: 184, docsPendientes: 23, alertasAbiertas: 2, cargaEstimada: 'Alta', hrsEstimadas: 18 },
  { nombre: 'Karina Fretes', rol: 'Coordinadora', clientes: 5, docsAsignados: 184, docsPendientes: 14, alertasAbiertas: 3, cargaEstimada: 'Media', hrsEstimadas: 12 },
  { nombre: 'Aracely Gaona', rol: 'Auxiliar', clientes: 5, docsAsignados: 184, docsPendientes: 23, alertasAbiertas: 2, cargaEstimada: 'Alta', hrsEstimadas: 16 },
]

export const FILTER_OPTIONS = {
  periodo: ['Abril 2026', 'Mayo 2026', 'Junio 2026', '2026 completo'],
  cliente: ['Todos', 'GARSO S.A.', 'LAURA SOSA', 'RAMIRO GARCIA', 'GERARDO SOSA', 'NR REGISTROS GANADEROS'],
  responsable: ['Todos', 'Laura Sosa'],
  coordinador: ['Todos', 'Karina Fretes'],
  auxiliar: ['Todos', 'Aracely Gaona'],
  estado: ['Todos', 'Controlado', 'Completo', 'En proceso', 'Parcial', 'Pendiente', 'Observado', 'Crítico'],
  riesgo: ['Todos', 'Bajo', 'Medio', 'Alto', 'Crítico'],
  visualizacion: ['Tarjetas', 'Tabla', 'Barras', 'Torta', 'Línea'],
}

export const CHART_DATA = {
  estadoClientes: [
    { name: 'Completo', value: 2, color: '#16A34A' },
    { name: 'En proceso', value: 2, color: '#2563EB' },
    { name: 'Observado', value: 1, color: '#F59E0B' },
  ],
  docsPorCliente: [
    { cliente: 'NR REGISTROS', recibidos: 47, pendientes: 3 },
    { cliente: 'LAURA SOSA', recibidos: 42, pendientes: 2 },
    { cliente: 'GARSO S.A.', recibidos: 36, pendientes: 4 },
    { cliente: 'GERARDO SOSA', recibidos: 31, pendientes: 5 },
    { cliente: 'RAMIRO GARCIA', recibidos: 28, pendientes: 9 },
  ],
  horasAhorradas: [
    { semana: 'Sem 1', horas: 6 },
    { semana: 'Sem 2', horas: 11 },
    { semana: 'Sem 3', horas: 14 },
    { semana: 'Sem 4', horas: 31 },
  ],
  vencimientosPorRiesgo: [
    { riesgo: 'Crítico', cantidad: 1, color: '#DC2626' },
    { riesgo: 'Alto', cantidad: 1, color: '#F59E0B' },
    { riesgo: 'Medio', cantidad: 2, color: '#2563EB' },
    { riesgo: 'Bajo', cantidad: 0, color: '#16A34A' },
  ],
}

export const AI_QUESTIONS = [
  '¿Qué clientes están en riesgo este mes?',
  '¿Qué documentos faltan para cerrar abril 2026?',
  '¿Qué vencimientos pueden generar multa?',
  '¿Qué balances están bloqueados y por qué?',
  'Preparar resumen ejecutivo semanal para dirección.',
]

export const AI_ANSWER = 'Para abril 2026, los principales riesgos son: presentación de Abogacía de RAMIRO GARCIA con vencimiento en 7 días, exportación SIGA pendiente de GARSO S.A. y balance bloqueado por documentos faltantes. Se recomienda escalar la presentación societaria hoy y completar documentos antes de enviar liquidaciones pendientes.'
