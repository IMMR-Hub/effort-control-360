import { getTimeData, employees, CHART_COLORS } from '../../data/dashboardData'
import ChartCard, { Tooltip } from './ChartCard'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RCTooltip, Legend,
} from 'recharts'
import { useState } from 'react'

const MODES = [
  { id: 'stacked', label: 'Apilado' },
  { id: 'total', label: 'Total' },
]

export default function VolumeTrendChart({ period }) {
  const [mode, setMode] = useState('stacked')
  const data = getTimeData(period)

  const labelKey = period === 'semana' ? 'label'
    : period === 'mes' ? 'label'
    : 'date'

  const formatted = data.map(d => ({
    ...d,
    label: d.label || d.date?.slice(5),
  }))

  return (
    <ChartCard
      title="Flujo de documentos"
      subtitle={`Volumen ${period === 'dia' ? 'diario' : period === 'semana' ? 'semanal' : period === 'mes' ? 'mensual' : 'anual'} por colaborador`}
      action={
        <div className="flex border border-slate-200 rounded overflow-hidden">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === m.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {employees.map(e => (
              <linearGradient key={e.id} id={`g-${e.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={e.color} stopOpacity={mode === 'stacked' ? 0.7 : 0.3} />
                <stop offset="100%" stopColor={e.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(formatted.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <RCTooltip content={<Tooltip />} />
          {mode === 'total' ? (
            <Area
              type="monotone"
              dataKey="total"
              name="Total"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill={`url(#g-mg)`}
              dot={false}
            />
          ) : (
            employees.map((e, i) => (
              <Area
                key={e.id}
                type="monotone"
                dataKey={e.id}
                name={e.name.split(' ')[0]}
                stroke={e.color}
                strokeWidth={1.5}
                fill={`url(#g-${e.id})`}
                stackId="1"
                dot={false}
              />
            ))
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
