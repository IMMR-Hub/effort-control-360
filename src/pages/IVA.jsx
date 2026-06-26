import ChartCard, { ChartTooltip, SectionHeader } from '../ui/ChartCard'
import { IVA } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell
} from 'recharts'

const fmt = (n) => n !== null && n !== undefined
  ? new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n)
  : '—'

function IVAMetric({ label, value, color }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-sm p-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-bold font-data ${color || 'text-slate-800'}`}>{fmt(value)}</p>
    </div>
  )
}

export default function IVAPage() {
  const { filters } = useFilters()

  const chartData = IVA.map(c => ({
    cliente: c.cliente.split(' ')[0],
    'Débito 10%': c.ivaDebito10,
    'Crédito 10%': c.ivaCredito10,
    'Saldo a pagar': c.saldoPagar,
  }))

  return (
    <div className="space-y-6">
      <SectionHeader title="IVA / Compras / Ventas" description={`${filters.periodo} · ${IVA.length} clientes`} />

      <ChartCard title="Débito vs. Crédito IVA por cliente" subtitle="Guaraníes — tasa 10%">
        <div className="chart-h">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="cliente" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip content={<ChartTooltip />} formatter={(val) => fmt(val)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Débito 10%" fill="#1E40AF" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Crédito 10%" fill="#10B981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Saldo a pagar" fill="#F59E0B" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="space-y-4">
        {IVA.map(c => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{c.cliente}</p>
                <p className="text-[10px] text-slate-400">{c.periodo} · {c.responsable}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo final</p>
                <p className={`text-sm font-bold font-data ${c.saldoPagar > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(c.saldoPagar)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3">
              <IVAMetric label="IVA Débito 10%" value={c.ivaDebito10} color="text-blue-800" />
              <IVAMetric label="IVA Crédito 10%" value={c.ivaCredito10} color="text-emerald-700" />
              {c.ivaDebito5 !== null && <IVAMetric label="Débito 5%" value={c.ivaDebito5} color="text-blue-600" />}
              {c.ivaCredito5 !== null && <IVAMetric label="Crédito 5%" value={c.ivaCredito5} color="text-emerald-600" />}
              {c.retenciones !== null && <IVAMetric label="Retenciones" value={c.retenciones} color="text-amber-700" />}
              <IVAMetric label="Saldo a pagar" value={c.saldoPagar} color={c.saldoPagar > 0 ? 'text-red-700 font-bold' : 'text-emerald-700'} />
            </div>
            {c.observacion && (
              <div className="px-4 pb-3">
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-3 py-1.5">{c.observacion}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
