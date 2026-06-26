import { getForecast, CHART_COLORS } from '../../data/dashboardData'
import ChartCard, { Tooltip } from './ChartCard'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RCTooltip, ReferenceLine,
  ReferenceArea,
} from 'recharts'

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => p.value !== undefined && (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || '#94a3b8' }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800 tabular-nums">{p.value?.toLocaleString('es-PY')}</span>
        </div>
      ))}
    </div>
  )
}

export default function WorkloadForecast() {
  const { history, projected } = getForecast()

  // Combine history + projected into single dataset with gap marker
  const separator = { label: '▸ hoy', actual: null, forecast: null, forecastLow: null, forecastHigh: null, isBreak: true }
  const combined = [
    ...history.map(d => ({ label: d.date.slice(5), actual: d.actual })),
    separator,
    ...projected.map(d => ({ label: d.label, forecast: d.forecast, forecastLow: d.forecastLow, forecastHigh: d.forecastHigh })),
  ]

  const peakForecast = Math.max(...projected.map(p => p.forecastHigh))
  const peakDate = projected.find(p => p.forecastHigh === peakForecast)?.label || ''
  const peakFTE = Math.round((peakForecast * 0.25 / 7) * 10) / 10

  return (
    <ChartCard
      title="Forecast de carga operativa"
      subtitle="Proyección a 14 días · intervalo de confianza 88%"
      action={
        <div className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed border-slate-400" />
          <span className="text-[10px] text-slate-400">Proyectado</span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={combined} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
              <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            interval={5}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <RCTooltip content={<ForecastTooltip />} />

          {/* Confidence band */}
          <Area
            type="monotone"
            dataKey="forecastHigh"
            stroke="none"
            fill={`url(#gBand)`}
            name="Límite alto"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="forecastLow"
            stroke="none"
            fill="white"
            name="Límite bajo"
            connectNulls
          />

          {/* Historical */}
          <Area
            type="monotone"
            dataKey="actual"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fill={`url(#gActual)`}
            dot={false}
            name="Real"
            connectNulls={false}
          />

          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey="forecast"
            stroke={CHART_COLORS.amber}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            name="Forecast"
            connectNulls
          />

          <ReferenceLine
            x="▸ hoy"
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="2 2"
            label={{ value: 'Hoy', position: 'top', fontSize: 9, fill: '#94a3b8' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pico previsto</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{peakForecast.toLocaleString('es-PY')}</p>
          <p className="text-[10px] text-slate-400">docs · {peakDate}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Horas requeridas</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{Math.round(peakForecast * 0.25)}h</p>
          <p className="text-[10px] text-slate-400">en el día pico</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">FTE recomendado</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{peakFTE}</p>
          <p className="text-[10px] text-slate-400">personas/día (7h)</p>
        </div>
      </div>
    </ChartCard>
  )
}
