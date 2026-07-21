import { alertas, clientes } from '../data/mockData'
import { AlertTriangle, AlertCircle, Info, Zap } from 'lucide-react'

const nivelConfig = {
  Crítica: { icon: Zap, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700', iconColor: 'text-red-600' },
  Alta: { icon: AlertTriangle, bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700', iconColor: 'text-orange-600' },
  Media: { icon: AlertCircle, bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700', iconColor: 'text-yellow-600' },
  Informativa: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', iconColor: 'text-blue-600' },
}

const nivelOrder = { Crítica: 0, Alta: 1, Media: 2, Informativa: 3 }

export default function AlertsPanel({ filtroCliente }) {
  const rows = alertas
    .filter(a => !filtroCliente || a.clienteId === Number(filtroCliente))
    .map(a => ({ ...a, cliente: clientes.find(c => c.id === a.clienteId) }))
    .sort((a, b) => (nivelOrder[a.nivel] ?? 9) - (nivelOrder[b.nivel] ?? 9))

  return (
    <div className="space-y-2.5">
      {rows.map(a => {
        const cfg = nivelConfig[a.nivel]
        const Icon = cfg.icon
        return (
          <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{a.nivel}</span>
                <span className="text-xs text-gray-500">{a.cliente.nombre}</span>
                <span className="text-xs text-gray-400">{a.fecha}</span>
              </div>
              <p className={`text-sm ${cfg.text}`}>{a.mensaje}</p>
            </div>
          </div>
        )
      })}
      {rows.length === 0 && (
        <p className="text-center py-10 text-sm text-gray-400">No hay alertas con ese filtro.</p>
      )}
    </div>
  )
}
