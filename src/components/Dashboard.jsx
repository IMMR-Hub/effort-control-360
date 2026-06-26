import { useState, useCallback } from 'react'
import KPIStrip from './dashboard/KPIStrip'
import VolumeTrendChart from './dashboard/VolumeTrendChart'
import EmployeeProductivity from './dashboard/EmployeeProductivity'
import ClientVolumeChart from './dashboard/ClientVolumeChart'
import WorkloadForecast from './dashboard/WorkloadForecast'
import ChannelMixChart from './dashboard/ChannelMixChart'
import WeekdayPattern from './dashboard/WeekdayPattern'
import PortfolioStatus from './dashboard/PortfolioStatus'
import SIGAEfficiency from './dashboard/SIGAEfficiency'
import { SlidersHorizontal, ChevronDown, RotateCcw } from 'lucide-react'
import { clientes, alertas } from '../data/mockData'
import Badge from './Badge'

const PERIODS = [
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'año', label: 'Año' },
]

const ALL_WIDGETS = [
  { id: 'volumeTrend', label: 'Flujo de documentos', default: true },
  { id: 'forecast', label: 'Forecast de carga', default: true },
  { id: 'employees', label: 'Productividad colaboradores', default: true },
  { id: 'clients', label: 'Volumen por cliente', default: true },
  { id: 'portfolio', label: 'Estado de cartera', default: true },
  { id: 'channels', label: 'Canales de recepción', default: true },
  { id: 'weekday', label: 'Patrón semanal', default: true },
  { id: 'siga', label: 'Eficiencia SIGA', default: true },
]

function useWidgets() {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('effort-widgets')) } catch { return null }
  })()
  const initial = stored || ALL_WIDGETS.reduce((acc, w) => ({ ...acc, [w.id]: w.default }), {})
  const [widgets, setWidgets] = useState(initial)

  const toggle = useCallback((id) => {
    setWidgets(prev => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('effort-widgets', JSON.stringify(next))
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const def = ALL_WIDGETS.reduce((acc, w) => ({ ...acc, [w.id]: w.default }), {})
    setWidgets(def)
    localStorage.setItem('effort-widgets', JSON.stringify(def))
  }, [])

  return { widgets, toggle, reset }
}

function WidgetSelector({ widgets, onToggle, onReset, open, setOpen }) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Personalizar
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 shadow-lg w-64 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Widgets visibles</p>
            <button onClick={onReset} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700">
              <RotateCcw className="w-3 h-3" /> Restaurar
            </button>
          </div>
          <div className="space-y-1">
            {ALL_WIDGETS.map(w => (
              <label key={w.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                <div
                  onClick={() => onToggle(w.id)}
                  className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${
                    widgets[w.id] ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${
                    widgets[w.id] ? 'left-4' : 'left-0.5'
                  }`} />
                </div>
                <span className={`text-xs ${widgets[w.id] ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{w.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CriticalBanner() {
  const critical = alertas.filter(a => a.nivel === 'Crítica')
  if (!critical.length) return null
  return (
    <div className="bg-red-50 border-l-4 border-red-600 px-5 py-3 flex items-start gap-3">
      <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex-shrink-0 mt-0.5">
        {critical.length} alerta{critical.length > 1 ? 's' : ''} crítica{critical.length > 1 ? 's' : ''}
      </span>
      <div className="flex-1 min-w-0 space-y-0.5">
        {critical.map(a => (
          <p key={a.id} className="text-xs text-red-700 truncate">{a.mensaje}</p>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('semana')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const { widgets, toggle, reset } = useWidgets()

  const vis = widgets

  return (
    <div className="bg-slate-50 min-h-screen" onClick={e => { if (selectorOpen) setSelectorOpen(false) }}>
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-16 z-20">
        <div className="flex items-center gap-1 border border-slate-200 overflow-hidden">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                period === p.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <span className="text-xs text-slate-400">
            Piloto · 5 clientes · mayo 2025
          </span>
          <WidgetSelector
            widgets={widgets}
            onToggle={toggle}
            onReset={reset}
            open={selectorOpen}
            setOpen={setSelectorOpen}
          />
        </div>
      </div>

      {/* Critical alerts banner */}
      <CriticalBanner />

      {/* KPI Strip */}
      <KPIStrip period={period} />

      {/* Main grid */}
      <div className="p-4 sm:p-5 space-y-4">

        {/* Row 1: Volume trend (wide) + Portfolio status */}
        {(vis.volumeTrend || vis.portfolio) && (
          <div className="grid lg:grid-cols-3 gap-4">
            {vis.volumeTrend && (
              <div className="lg:col-span-2">
                <VolumeTrendChart period={period} />
              </div>
            )}
            {vis.portfolio && (
              <div className={!vis.volumeTrend ? 'lg:col-span-3' : ''}>
                <PortfolioStatus />
              </div>
            )}
          </div>
        )}

        {/* Row 2: Forecast (wide) + Channel mix */}
        {(vis.forecast || vis.channels) && (
          <div className="grid lg:grid-cols-3 gap-4">
            {vis.forecast && (
              <div className="lg:col-span-2">
                <WorkloadForecast />
              </div>
            )}
            {vis.channels && (
              <div className={!vis.forecast ? 'lg:col-span-3' : ''}>
                <ChannelMixChart period={period} />
              </div>
            )}
          </div>
        )}

        {/* Row 3: Employee productivity + Client volume */}
        {(vis.employees || vis.clients) && (
          <div className="grid lg:grid-cols-2 gap-4">
            {vis.employees && <EmployeeProductivity period={period} />}
            {vis.clients && <ClientVolumeChart period={period} />}
          </div>
        )}

        {/* Row 4: Weekday pattern + SIGA efficiency */}
        {(vis.weekday || vis.siga) && (
          <div className="grid lg:grid-cols-2 gap-4">
            {vis.weekday && <WeekdayPattern />}
            {vis.siga && <SIGAEfficiency />}
          </div>
        )}

        {/* Empty state */}
        {!Object.values(vis).some(Boolean) && (
          <div className="text-center py-20 bg-white border border-slate-200">
            <p className="text-sm text-slate-400 mb-3">No hay widgets visibles.</p>
            <button
              onClick={reset}
              className="text-xs font-medium text-slate-600 border border-slate-300 px-4 py-2 hover:bg-slate-50 transition-colors"
            >
              Restaurar dashboard
            </button>
          </div>
        )}

        {/* Attribution */}
        <div className="pt-2 flex items-center justify-between text-[10px] text-slate-300">
          <span>EFFORT Control 360 · Piloto mayo 2025 · Datos demo — no reales</span>
          <span>IA no toma decisiones contables · Sujeto a revisión humana</span>
        </div>
      </div>
    </div>
  )
}
