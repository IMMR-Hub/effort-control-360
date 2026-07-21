import { getSummaryKPIs, getTimeData, CHART_COLORS } from '../../data/dashboardData'
import { Delta } from './ChartCard'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

function Sparkline({ data, color }) {
  const pts = data.map((v, i) => ({ v }))
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function KPIStrip({ period }) {
  const kpis = getSummaryKPIs(period)
  const data = getTimeData(period)
  const totalSpark = data.map(d => d.total)

  const items = [
    {
      label: 'Documentos totales',
      value: kpis.total.toLocaleString('es-PY'),
      delta: kpis.delta,
      spark: totalSpark,
      color: CHART_COLORS.primary,
      note: 'vs. período anterior',
    },
    {
      label: 'Promedio diario',
      value: kpis.avgDay.toLocaleString('es-PY'),
      delta: null,
      spark: data.map(d => d.total),
      color: CHART_COLORS.blue,
      note: 'docs/día',
    },
    {
      label: 'Pico del período',
      value: kpis.peakDay.toLocaleString('es-PY'),
      delta: null,
      spark: data.map(d => d.total),
      color: CHART_COLORS.cyan,
      note: kpis.peakDate ? kpis.peakDate.slice(5) : '',
    },
    {
      label: 'Horas de procesamiento',
      value: kpis.hours.toLocaleString('es-PY'),
      delta: null,
      spark: data.map(d => Math.round(d.total * 0.25)),
      color: CHART_COLORS.amber,
      note: 'estimadas (15 min/doc)',
    },
    {
      label: 'FTE equivalente',
      value: kpis.fte.toFixed(1),
      delta: null,
      spark: null,
      color: CHART_COLORS.green,
      note: 'personas/día efectivo',
    },
    {
      label: 'Alertas críticas',
      value: '2',
      delta: null,
      spark: null,
      color: CHART_COLORS.red,
      note: 'requieren acción inmediata',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-slate-200 bg-white">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-5 py-4 ${i < items.length - 1 ? 'border-r border-slate-100' : ''}`}
        >
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1 truncate">
            {item.label}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
              {item.value}
            </span>
            {item.delta !== null && <Delta value={item.delta} />}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.note}</p>
          {item.spark && (
            <div className="mt-2">
              <Sparkline data={item.spark} color={item.color} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
