import { estadoClientes, clientes } from '../../data/mockData'
import ChartCard from './ChartCard'
import { CHART_COLORS } from '../../data/dashboardData'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RCTooltip } from 'recharts'
import { Tooltip } from './ChartCard'

const STATUS_COLOR = {
  Completo: CHART_COLORS.green,
  Parcial: CHART_COLORS.blue,
  Crítico: CHART_COLORS.red,
  Observado: CHART_COLORS.amber,
  Pendiente: CHART_COLORS.slate,
}

export default function PortfolioStatus() {
  const distribution = {}
  estadoClientes.forEach(e => {
    distribution[e.estado] = (distribution[e.estado] || 0) + 1
  })

  const data = Object.entries(distribution).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLOR[name] || '#94a3b8',
  }))

  const riskScore = estadoClientes.reduce((s, e) => {
    return s + ({ Completo: 0, Parcial: 1, Observado: 2, Pendiente: 2, Crítico: 4 }[e.estado] || 0)
  }, 0)
  const maxScore = estadoClientes.length * 4
  const riskPct = Math.round((riskScore / maxScore) * 100)

  return (
    <ChartCard title="Estado de cartera" subtitle="Distribución por condición operativa">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={54}
                innerRadius={28}
                dataKey="value"
                nameKey="name"
                strokeWidth={2}
                stroke="white"
              >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <RCTooltip content={<Tooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2">
          {data.map(d => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-xs text-slate-600 flex-1">{d.name}</span>
              <span className="text-xs font-bold text-slate-800 tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Índice de riesgo de cartera</p>
          <span className={`text-xs font-bold tabular-nums ${riskPct > 50 ? 'text-red-600' : riskPct > 25 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {riskPct}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${riskPct}%`,
              background: riskPct > 50 ? CHART_COLORS.red : riskPct > 25 ? CHART_COLORS.amber : CHART_COLORS.green,
            }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          {riskPct > 50 ? 'Cartera en zona de riesgo elevado' : riskPct > 25 ? 'Cartera con alertas moderadas' : 'Cartera en buen estado'}
        </p>
      </div>
    </ChartCard>
  )
}
