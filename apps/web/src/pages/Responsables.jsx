import ChartCard, { ChartTooltip, SectionHeader } from '../ui/ChartCard'
import { RESPONSABLES } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { User, TrendingUp, Clock, Users } from 'lucide-react'

const COLORS = ['#1E40AF', '#10B981', '#F59E0B', '#7C3AED', '#DC2626']

export default function Responsables() {
  const { filters } = useFilters()

  const chartData = RESPONSABLES.map(r => ({
    nombre: r.nombre.split(' ')[0],
    'Clientes': r.clientesAsignados,
    'Docs revisados': r.docsRevisados,
    'Horas': r.horasTrabajadas,
  }))

  return (
    <div className="space-y-6">
      <SectionHeader title="Responsables y carga de trabajo" description={`${RESPONSABLES.length} personas · ${filters.periodo}`} />

      <ChartCard title="Carga por responsable" subtitle="Documentos revisados y horas del período">
        <div className="chart-h">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Docs revisados" fill="#1E40AF" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Horas" fill="#10B981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {RESPONSABLES.map((r, i) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}>
                {r.nombre.split(' ').map(p => p[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{r.nombre}</p>
                <p className="text-[10px] text-slate-400">{r.rol}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3">
              {[
                { icon: Users, label: 'Clientes', val: r.clientesAsignados, color: 'text-blue-700' },
                { icon: TrendingUp, label: 'Docs rev.', val: r.docsRevisados, color: 'text-emerald-700' },
                { icon: Clock, label: 'Horas', val: r.horasTrabajadas, color: 'text-amber-700' },
              ].map(m => {
                const Icon = m.icon
                return (
                  <div key={m.label} className="bg-slate-50 border border-slate-100 rounded-sm p-2 text-center">
                    <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${m.color}`} />
                    <p className={`text-base font-bold font-data ${m.color}`}>{m.val}</p>
                    <p className="text-[9px] text-slate-500">{m.label}</p>
                  </div>
                )
              })}
            </div>
            <div className="px-3 pb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-slate-400">Eficiencia del período</p>
                <p className="text-[10px] font-bold font-data text-slate-700">{r.eficiencia}%</p>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${r.eficiencia >= 90 ? 'bg-emerald-500' : r.eficiencia >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${r.eficiencia}%` }}
                />
              </div>
              {r.observacion && (
                <p className="text-[10px] text-slate-500 mt-2">{r.observacion}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
