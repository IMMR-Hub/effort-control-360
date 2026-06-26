import { Users, FileText, Clock, CalendarClock, AlertTriangle, BarChart3, Send, Timer } from 'lucide-react'

const ICONS = { Users, FileText, Clock, CalendarClock, AlertTriangle, BarChart3, Send, Timer }

const STATUS = {
  success: { ring: 'ring-emerald-200', icon: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'text-emerald-600' },
  warning: { ring: 'ring-amber-200', icon: 'text-amber-600', bg: 'bg-amber-50', trend: 'text-amber-600' },
  danger: { ring: 'ring-red-200', icon: 'text-red-600', bg: 'bg-red-50', trend: 'text-red-600' },
  info: { ring: 'ring-blue-200', icon: 'text-blue-600', bg: 'bg-blue-50', trend: 'text-blue-600' },
}

export default function KPICard({ title, value, unit = '', trend, status = 'info', icon = 'FileText' }) {
  const Icon = ICONS[icon] || FileText
  const s = STATUS[status] || STATUS.info

  return (
    <div className={`bg-white border border-slate-200 rounded-sm p-4 ring-1 ${s.ring} hover:shadow-md transition-shadow duration-200 cursor-default`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">{title}</p>
        <div className={`flex-shrink-0 p-1.5 rounded-sm ${s.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${s.icon}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-data text-3xl font-bold text-slate-900 leading-none tabular-nums">{value.toLocaleString('es-PY')}</span>
        {unit && <span className="font-data text-base text-slate-500 font-medium">{unit}</span>}
      </div>
      <p className={`text-[11px] mt-2 font-medium ${s.trend}`}>{trend}</p>
    </div>
  )
}
