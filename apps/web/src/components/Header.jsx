import { BarChart3, Bell, Download, Shield } from 'lucide-react'

export default function Header({ alertasCount, onExport, onAlerta }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-700 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">EFFORT</span>
              <span className="text-lg font-light text-blue-600 ml-1">Control 360</span>
            </div>
            <span className="hidden sm:inline-flex ml-2 items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              PILOTO — 5 clientes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAlerta}
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alertas</span>
              {alertasCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-xs font-bold bg-red-500 text-white rounded-full">
                  {alertasCount}
                </span>
              )}
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar reporte</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
