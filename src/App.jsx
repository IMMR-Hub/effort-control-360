import { useState } from 'react'
import { FilterProvider } from './contexts/FilterContext'
import Sidebar from './layout/Sidebar'
import TopBar from './layout/TopBar'
import AIPanel from './layout/AIPanel'
import Overview from './pages/Overview'
import Clientes from './pages/Clientes'
import Documentos from './pages/Documentos'
import IVAPage from './pages/IVA'
import Vencimientos from './pages/Vencimientos'
import Balances from './pages/Balances'
import Liquidaciones from './pages/Liquidaciones'
import Alertas from './pages/Alertas'
import Responsables from './pages/Responsables'

const PAGES = {
  overview: { component: Overview, title: 'Vista General' },
  clientes: { component: Clientes, title: 'Clientes' },
  documentos: { component: Documentos, title: 'Documentos' },
  iva: { component: IVAPage, title: 'IVA / Compras / Ventas' },
  vencimientos: { component: Vencimientos, title: 'Vencimientos' },
  balances: { component: Balances, title: 'Balances' },
  liquidaciones: { component: Liquidaciones, title: 'Liquidaciones' },
  alertas: { component: Alertas, title: 'Alertas' },
  responsables: { component: Responsables, title: 'Responsables' },
}

function AppShell() {
  const [page, setPage] = useState('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [aiOpen, setAIOpen] = useState(false)

  const current = PAGES[page] || PAGES.overview
  const PageComponent = current.component

  return (
    <div className="min-h-dvh bg-slate-100">
      <Sidebar
        active={page}
        onChange={setPage}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <TopBar
        pageTitle={current.title}
        onMenuOpen={() => setMobileMenuOpen(true)}
        onAIOpen={() => setAIOpen(true)}
      />

      {/* Main content — offset for fixed sidebar (collapsed 64px) and top bar (64px) */}
      <main className="lg:pl-16 pt-16 pb-16 lg:pb-0 min-h-dvh" id="main-content" tabIndex={-1}>
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6">
          <PageComponent />
        </div>
      </main>

      <AIPanel open={aiOpen} onClose={() => setAIOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  )
}
