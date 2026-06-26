import { Menu, Download, Bell, Bot, Eye, Briefcase, Send, AlertTriangle } from 'lucide-react'
import { useFilters } from '../contexts/FilterContext'
import { FILTER_OPTIONS } from '../data/data'

export default function TopBar({ onMenuOpen, onAIOpen, pageTitle }) {
  const { filters, setFilter } = useFilters()

  const handleExport = () => {
    alert('✅ Reporte demo generado\n\nEn producción: descarga PDF con indicadores, alertas y propuestas de acción.')
  }

  const handleAlert = () => {
    alert('✅ Alerta demo enviada al responsable\n\nEn producción: envía por WhatsApp, email o SMS al equipo.')
  }

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-16 z-40 bg-white border-b border-slate-200 h-16 flex items-center px-4 gap-3">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-2 rounded hover:bg-slate-100 transition-colors flex-shrink-0"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5 text-slate-600" />
      </button>

      {/* Page title + Demo badge */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold text-slate-800 hidden sm:block">{pageTitle}</span>
        <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full">Demo visual</span>
      </div>

      {/* Global filters */}
      <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-thin min-w-0">
        {[
          { key: 'periodo', label: 'Período', opts: FILTER_OPTIONS.periodo, noneLabel: null },
          { key: 'cliente', label: 'Cliente', opts: FILTER_OPTIONS.cliente },
          { key: 'estado', label: 'Estado', opts: FILTER_OPTIONS.estado },
          { key: 'riesgo', label: 'Riesgo', opts: FILTER_OPTIONS.riesgo },
        ].map(f => (
          <select
            key={f.key}
            value={filters[f.key]}
            onChange={e => setFilter(f.key, e.target.value)}
            className="flex-shrink-0 text-xs border border-slate-200 rounded-sm bg-white text-slate-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-slate-400 transition-colors"
            aria-label={f.label}
          >
            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden flex-shrink-0">
        <button
          onClick={() => setFilter('modo', 'direccion')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors ${filters.modo === 'direccion' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          title="Vista resumen para dirección"
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dirección</span>
        </button>
        <button
          onClick={() => setFilter('modo', 'operativo')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors ${filters.modo === 'operativo' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          title="Vista detallada para operaciones"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Operativo</span>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
        <button
          onClick={handleAlert}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-sm hover:bg-amber-100 transition-colors hidden sm:flex"
          title="Enviar alerta al equipo"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Alerta</span>
        </button>
        <button
          onClick={onAIOpen}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-sm hover:bg-purple-100 transition-colors hidden md:flex"
          title="Asistente EFFORT"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Asistente</span>
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exportar</span>
        </button>
      </div>
    </header>
  )
}
