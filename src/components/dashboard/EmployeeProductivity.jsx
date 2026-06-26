import { getEmployeeStats, CHART_COLORS } from '../../data/dashboardData'
import ChartCard, { Delta } from './ChartCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RCTooltip, Cell } from 'recharts'
import { Tooltip } from './ChartCard'

export default function EmployeeProductivity({ period }) {
  const stats = getEmployeeStats(period)
  const maxVal = Math.max(...stats.map(e => e.total))

  return (
    <ChartCard
      title="Productividad por colaborador"
      subtitle="Documentos procesados y horas estimadas"
    >
      <div className="space-y-0">
        {stats.map((emp, i) => (
          <div key={emp.id} className={`py-3 ${i < stats.length - 1 ? 'border-b border-slate-50' : ''}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: emp.color }}
                />
                <span className="text-xs font-medium text-slate-700">{emp.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">{emp.hours}h</span>
                <Delta value={emp.pct} />
                <span className="text-xs font-bold text-slate-900 tabular-nums w-10 text-right">
                  {emp.total.toLocaleString('es-PY')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(emp.total / maxVal) * 100}%`, background: emp.color }}
                />
              </div>
              <span className="text-[10px] text-slate-400 w-8 text-right tabular-nums">
                {emp.share}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Distribución del período
        </p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={stats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
            <CartesianGrid strokeDasharray="2 2" stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={false} axisLine={false} tickLine={false} width={0} />
            <RCTooltip content={<Tooltip />} />
            <Bar dataKey="total" name="Documentos" radius={[0, 2, 2, 0]}>
              {stats.map(emp => <Cell key={emp.id} fill={emp.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
