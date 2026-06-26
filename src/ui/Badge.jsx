const MAP = {
  // Estado general
  Completo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'En proceso': 'bg-blue-50 text-blue-700 border-blue-200',
  Parcial: 'bg-amber-50 text-amber-700 border-amber-200',
  Pendiente: 'bg-slate-100 text-slate-600 border-slate-200',
  Observado: 'bg-orange-50 text-orange-700 border-orange-200',
  Crítico: 'bg-red-50 text-red-700 border-red-200',
  Bloqueado: 'bg-red-100 text-red-800 border-red-300',
  // SIGA
  Cargado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cargado completo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Con diferencias': 'bg-amber-50 text-amber-700 border-amber-200',
  'Controlado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Controlado con observaciones': 'bg-amber-50 text-amber-700 border-amber-200',
  'Parcial': 'bg-amber-50 text-amber-700 border-amber-200',
  // Liquidaciones
  Enviada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Respondida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Reclamada: 'bg-red-50 text-red-700 border-red-200',
  // Balance
  'Pre-revisado': 'bg-blue-50 text-blue-700 border-blue-200',
  // Riesgo
  Bajo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medio: 'bg-amber-50 text-amber-700 border-amber-200',
  Alto: 'bg-orange-50 text-orange-700 border-orange-200',
  // Documentos
  Clasificado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Revisión humana': 'bg-orange-50 text-orange-700 border-orange-200',
  // Alertas
  Crítica: 'bg-red-100 text-red-800 border-red-300',
  Alta: 'bg-orange-50 text-orange-700 border-orange-200',
  Media: 'bg-amber-50 text-amber-700 border-amber-200',
  Informativa: 'bg-blue-50 text-blue-700 border-blue-200',
  // Alert state
  Abierta: 'bg-red-50 text-red-700 border-red-200',
  Cerrada: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function Badge({ label, size = 'sm' }) {
  const cls = MAP[label] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center border rounded-sm font-medium tracking-wide ${pad} ${cls}`}>
      {label}
    </span>
  )
}
