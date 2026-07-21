import { controlSIGA, clientes } from '../../data/mockData'
import ChartCard, { Tooltip } from './ChartCard'
import { CHART_COLORS } from '../../data/dashboardData'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RCTooltip, Legend, LabelList } from 'recharts'

export default function SIGAEfficiency() {
  const data = controlSIGA.map(r => {
    const c = clientes.find(x => x.id === r.clienteId)
    const eficiencia = Math.round((r.docsCargados / (r.docsRecibidos || 1)) * 100)
    return {
      name: c.nombre.split(' ')[0],
      recibidos: r.docsRecibidos,
      cargados: r.docsCargados,
      diferencia: r.diferencias,
      eficiencia,
    }
  })

  const avgEficiencia = Math.round(data.reduce((s, d) => s + d.eficiencia, 0) / data.length)

  return (
    <ChartCard
      title="Eficiencia de carga SIGA"
      subtitle="Documentos recibidos vs. cargados en sistema"
      action={
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cobertura promedio</p>
          <p className={`text-xl font-bold tabular-nums ${avgEficiencia >= 90 ? 'text-emerald-600' : avgEficiencia >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
            {avgEficiencia}%
          </p>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <RCTooltip content={<Tooltip />} />
          <Bar dataKey="recibidos" name="Recibidos" fill={CHART_COLORS.blue} radius={[2, 2, 0, 0]} />
          <Bar dataKey="cargados" name="Cargados en SIGA" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-5 gap-1">
        {data.map(d => (
          <div key={d.name} className="text-center">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${d.eficiencia}%`,
                  background: d.eficiencia === 100 ? CHART_COLORS.green : d.eficiencia >= 80 ? CHART_COLORS.blue : CHART_COLORS.red,
                }}
              />
            </div>
            <p className={`text-[10px] font-bold tabular-nums ${d.eficiencia === 100 ? 'text-emerald-600' : d.eficiencia >= 80 ? 'text-blue-600' : 'text-red-600'}`}>
              {d.eficiencia}%
            </p>
            <p className="text-[9px] text-slate-400">{d.name}</p>
            {d.diferencia > 0 && (
              <p className="text-[9px] text-red-500 font-semibold">−{d.diferencia}</p>
            )}
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
