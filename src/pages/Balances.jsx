import Badge from '../ui/Badge'
import { SectionHeader } from '../ui/ChartCard'
import { BALANCES } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import { BarChart3, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

const fmt = (n) => n != null
  ? new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n)
  : '—'

const STATUS_ICON = {
  'Aprobado': CheckCircle2,
  'En revisión': AlertCircle,
  'Bloqueado': XCircle,
  'Pendiente': AlertCircle,
}
const STATUS_COLOR = {
  'Aprobado': 'text-emerald-600',
  'En revisión': 'text-amber-600',
  'Bloqueado': 'text-red-600',
  'Pendiente': 'text-slate-500',
}

export default function Balances() {
  const { filters, applyFilters } = useFilters()
  const lista = applyFilters(BALANCES, { clienteKey: 'cliente' })

  return (
    <div className="space-y-6">
      <SectionHeader title="Balances contables" description={`${lista.length} clientes · ${filters.periodo}`} />

      <div className="grid sm:grid-cols-2 gap-4">
        {lista.map(b => {
          const Icon = STATUS_ICON[b.estado] || AlertCircle
          const color = STATUS_COLOR[b.estado] || 'text-slate-600'
          return (
            <div key={b.id} className="bg-white border border-slate-200 rounded-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-900">{b.cliente}</p>
                  <p className="text-[10px] text-slate-400">{b.ejercicio} · {b.responsable}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <Badge label={b.estado} size="xs" />
                </div>
              </div>

              {/* Financials */}
              <div className="grid grid-cols-2 gap-2 p-3">
                <div className="bg-slate-50 rounded-sm p-2.5">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Activo total</p>
                  <p className="text-sm font-bold font-data text-slate-900">{fmt(b.activoTotal)}</p>
                </div>
                <div className="bg-slate-50 rounded-sm p-2.5">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Pasivo total</p>
                  <p className="text-sm font-bold font-data text-slate-900">{fmt(b.pasivoTotal)}</p>
                </div>
                <div className="bg-slate-50 rounded-sm p-2.5">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Patrimonio neto</p>
                  <p className={`text-sm font-bold font-data ${b.patrimonioNeto < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(b.patrimonioNeto)}</p>
                </div>
                <div className="bg-slate-50 rounded-sm p-2.5">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Resultado</p>
                  <p className={`text-sm font-bold font-data ${b.resultado < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(b.resultado)}</p>
                </div>
              </div>

              {/* Inconsistencies */}
              {b.inconsistencias && b.inconsistencias.length > 0 && (
                <div className="px-3 pb-3">
                  <p className="text-[9px] font-bold text-red-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Inconsistencias detectadas
                  </p>
                  {b.inconsistencias.map((inc, i) => (
                    <p key={i} className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mb-1">{inc}</p>
                  ))}
                </div>
              )}

              {/* Blocking reason */}
              {b.motivoBloqueo && (
                <div className="px-3 pb-3">
                  <p className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
                    <strong>Motivo bloqueo:</strong> {b.motivoBloqueo}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
