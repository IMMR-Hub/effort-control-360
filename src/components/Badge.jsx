const variants = {
  Completo: 'bg-green-100 text-green-800 border-green-200',
  Completa: 'bg-green-100 text-green-800 border-green-200',
  Enviada: 'bg-green-100 text-green-800 border-green-200',
  Respondida: 'bg-green-100 text-green-800 border-green-200',
  Vigente: 'bg-green-100 text-green-800 border-green-200',
  'Listo para revisión': 'bg-blue-100 text-blue-800 border-blue-200',
  'En proceso': 'bg-blue-100 text-blue-800 border-blue-200',
  'En preparación': 'bg-blue-100 text-blue-800 border-blue-200',
  'En revisión': 'bg-blue-100 text-blue-800 border-blue-200',
  Listo: 'bg-blue-100 text-blue-800 border-blue-200',
  Parcial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Con diferencias': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Alerta: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Observado: 'bg-orange-100 text-orange-800 border-orange-200',
  Pendiente: 'bg-gray-100 text-gray-700 border-gray-200',
  'Sin fecha': 'bg-gray-100 text-gray-700 border-gray-200',
  Crítico: 'bg-red-100 text-red-800 border-red-200',
  Bloqueado: 'bg-red-100 text-red-800 border-red-200',
  Reclamada: 'bg-red-100 text-red-800 border-red-200',
  Verificado: 'bg-green-100 text-green-800 border-green-200',
  'Requiere revisión humana': 'bg-orange-100 text-orange-800 border-orange-200',
  Crítica: 'bg-red-100 text-red-800 border-red-200',
  Alta: 'bg-orange-100 text-orange-800 border-orange-200',
  Media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Informativa: 'bg-blue-100 text-blue-800 border-blue-200',
  Bajo: 'bg-green-100 text-green-800 border-green-200',
  Medio: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Alto: 'bg-orange-100 text-orange-800 border-orange-200',
}

export default function Badge({ label, size = 'sm' }) {
  const cls = variants[label] || 'bg-gray-100 text-gray-700 border-gray-200'
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${padding} ${cls}`}>
      {label}
    </span>
  )
}
