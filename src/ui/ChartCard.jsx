export default function ChartCard({ title, subtitle, action, children, className = '', noPad = false, fullHeight = false }) {
  return (
    <div className={`card rounded-lg flex flex-col ${fullHeight ? 'h-full' : ''} ${className}`}>
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100/80 flex-shrink-0">
        <div className="min-w-0">
          <h3 className="section-label">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 ml-3">{action}</div>}
      </div>
      <div className={`flex-1 min-h-0 ${noPad ? '' : 'p-4'}`}>{children}</div>
    </div>
  )
}

export function ChartTooltip({ active, payload, label, formatter, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 shadow-xl px-3.5 py-2.5 text-xs rounded-lg">
      {label && <p className="font-semibold text-slate-700 mb-1.5 font-data">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-900 font-data tabular-nums">
            {formatter ? formatter(p.value) : p.value?.toLocaleString('es-PY')}{unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SectionHeader({ title, description }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
  )
}
