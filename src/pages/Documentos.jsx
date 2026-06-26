import Badge from '../ui/Badge'
import { SectionHeader } from '../ui/ChartCard'
import { DOCUMENTOS } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import { FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

const TIPO_ICON = { Factura: FileText, 'Nota de crédito': FileText, Recibo: FileText, Comprobante: FileText }

export default function Documentos() {
  const { filters, applyFilters } = useFilters()
  const docs = applyFilters(DOCUMENTOS, { clienteKey: 'cliente', estadoKey: 'estado' })

  const total = docs.length
  const revisados = docs.filter(d => d.estado === 'Revisado').length
  const pendientes = docs.filter(d => d.estado === 'Pendiente').length
  const observados = docs.filter(d => d.observacion).length

  return (
    <div className="space-y-6">
      <SectionHeader title="Documentos del período" description={`${total} documentos · ${filters.periodo}`} />

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total docs', val: total, color: 'text-slate-900', bg: 'bg-slate-50' },
          { label: 'Revisados', val: revisados, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Pendientes', val: pendientes, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Con observación', val: observados, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-slate-100 rounded-sm p-3 text-center`}>
            <p className={`text-2xl font-bold font-data ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Document list */}
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        {docs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay documentos con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {docs.map(doc => {
              const pct = Math.round((doc.confianza || 0) * 100)
              const isOk = doc.estado === 'Revisado'
              const hasProblem = doc.observacion
              return (
                <div key={doc.id} className="px-4 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex-shrink-0 ${isOk ? 'text-emerald-500' : hasProblem ? 'text-red-500' : 'text-amber-400'}`}>
                      {isOk ? <CheckCircle2 className="w-4 h-4" /> : hasProblem ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{doc.tipo}</span>
                        <span className="text-[10px] text-slate-400 font-data">{doc.numero}</span>
                        <Badge label={doc.estado} size="xs" />
                        {doc.requiereRevision && <Badge label="Revisar" size="xs" />}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        <span className="text-xs text-slate-600">{doc.cliente}</span>
                        <span className="text-xs text-slate-400">{doc.fecha}</span>
                        {doc.monto && <span className="text-xs font-data font-bold text-slate-700">{doc.monto}</span>}
                      </div>
                      {doc.observacion && (
                        <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          {doc.observacion}
                        </p>
                      )}
                      {/* Confidence bar */}
                      {doc.confianza !== undefined && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden" style={{ maxWidth: '120px' }}>
                            <div
                              className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 font-data">{pct}% confianza</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-slate-400">{doc.responsable}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
