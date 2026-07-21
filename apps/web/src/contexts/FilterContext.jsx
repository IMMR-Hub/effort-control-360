import { createContext, useContext, useState } from 'react'

const FilterContext = createContext(null)

const DEFAULTS = {
  periodo: 'Abril 2026',
  cliente: 'Todos',
  responsable: 'Todos',
  coordinador: 'Todos',
  auxiliar: 'Todos',
  estado: 'Todos',
  riesgo: 'Todos',
  visualizacion: 'Tarjetas',
  modo: 'operativo', // 'direccion' | 'operativo'
}

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULTS)

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
  const resetFilters = () => setFilters(DEFAULTS)

  // Helper: filter a list of items by cliente/estado/riesgo
  const applyFilters = (items, opts = {}) => {
    const { clienteKey = 'cliente', estadoKey = 'estadoGeneral', riesgoKey = 'riesgo' } = opts
    return items.filter(item => {
      if (filters.cliente !== 'Todos' && item[clienteKey] !== filters.cliente) return false
      if (filters.estado !== 'Todos' && item[estadoKey] !== filters.estado) return false
      if (filters.riesgo !== 'Todos' && item[riesgoKey] !== filters.riesgo) return false
      return true
    })
  }

  return (
    <FilterContext.Provider value={{ filters, setFilter, resetFilters, applyFilters }}>
      {children}
    </FilterContext.Provider>
  )
}

export const useFilters = () => useContext(FilterContext)
