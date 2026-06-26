import Badge from './Badge'
import { clientes, estadoClientes } from '../data/mockData'
import { ChevronRight } from 'lucide-react'

export default function ClientStatusTable({ filtroCliente, filtroEstado, onSelectCliente }) {
  const rows = estadoClientes
    .filter(r => !filtroCliente || r.clienteId === Number(filtroCliente))
    .filter(r => !filtroEstado || r.estado === filtroEstado)
    .map(r => ({ ...r, cliente: clientes.find(c => c.id === r.clienteId) }))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Cliente', 'Responsable', 'Periodo', 'Documentos', 'Carga SIGA', 'Liquidación', 'Balance', 'Riesgo', 'Estado'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr
              key={r.clienteId}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onSelectCliente(r.clienteId)}
            >
              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.cliente.nombre}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.cliente.responsable}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.periodo}</td>
              <td className="px-4 py-3"><Badge label={r.documentos} /></td>
              <td className="px-4 py-3"><Badge label={r.cargaSIGA} /></td>
              <td className="px-4 py-3"><Badge label={r.liquidacion} /></td>
              <td className="px-4 py-3"><Badge label={r.balance} /></td>
              <td className="px-4 py-3"><Badge label={r.riesgo} /></td>
              <td className="px-4 py-3"><Badge label={r.estado} /></td>
              <td className="px-4 py-3 text-gray-400">
                <ChevronRight className="w-4 h-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-center py-10 text-sm text-gray-400">No hay clientes con ese filtro.</p>
      )}
    </div>
  )
}
