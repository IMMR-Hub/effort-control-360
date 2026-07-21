import { getClientStats, CHART_COLORS } from '../../data/dashboardData'
import ChartCard, { Tooltip } from './ChartCard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RCTooltip, Cell, LabelList,
} from 'recharts'

export default function ClientVolumeChart({ period }) {
  const stats = getClientStats(period)

  return (
    <ChartCard
      title="Volumen por cliente"
      subtitle="Documentos recibidos en el período"
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={stats}
          layout="vertical"
          margin={{ top: 0, right: 48, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="2 2" stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <RCTooltip content={<Tooltip />} />
          <Bar dataKey="total" name="Documentos" radius={[0, 2, 2, 0]}>
            {stats.map(c => <Cell key={c.id} fill={c.color} />)}
            <LabelList
              dataKey="total"
              position="right"
              style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
              formatter={v => v.toLocaleString('es-PY')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-5 gap-1">
        {stats.map(c => {
          const total = stats.reduce((s, x) => s + x.total, 0)
          const pct = Math.round((c.total / total) * 100)
          return (
            <div key={c.id} className="text-center">
              <div className="h-1 rounded-full mb-1" style={{ background: c.color }} />
              <p className="text-[9px] text-slate-500 leading-tight truncate">{c.name.split(' ')[0]}</p>
              <p className="text-xs font-bold text-slate-800 tabular-nums">{pct}%</p>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
