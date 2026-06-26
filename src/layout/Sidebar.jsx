import {
  LayoutDashboard, Users, FolderOpen, Calculator,
  CalendarClock, BarChart3, Send, Bell, UserCheck, ChevronRight
} from 'lucide-react'

const NAV = [
  { id: 'overview', label: 'Vista General', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'documentos', label: 'Documentos', icon: FolderOpen },
  { id: 'iva', label: 'IVA / Compras / Ventas', icon: Calculator },
  { id: 'vencimientos', label: 'Vencimientos', icon: CalendarClock },
  { id: 'balances', label: 'Balances', icon: BarChart3 },
  { id: 'liquidaciones', label: 'Liquidaciones', icon: Send },
  { id: 'alertas', label: 'Alertas', icon: Bell, badge: 4 },
  { id: 'responsables', label: 'Responsables', icon: UserCheck },
]

// Desktop: hover-reveal sidebar
export default function Sidebar({ active, onChange, mobileOpen, onMobileClose }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="sidebar-nav hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-slate-900 overflow-hidden group"
        aria-label="Navegación principal"
      >
        {/* Logo area */}
        <div className="flex items-center h-16 px-4 border-b border-slate-700/60 flex-shrink-0 gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div className="nav-label overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">EFFORT</p>
            <p className="text-blue-400 text-[10px] whitespace-nowrap">Control 360</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin">
          {NAV.map(item => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 relative group/item
                  ${isActive
                    ? 'bg-blue-700/30 text-white border-r-2 border-blue-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                <span className="nav-label text-sm font-medium whitespace-nowrap overflow-hidden">{item.label}</span>
                {item.badge ? (
                  <span className="nav-label ml-auto flex-shrink-0 flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-700/60 p-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">LS</span>
            </div>
            <div className="nav-label overflow-hidden">
              <p className="text-xs text-white font-medium whitespace-nowrap">Laura Sosa</p>
              <p className="text-[10px] text-slate-400 whitespace-nowrap">Responsable</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <div className="relative w-72 bg-slate-900 flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">EFFORT</p>
                  <p className="text-blue-400 text-[10px]">Control 360</p>
                </div>
              </div>
              <button onClick={onMobileClose} className="text-slate-400 hover:text-white p-1">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3">
              {NAV.map(item => {
                const Icon = item.icon
                const isActive = active === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => { onChange(item.id); onMobileClose() }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                      ${isActive ? 'bg-blue-700/30 text-white border-r-2 border-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.badge ? <span className="ml-auto flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">{item.badge}</span> : null}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around px-2 h-14 safe-area-inset-bottom">
        {NAV.slice(0, 5).map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg relative transition-colors
                ${isActive ? 'text-blue-700' : 'text-slate-400 hover:text-slate-700'}`}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium">{item.label.split(' ')[0]}</span>
              {item.badge && (
                <span className="absolute -top-0.5 right-1 w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}
