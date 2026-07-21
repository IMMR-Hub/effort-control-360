import { getSummaryKPIs, CHART_COLORS } from '../../data/dashboardData'
import ChartCard, { Tooltip } from './ChartCard'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RCTooltip, Legend } from 'recharts'

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) {
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  if (value < 40) return null
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {value.toLocaleString('es-PY')}
    </text>
  )
}

export default function ChannelMixChart({ period }) {
  const { channels } = getSummaryKPIs(period)
  const total = channels.reduce((s, c) => s + c.value, 0)

  return (
    <ChartCard title="Canales de recepción" subtitle="Mix de origen documental">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={channels}
            cx="50%"
            cy="50%"
            outerRadius={72}
            innerRadius={36}
            dataKey="value"
            nameKey="name"
            labelLine={false}
            label={CustomLabel}
            strokeWidth={2}
            stroke="white"
          >
            {channels.map((c, i) => <Cell key={i} fill={c.color} />)}
          </Pie>
          <RCTooltip content={<Tooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-1.5 mt-2">
        {channels.map(c => {
          const pct = Math.round((c.value / total) * 100)
          return (
            <div key={c.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-xs text-slate-600 flex-1">{c.name}</span>
              <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 tabular-nums w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
