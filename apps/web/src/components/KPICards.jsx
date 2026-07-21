import { Users, FileText, Clock, AlertTriangle, CheckCircle, Send, Bell, Zap } from 'lucide-react'

const kpis = [
  { label: 'Clientes piloto', value: '5', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Documentos recibidos', value: '342', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Docs. pendientes', value: '27', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { label: 'Vencimientos próximos', value: '8', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
  { label: 'Balances pendientes', value: '3', icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
  { label: 'Liquidaciones enviadas', value: '4', icon: Send, color: 'text-green-600', bg: 'bg-green-50' },
  { label: 'Alertas críticas', value: '11', icon: Bell, color: 'text-red-600', bg: 'bg-red-50' },
  { label: 'Horas estimadas ahorradas', value: '36 h', icon: Zap, color: 'text-teal-600', bg: 'bg-teal-50' },
]

export default function KPICards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${kpi.bg}`}>
              <Icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 leading-none">{kpi.value}</p>
              <p className="text-xs text-gray-500 mt-1 leading-snug">{kpi.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
