import { controlSIGA, clientes } from '../data/mockData'
import Badge from './Badge'
import { Info } from 'lucide-react'

export default function SIGAControl({ filtroCliente }) {
  const rows = controlSIGA
    .filter(r => !filtroCliente || r.clienteId === Number(filtroCliente))
    .map(r => ({ ...r, cliente: clientes.find(c => c.id === r.clienteId) }))

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold">¿Cómo se integra SIGA?</p>
          <p className="mt-0.5">
            EFFORT Control 360 <strong>no reemplaza SIGA</strong>. Se utilizan las exportaciones en Excel/PDF que genera SIGA
            para verificar qué documentos ya fueron cargados y detectar diferencias con los documentos recibidos por el cliente.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Cliente', 'Exportación SIGA', 'Docs recibidos', 'Docs cargados', 'Diferencias', 'Estado'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.clienteId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.cliente.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{r.exportacionSIGA}</td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">{r.docsRecibidos}</td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">{r.docsCargados}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-semibold ${r.diferencias === 0 ? 'text-green-700' : r.diferencias <= 5 ? 'text-yellow-700' : 'text-red-700'}`}>
                    {r.diferencias === 0 ? '✓ Sin diff.' : `⚠ ${r.diferencias} docs`}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge label={r.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
