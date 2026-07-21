import { Users, FileText, Clock, CalendarClock, AlertTriangle, BarChart3, Send, Timer } from 'lucide-react'

const ICONS = { Users, FileText, Clock, CalendarClock, AlertTriangle, BarChart3, Send, Timer }

const STATUS = {
  success: {
    accent: 'kpi-accent-success',
    icon: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    trend: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  warning: {
    accent: 'kpi-accent-warning',
    icon: 'text-amber-600',
    iconBg: 'bg-amber-100',
    trend: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  danger: {
    accent: 'kpi-accent-danger',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
    trend: 'text-red-700',
    dot: 'bg-red-500 animate-pulse-dot',
  },
  info: {
    accent: 'kpi-accent-info',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
    trend: 'text-blue-700',
    dot: 'bg-blue-500',
  },
}

export default function KPICard({ title, value, unit = '', trend, status = 'info', icon = 'FileText' }) {
  const Icon = ICONS[icon] || FileText
  const s = STATUS[status] || STATUS.info

  return (
    <div className={`${s.accent} rounded-lg p-4 card card-interactive`} style={{ minHeight: '100px' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="section-label leading-tight max-w-[80%]">{title}</p>
        <div className={`flex-shrink-0 p-1.5 rounded-md ${s.iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${s.icon}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="font-data text-3xl font-bold text-slate-900 leading-none tabular-nums">
          {value.toLocaleString('es-PY')}
        </span>
        {unit && <span className="font-data text-sm text-slate-500 font-medium ml-0.5">{unit}</span>}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className={`status-dot ${s.dot}`} />
        <p className={`text-[11px] font-medium ${s.trend}`}>{trend}</p>
      </div>
    </div>
  )
}
