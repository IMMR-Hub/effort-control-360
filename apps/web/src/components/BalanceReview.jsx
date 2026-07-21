import { balances, clientes } from '../data/mockData'
import Badge from './Badge'
import { Brain, AlertCircle, CheckCircle } from 'lucide-react'

export default function BalanceReview({ filtroCliente }) {
  const rows = balances
    .filter(r => !filtroCliente || r.clienteId === Number(filtroCliente))
    .map(r => ({ ...r, cliente: clientes.find(c => c.id === r.clienteId) }))

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <Brain className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-purple-800">
          <p className="font-semibold">Rol de la IA en los balances</p>
          <p className="mt-0.5">
            La inteligencia artificial <strong>no aprueba ni firma balances</strong>. Su función es preparar alertas
            previas — inconsistencias, documentos faltantes, variaciones inusuales — para que el revisor humano
            tenga toda la información necesaria antes de la revisión final.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {rows.map(r => (
          <div key={r.clienteId} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{r.cliente.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Período: {r.periodo} · Revisor: {r.revisor}</p>
              </div>
              <Badge label={r.estado} size="md" />
            </div>

            {r.inconsistencias.length > 0 ? (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Inconsistencias detectadas por IA</p>
                <ul className="space-y-1.5">
                  {r.inconsistencias.map((inc, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      {inc}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                Sin inconsistencias detectadas. Listo para revisión humana.
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Acción recomendada</p>
              <p className="text-sm text-gray-700">{r.accion}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
