import Badge from '../ui/Badge'
import { SectionHeader } from '../ui/ChartCard'
import { ALERTAS } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import { AlertTriangle, AlertOctagon, Info, CheckCheck } from 'lucide-react'

const NIVEL_CONFIG = {
  'Crítica': { icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-50 border-red-300', dot: 'bg-red-500', order: 0 },
  'Alta': { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-300', dot: 'bg-orange-500', order: 1 },
  'Media': { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', order: 2 },
  'Baja': { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400', order: 3 },
}

export default function Alertas() {
  const { filters, applyFilters } = useFilters()
  const lista = applyFilters(ALERTAS, { clienteKey: 'cliente' })

  const sorted = [...lista].sort((a, b) => {
    const oa = NIVEL_CONFIG[a.nivel]?.order ?? 9
    const ob = NIVEL_CONFIG[b.nivel]?.order ?? 9
    return oa - ob
  })

  const criticas = sorted.filter(a => a.nivel === 'Crítica').length
  const altas = sorted.filter(a => a.nivel === 'Alta').length
  const medias = sorted.filter(a => a.nivel === 'Media').length

  const handleEscalar = (alerta) =>
    alert(`🚨 Escalando alerta ${alerta.id}\n\nCliente: ${alerta.cliente}\nMensaje: ${alerta.mensaje}\n\nEn producción: notifica a coordinador o supervisor.`)

  return (
    <div className="space-y-6">
      <SectionHeader title="Panel de alertas" description={`${lista.length} alertas activas · ${filters.periodo}`} />

      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Críticas', val: criticas, color: 'bg-red-100 text-red-900 border-red-300' },
          { label: 'Altas', val: altas, color: 'bg-orange-100 text-orange-900 border-orange-300' },
          { label: 'Medias', val: medias, color: 'bg-amber-100 text-amber-900 border-amber-200' },
          { label: 'Total activas', val: sorted.length, color: 'bg-slate-100 text-slate-800 border-slate-200' },
        ].map(s => (
          <div key={s.label} className={`px-4 py-2 rounded-sm border text-center min-w-[90px] ${s.color}`}>
            <p className="text-lg font-bold font-data">{s.val}</p>
            <p className="text-[10px] font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <CheckCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay alertas activas con los filtros seleccionados.</p>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(a => {
          const cfg = NIVEL_CONFIG[a.nivel] || NIVEL_CONFIG['Baja']
          const Icon = cfg.icon
          return (
            <div key={a.id} className={`flex items-start gap-3 p-4 rounded-sm border ${cfg.bg}`}>
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-xs font-bold text-slate-900">{a.cliente}</p>
                      <Badge label={a.nivel} size="xs" />
                      <span className="text-[10px] text-slate-400 font-data">{a.fecha}</span>
                    </div>
                    <p className="text-sm text-slate-800">{a.mensaje}</p>
                    {a.accionRequerida && (
                      <p className="text-xs text-slate-600 mt-1">
                        <strong>Acción:</strong> {a.accionRequerida}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">{a.responsable}</p>
                  </div>
                  {(a.nivel === 'Crítica' || a.nivel === 'Alta') && (
                    <button
                      onClick={() => handleEscalar(a)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-sm transition-colors"
                    >
                      Escalar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
