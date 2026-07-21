import { radarLegal, clientes } from '../data/mockData'
import Badge from './Badge'
import { ShieldAlert } from 'lucide-react'

export default function LegalRadar({ filtroCliente }) {
  const rows = radarLegal
    .filter(r => !filtroCliente || r.clienteId === Number(filtroCliente))
    .map(r => ({ ...r, cliente: clientes.find(c => c.id === r.clienteId) }))
    .sort((a, b) => {
      const order = { Crítico: 0, Alerta: 1, 'Sin fecha': 2, Vigente: 3 }
      return (order[a.estado] ?? 9) - (order[b.estado] ?? 9)
    })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">Riesgo prevenido detectado</p>
          <p className="text-amber-700 mt-0.5">
            Presentación societaria pendiente detectada antes del vencimiento.
            Este tipo de omisión generó una multa de <strong>Gs. 6.000.000</strong> en el pasado.
            EFFORT Control 360 permite identificar estos riesgos con anticipación.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Cliente', 'Documento', 'Vencimiento', 'Días restantes', 'Responsable', 'Estado', 'Acción recomendada'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.estado === 'Crítico' ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.cliente.nombre}</td>
                <td className="px-4 py-3 text-gray-700">{r.documento}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.vencimiento ?? '—'}</td>
                <td className="px-4 py-3">
                  {r.diasRestantes !== null ? (
                    <span className={`font-semibold ${r.diasRestantes <= 7 ? 'text-red-700' : r.diasRestantes <= 30 ? 'text-yellow-700' : 'text-green-700'}`}>
                      {r.diasRestantes} días
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.responsable}</td>
                <td className="px-4 py-3"><Badge label={r.estado} /></td>
                <td className="px-4 py-3 text-gray-600 max-w-xs">{r.accion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
