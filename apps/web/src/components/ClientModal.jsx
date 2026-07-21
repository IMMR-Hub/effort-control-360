import { clientes, detalleCliente } from '../data/mockData'
import { X, FileText, AlertTriangle, Database, Send, BarChart2, User, ArrowRight } from 'lucide-react'
import Badge from './Badge'

export default function ClientModal({ clienteId, onClose }) {
  const cliente = clientes.find(c => c.id === clienteId)
  const detalle = detalleCliente[clienteId]
  if (!cliente || !detalle) return null

  const items = [
    { icon: FileText, label: 'Docs recibidos', value: detalle.docsRecibidos, extra: detalle.docsPendientes > 0 ? `${detalle.docsPendientes} pendientes` : null },
    { icon: AlertTriangle, label: 'Vencimientos próximos', value: detalle.vencimientosProximos, extra: null },
    { icon: Database, label: 'Estado SIGA', value: detalle.estadoSIGA, extra: null },
    { icon: Send, label: 'Liquidación', value: detalle.liquidacion, extra: null },
    { icon: BarChart2, label: 'Balance', value: detalle.balance, extra: null },
    { icon: User, label: 'Responsable', value: detalle.responsable, extra: null },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="font-bold text-gray-900 text-base">{cliente.nombre}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{cliente.sector} · Período: Mayo 2025</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="p-5 grid sm:grid-cols-2 gap-3">
          {items.map(item => {
            const Icon = item.icon
            return (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.label}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{item.value}</p>
                {item.extra && <p className="text-xs text-orange-600 mt-0.5">{item.extra}</p>}
              </div>
            )
          })}
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
            <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-0.5">Próxima acción</p>
              <p className="text-sm text-blue-700">{detalle.proximaAccion}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
