import { X, FileText, Database, Send, BarChart3, User, ArrowRight, AlertTriangle } from 'lucide-react'
import Badge from './Badge'

export default function ClientModal({ cliente, onClose }) {
  if (!cliente) return null

  const metrics = [
    { label: 'Docs recibidos', value: cliente.docsRecibidos, sub: `${cliente.docsPendientes} pendientes`, icon: FileText },
    { label: 'Estado SIGA', value: cliente.estadoSIGA, icon: Database },
    { label: 'Liquidación', value: cliente.estadoLiquidacion, icon: Send },
    { label: 'Balance', value: cliente.estadoBalance, icon: BarChart3 },
    { label: 'Responsable', value: cliente.responsable, icon: User },
    { label: 'Coordinador', value: cliente.coordinador, icon: User },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-sm shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 flex-shrink-0">
          <div>
            <h2 className="font-bold text-white text-sm tracking-tight">{cliente.nombre}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{cliente.periodo} · {cliente.canal}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge label={cliente.estadoGeneral} />
            <Badge label={cliente.riesgo} />
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-700 transition-colors ml-2" aria-label="Cerrar">
              <X className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          <div className="p-5 grid sm:grid-cols-2 gap-3">
            {metrics.map(m => {
              const Icon = m.icon
              return (
                <div key={m.label} className="bg-slate-50 border border-slate-100 rounded-sm p-3.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{m.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{m.value}</p>
                  {m.sub && <p className="text-xs text-amber-600 mt-0.5 font-medium">{m.sub}</p>}
                </div>
              )
            })}
          </div>

          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-200 rounded-sm">
              <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-0.5">Próxima acción</p>
                <p className="text-sm text-blue-800">{cliente.proximaAccion}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-sm transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Exportar reporte
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-sm transition-colors">
                <AlertTriangle className="w-3.5 h-3.5" />
                Enviar alerta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
