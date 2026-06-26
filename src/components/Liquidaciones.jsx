import { liquidaciones, clientes } from '../data/mockData'
import Badge from './Badge'
import { FileText, Send } from 'lucide-react'

const canalIcon = { Email: '📧', WhatsApp: '💬', Drive: '📁' }

export default function Liquidaciones({ filtroCliente }) {
  const rows = liquidaciones
    .filter(r => !filtroCliente || r.clienteId === Number(filtroCliente))
    .map(r => ({ ...r, cliente: clientes.find(c => c.id === r.clienteId) }))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Cliente', 'Periodo', 'Archivo', 'Destinatario', 'Canal', 'Fecha de envío', 'Estado', 'Comprobante', 'Acción'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.cliente.nombre}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.periodo}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-blue-600">
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate max-w-[140px]">{r.archivo}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{r.destinatario}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                <span className="mr-1">{canalIcon[r.canal]}</span>{r.canal}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.fechaEnvio ?? '—'}</td>
              <td className="px-4 py-3"><Badge label={r.estado} /></td>
              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{r.comprobante}</td>
              <td className="px-4 py-3">
                {r.estado === 'Pendiente' ? (
                  <button className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                    <Send className="w-3 h-3" />
                    Enviar alerta
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
