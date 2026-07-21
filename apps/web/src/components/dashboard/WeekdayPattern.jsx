import { getWeekdayPattern, CHART_COLORS } from '../../data/dashboardData'
import ChartCard, { Tooltip } from './ChartCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RCTooltip, Cell } from 'recharts'

export default function WeekdayPattern() {
  const data = getWeekdayPattern()
  const max = Math.max(...data.map(d => d.avg))

  return (
    <ChartCard
      title="Patrón de actividad semanal"
      subtitle="Promedio de documentos por día de la semana — base 90 días"
    >
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <RCTooltip content={<Tooltip unit=" docs" />} />
          <Bar dataKey="avg" name="Promedio" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.isWeekday
                  ? d.avg === max ? CHART_COLORS.amber : CHART_COLORS.primary
                  : '#e2e8f0'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: CHART_COLORS.primary }} />
          Día hábil normal
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: CHART_COLORS.amber }} />
          Pico de carga
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-200" />
          Fin de semana
        </div>
      </div>
    </ChartCard>
  )
}
