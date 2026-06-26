import { useState } from 'react'
import { LayoutGrid, List, ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'
import ClientModal from '../ui/ClientModal'
import { CLIENTES } from '../data/data'
import { useFilters } from '../contexts/FilterContext'
import { SectionHeader } from '../ui/ChartCard'

export default function Clientes() {
  const { filters, applyFilters } = useFilters()
  const [view, setView] = useState('card')
  const [selected, setSelected] = useState(null)

  const lista = applyFilters(CLIENTES, { clienteKey: 'nombre' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader title="Cartera de clientes" description={`${lista.length} clientes · ${filters.periodo}`} />
        <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden flex-shrink-0">
          <button
            onClick={() => setView('card')}
            className={`p-2 transition-colors ${view === 'card' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Vista tarjetas"
            aria-pressed={view === 'card'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 transition-colors ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Vista lista"
            aria-pressed={view === 'list'}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {lista.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No hay clientes que coincidan con los filtros seleccionados.</p>
        </div>
      )}

      {view === 'card' ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="text-left bg-white border border-slate-200 rounded-sm p-4 hover:border-blue-400 hover:shadow-md transition-all group"
              aria-label={`Ver detalle de ${c.nombre}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate leading-tight">{c.nombre}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{c.canal} · {c.responsable}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge label={c.estadoGeneral} size="xs" />
                  <Badge label={c.riesgo} size="xs" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-slate-50 rounded-sm p-2">
                  <p className="text-base font-bold text-slate-900 font-data">{c.docsRecibidos}</p>
                  <p className="text-[9px] text-slate-500">Docs recib.</p>
                </div>
                <div className={`rounded-sm p-2 ${c.docsPendientes > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <p className={`text-base font-bold font-data ${c.docsPendientes > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{c.docsPendientes}</p>
                  <p className="text-[9px] text-slate-500">Pendientes</p>
                </div>
                <div className="bg-slate-50 rounded-sm p-2">
                  <p className="text-base font-bold text-slate-900 font-data">{c.diasActivo}</p>
                  <p className="text-[9px] text-slate-500">Días activo</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-500 truncate">{c.proximaAccion}</p>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Responsable</th>
                <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Docs</th>
                <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Pendientes</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Riesgo</th>
                <th className="px-3 py-3" aria-label="Acción" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lista.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 text-xs">{c.nombre}</p>
                    <p className="text-[10px] text-slate-400">{c.canal}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-600">{c.responsable}</td>
                  <td className="px-3 py-3 text-center font-data text-xs font-bold text-slate-800">{c.docsRecibidos}</td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className={`font-data text-xs font-bold ${c.docsPendientes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{c.docsPendientes}</span>
                  </td>
                  <td className="px-3 py-3"><Badge label={c.estadoGeneral} size="xs" /></td>
                  <td className="px-3 py-3 hidden lg:table-cell"><Badge label={c.riesgo} size="xs" /></td>
                  <td className="px-3 py-3 text-right"><ChevronRight className="w-3.5 h-3.5 text-slate-300 inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientModal cliente={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
