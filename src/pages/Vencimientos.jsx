import Badge from '../ui/Badge'
import { SectionHeader } from '../ui/ChartCard'
import { VENCIMIENTOS } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import { CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function Vencimientos() {
  const { filters, applyFilters } = useFilters()
  const lista = applyFilters(VENCIMIENTOS, { clienteKey: 'cliente', riesgoKey: 'riesgo' })

  const sorted = [...lista].sort((a, b) => {
    if (a.diasRestantes === null) return 1
    if (b.diasRestantes === null) return -1
    return a.diasRestantes - b.diasRestantes
  })

  const vencidos = sorted.filter(v => v.estado === 'Vencido')
  const proximos = sorted.filter(v => v.diasRestantes !== null && v.diasRestantes <= 15 && v.estado !== 'Vencido')
  const ok = sorted.filter(v => v.estado === 'Al día')

  const Section = ({ title, items, accent }) => items.length === 0 ? null : (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${accent}`}>{title} ({items.length})</h3>
      <div className="space-y-2">
        {items.map(v => {
          const urgent = v.diasRestantes !== null && v.diasRestantes <= 7
          return (
            <div key={v.id} className={`flex items-start gap-3 p-3.5 rounded-sm border transition-colors
              ${v.estado === 'Vencido' ? 'bg-red-50 border-red-200' :
                urgent ? 'bg-orange-50 border-orange-200' :
                v.riesgo === 'Alto' ? 'bg-amber-50 border-amber-200' :
                'bg-white border-slate-200'}`}>
              <div className={`flex-shrink-0 mt-0.5 ${v.estado === 'Vencido' ? 'text-red-600' : urgent ? 'text-orange-600' : 'text-amber-500'}`}>
                {v.estado === 'Al día' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-slate-900">{v.cliente}</p>
                  <Badge label={v.riesgo} size="xs" />
                  <Badge label={v.estado} size="xs" />
                </div>
                <p className="text-xs text-slate-700 mt-0.5">{v.descripcion}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                  <span className="text-[10px] text-slate-400">Vence: <strong className="font-data">{v.fechaVencimiento}</strong></span>
                  {v.diasRestantes !== null && (
                    <span className={`text-[10px] font-bold font-data ${v.diasRestantes <= 0 ? 'text-red-700' : v.diasRestantes <= 7 ? 'text-orange-700' : 'text-amber-700'}`}>
                      {v.diasRestantes <= 0 ? `${Math.abs(v.diasRestantes)} días vencido` : `${v.diasRestantes} días restantes`}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">{v.responsable}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <SectionHeader title="Vencimientos y compromisos" description={`${sorted.length} registros · ${filters.periodo}`} />

      {/* Timeline summary */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[
          { label: 'Vencidos', count: vencidos.length, color: 'bg-red-100 text-red-800 border-red-200' },
          { label: 'Próximos 15 días', count: proximos.length, color: 'bg-amber-100 text-amber-800 border-amber-200' },
          { label: 'Al día', count: ok.length, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={`flex-shrink-0 px-4 py-2.5 rounded-sm border text-center min-w-[110px] ${s.color}`}>
            <p className="text-lg font-bold font-data">{s.count}</p>
            <p className="text-[10px] font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      <Section title="Vencidos" items={vencidos} accent="text-red-700" />
      <Section title="Próximos 15 días" items={proximos} accent="text-amber-700" />
      <Section title="Al día" items={ok} accent="text-emerald-700" />
    </div>
  )
}
