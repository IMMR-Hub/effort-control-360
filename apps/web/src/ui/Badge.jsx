const MAP = {
  // Estado general
  Controlado:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Completo:     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'En proceso': { cls: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-500' },
  Parcial:      { cls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400' },
  Pendiente:    { cls: 'bg-slate-100 text-slate-600 border-slate-200',      dot: 'bg-slate-400' },
  Observado:    { cls: 'bg-orange-50 text-orange-700 border-orange-200',    dot: 'bg-orange-500' },
  Crítico:      { cls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
  Bloqueado:    { cls: 'bg-red-100 text-red-800 border-red-300',            dot: 'bg-red-600' },
  // SIGA
  Cargado:               { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Cargado completo':    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Con diferencias':     { cls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400' },
  'Controlado con observaciones': { cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  // Liquidaciones
  Enviada:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Respondida: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Reclamada:  { cls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
  // Balance
  'Pre-revisado': { cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  'Aprobado':     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'En revisión':  { cls: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-400' },
  // Riesgo
  Bajo:  { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Medio: { cls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400' },
  Alto:  { cls: 'bg-orange-50 text-orange-700 border-orange-200',    dot: 'bg-orange-500' },
  // Documentos
  Clasificado:      { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Revisión humana':{ cls: 'bg-orange-50 text-orange-700 border-orange-200',    dot: 'bg-orange-500' },
  // Alertas
  Crítica:     { cls: 'bg-red-100 text-red-800 border-red-300',          dot: 'bg-red-600' },
  Alta:        { cls: 'bg-orange-50 text-orange-700 border-orange-200',  dot: 'bg-orange-500' },
  Media:       { cls: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-400' },
  Informativa: { cls: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-400' },
  // Alert state
  Abierta: { cls: 'bg-red-50 text-red-700 border-red-200',     dot: 'bg-red-500' },
  Cerrada:  { cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
  // Revisar
  Revisar: { cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
}

const FALLBACK = { cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' }

export default function Badge({ label, size = 'sm', dot = true }) {
  const { cls, dot: dotColor } = MAP[label] ?? FALLBACK
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[10px] gap-1' : 'px-2 py-0.5 text-[11px] gap-1.5'
  return (
    <span className={`inline-flex items-center border rounded-full font-semibold tracking-wide ${pad} ${cls}`}>
      {dot && <span className={`status-dot ${dotColor}`} style={{ width: '5px', height: '5px' }} />}
      {label}
    </span>
  )
}
