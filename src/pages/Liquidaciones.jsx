import Badge from '../ui/Badge'
import { SectionHeader } from '../ui/ChartCard'
import { LIQUIDACIONES } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import { Send, Bell, FileText } from 'lucide-react'

const fmt = (n) => n != null
  ? new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n)
  : '—'

export default function Liquidaciones() {
  const { filters, applyFilters } = useFilters()
  const lista = applyFilters(LIQUIDACIONES, { clienteKey: 'cliente', estadoKey: 'estado' })

  const handleSendAlert = (liq) =>
    alert(`📤 Enviando alerta al cliente ${liq.cliente}\n\nConcepto: ${liq.concepto}\nImporte: ${fmt(liq.importe)}\n\nEn producción: envía WhatsApp/email automáticamente.`)

  return (
    <div className="space-y-6">
      <SectionHeader title="Liquidaciones" description={`${lista.length} registros · ${filters.periodo}`} />

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        {lista.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Send className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay liquidaciones con los filtros seleccionados.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Cliente', 'Concepto', 'Período', 'Importe', 'Vencimiento', 'Estado', 'Responsable', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lista.map(liq => (
                    <tr key={liq.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-900">{liq.cliente}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{liq.concepto}</td>
                      <td className="px-4 py-3 text-xs font-data text-slate-500">{liq.periodo}</td>
                      <td className="px-4 py-3 text-xs font-bold font-data text-slate-800">{fmt(liq.importe)}</td>
                      <td className="px-4 py-3 text-xs font-data text-slate-500">{liq.vencimiento}</td>
                      <td className="px-4 py-3"><Badge label={liq.estado} size="xs" /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{liq.responsable}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {liq.comprobante && (
                            <button
                              title="Ver comprobante"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              onClick={() => alert(`Comprobante: ${liq.comprobante}`)}
                              aria-label="Ver comprobante"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            title="Enviar alerta al cliente"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            onClick={() => handleSendAlert(liq)}
                            aria-label="Enviar alerta"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {lista.map(liq => (
                <div key={liq.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{liq.cliente}</p>
                      <p className="text-xs text-slate-500">{liq.concepto}</p>
                    </div>
                    <Badge label={liq.estado} size="xs" />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="font-bold font-data text-slate-800">{fmt(liq.importe)}</span>
                    <span className="text-slate-400">Vence: {liq.vencimiento}</span>
                  </div>
                  <div className="flex gap-2">
                    {liq.comprobante && (
                      <button onClick={() => alert(`Comprobante: ${liq.comprobante}`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 rounded-sm hover:bg-blue-100 transition-colors">
                        <FileText className="w-3 h-3" /> Comprobante
                      </button>
                    )}
                    <button onClick={() => handleSendAlert(liq)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 rounded-sm hover:bg-amber-100 transition-colors">
                      <Bell className="w-3 h-3" /> Alertar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
