import KPICard from '../ui/KPICard'
import ChartCard, { ChartTooltip, SectionHeader } from '../ui/ChartCard'
import Badge from '../ui/Badge'
import { KPIS, CHART_DATA, ALERTAS, VENCIMIENTOS, CLIENTES } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, LineChart, Line, Legend
} from 'recharts'
import { AlertTriangle, ShieldAlert, TrendingUp, FileCheck } from 'lucide-react'

const COLORS = ['#16A34A', '#2563EB', '#F59E0B', '#DC2626', '#64748B']

export default function Overview({ onClienteClick }) {
  const { filters } = useFilters()
  const criticas = ALERTAS.filter(a => a.nivel === 'Crítica')
  const vencProximos = VENCIMIENTOS.filter(v => v.diasRestantes !== null && v.diasRestantes <= 15)

  return (
    <div className="space-y-8">
      {/* Critical alert banner */}
      {criticas.length > 0 && (
        <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-600 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">{criticas.length} alerta{criticas.length > 1 ? 's' : ''} crítica{criticas.length > 1 ? 's' : ''} — acción inmediata requerida</p>
            {criticas.map(a => (
              <p key={a.id} className="text-sm text-red-700">{a.cliente}: {a.mensaje}</p>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <section>
        <SectionHeader title="Indicadores del período" description={`Piloto ${filters.periodo} · 5 clientes`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {KPIS.map(k => <KPICard key={k.id} {...k} />)}
        </div>
      </section>

      {/* Charts row 1 */}
      <section className="grid lg:grid-cols-3 gap-4">
        <ChartCard
          title="Estado general de clientes"
          subtitle="Distribución por condición operativa"
          className="lg:col-span-1"
        >
          <div className="chart-h flex flex-col">
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={CHART_DATA.estadoClientes}
                  cx="50%" cy="50%"
                  innerRadius="38%" outerRadius="65%"
                  dataKey="value" nameKey="name"
                  strokeWidth={2} stroke="white"
                >
                  {CHART_DATA.estadoClientes.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {CHART_DATA.estadoClientes.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-slate-600">{d.name}</span>
                  <span className="text-xs font-bold text-slate-900 font-data">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Documentos recibidos vs. pendientes"
          subtitle="Por cliente — período actual"
          className="lg:col-span-2"
        >
          <div className="chart-h">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHART_DATA.docsPorCliente} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="cliente" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="recibidos" name="Recibidos" fill="#1E40AF" radius={[2, 2, 0, 0]} />
                <Bar dataKey="pendientes" name="Pendientes" fill="#F59E0B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      {/* Charts row 2 */}
      <section className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Horas estimadas ahorradas" subtitle="Proyección semanal del piloto">
          <div className="chart-h-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CHART_DATA.horasAhorradas} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip unit="h" />} />
                <Line type="monotone" dataKey="horas" name="Horas ahorradas" stroke="#D97706" strokeWidth={2.5} dot={{ fill: '#D97706', r: 4, strokeWidth: 2, stroke: 'white' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Vencimientos próximos" subtitle="Alertas 7–30 días">
          <div className="space-y-2">
            {vencProximos.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No hay vencimientos en los próximos 15 días.</p>}
            {vencProximos.map(v => (
              <div key={v.id} className={`flex items-start gap-3 p-3 rounded-sm border ${v.riesgo === 'Crítico' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <ShieldAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${v.riesgo === 'Crítico' ? 'text-red-600' : 'text-amber-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-slate-900">{v.cliente}</p>
                    <Badge label={v.riesgo} size="xs" />
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{v.descripcion}</p>
                  <p className={`text-xs font-bold mt-1 font-data ${v.diasRestantes <= 7 ? 'text-red-700' : 'text-amber-700'}`}>
                    {v.diasRestantes} días restantes — vence {v.fechaVencimiento}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </section>

      {/* Impact summary */}
      <section>
        <SectionHeader title="Impacto estimado" description="Piloto de 14 días · 5 clientes" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {[
            { icon: TrendingUp, label: 'Horas ahorradas', val: '31h', color: 'text-blue-700', bg: 'bg-blue-50' },
            { icon: FileCheck, label: 'Docs clasificados', val: '184', color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { icon: AlertTriangle, label: 'Pendientes', val: '23', color: 'text-amber-700', bg: 'bg-amber-50' },
            { icon: ShieldAlert, label: 'Vencimientos', val: '9', color: 'text-orange-700', bg: 'bg-orange-50' },
            { icon: FileCheck, label: 'Liquidaciones', val: '4', color: 'text-green-700', bg: 'bg-green-50' },
            { icon: ShieldAlert, label: 'Balances', val: '3', color: 'text-purple-700', bg: 'bg-purple-50' },
            { icon: AlertTriangle, label: 'Riesgos críticos', val: '4', color: 'text-red-700', bg: 'bg-red-50' },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.label} className={`${item.bg} border border-slate-100 rounded-sm p-3 text-center`}>
                <Icon className={`w-4 h-4 mx-auto mb-1 ${item.color}`} />
                <p className={`text-lg font-bold font-data ${item.color}`}>{item.val}</p>
                <p className="text-[9px] text-slate-600 leading-tight mt-0.5">{item.label}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Pilot 14 days */}
      <section className="bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50 border border-blue-200/60 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Piloto 14 días · EFFORT Control 360</h3>
            <p className="text-xs text-slate-600">5 clientes reales · Sin reemplazar SIGA · Datos controlados</p>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Validar casos de uso, flujos de trabajo, alertas críticas y exportación de reportes sin comprometer operaciones existentes.
            </p>
          </div>
          <button
            onClick={() => alert('✅ Acción demo: en el prototipo se configuraría el piloto con datos reales.')}
            className="flex-shrink-0 px-4 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors whitespace-nowrap"
          >
            Iniciar piloto
          </button>
        </div>
      </section>

      {/* Executive summary */}
      <section>
        <ChartCard title="Resumen ejecutivo" subtitle="Demo piloto — datos ficticios">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-700 leading-relaxed">
                EFFORT Control 360 permite visualizar en una sola pantalla el estado documental, vencimientos, carga SIGA, liquidaciones, balances y alertas de los clientes. En esta demo de <strong>5 clientes piloto</strong> se detectan 184 documentos recibidos, 23 pendientes, 9 vencimientos próximos y 4 alertas críticas.
              </p>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                La herramienta <strong>no reemplaza SIGA</strong> ni toma decisiones contables; organiza la operación, reduce seguimiento manual y permite detectar riesgos antes de que generen multas o atrasos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: FileCheck, label: 'Documentos controlados', val: '161 / 184', color: 'text-emerald-600' },
                { icon: ShieldAlert, label: 'Riesgos detectados', val: '4 críticos', color: 'text-red-600' },
                { icon: TrendingUp, label: 'Horas ahorradas', val: '31h / mes', color: 'text-blue-600' },
                { icon: AlertTriangle, label: 'Vencimientos bajo control', val: '3 / 4', color: 'text-amber-600' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-sm p-3 text-center">
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
                    <p className={`text-lg font-bold font-data ${item.color}`}>{item.val}</p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{item.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </ChartCard>
      </section>
    </div>
  )
}
