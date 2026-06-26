import { Settings2 } from 'lucide-react'

export default function ChartCard({ title, subtitle, action, children, className = '', noPad = false }) {
  return (
    <div className={`bg-white border border-slate-200 ${className}`}>
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className={noPad ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

export function Tooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800 tabular-nums">{p.value?.toLocaleString('es-PY')}{unit}</span>
        </div>
      ))}
    </div>
  )
}

export function Delta({ value, suffix = '%', invert = false }) {
  const up = invert ? value < 0 : value > 0
  const color = up ? 'text-emerald-600' : value === 0 ? 'text-slate-400' : 'text-red-600'
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
  return (
    <span className={`text-xs font-semibold tabular-nums ${color}`}>
      {arrow} {Math.abs(value)}{suffix}
    </span>
  )
}
