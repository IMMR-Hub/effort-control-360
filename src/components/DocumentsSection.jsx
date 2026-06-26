import { documentos } from '../data/mockData'
import { clientes } from '../data/mockData'
import Badge from './Badge'
import { ExternalLink, AlertCircle } from 'lucide-react'

const canalIcon = {
  WhatsApp: '💬',
  Email: '📧',
  Drive: '📁',
  'Físico escaneado': '🖨️',
  Sistema: '🖥️',
}

export default function DocumentsSection({ filtroCliente }) {
  const docs = documentos
    .filter(d => !filtroCliente || d.clienteId === Number(filtroCliente))
    .map(d => ({ ...d, cliente: clientes.find(c => c.id === d.clienteId) }))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Cliente', 'Tipo', 'Canal', 'Fecha', 'Confianza IA', 'Estado', 'Archivo'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {docs.map(d => (
            <tr key={d.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{d.cliente.nombre}</td>
              <td className="px-4 py-3 text-gray-700">{d.tipo}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                <span className="mr-1">{canalIcon[d.canal]}</span>{d.canal}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.fecha}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 rounded-full bg-gray-200">
                    <div
                      className={`h-1.5 rounded-full ${d.confianza >= 85 ? 'bg-green-500' : d.confianza >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${d.confianza}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${d.confianza >= 85 ? 'text-green-700' : d.confianza >= 70 ? 'text-yellow-700' : 'text-red-700'}`}>
                    {d.confianza}%
                  </span>
                  {d.confianza < 85 && <AlertCircle className="w-3.5 h-3.5 text-orange-500" />}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge label={d.estado} />
              </td>
              <td className="px-4 py-3">
                <button className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                  <ExternalLink className="w-3 h-3" />
                  Ver archivo
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {docs.length === 0 && (
        <p className="text-center py-10 text-sm text-gray-400">No hay documentos con ese filtro.</p>
      )}
    </div>
  )
}
