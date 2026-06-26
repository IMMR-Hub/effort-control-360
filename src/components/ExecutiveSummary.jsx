import { CheckCircle, Clock, TrendingUp, Shield } from 'lucide-react'

const items = [
  { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', title: 'Visibilidad completa', desc: 'Documentos recibidos, faltantes, vencimientos, carga SIGA, liquidaciones y balances en un solo lugar.' },
  { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', title: '36 horas ahorradas', desc: 'Estimación del tiempo de seguimiento manual eliminado en el piloto de 5 clientes durante el primer mes.' },
  { icon: Shield, color: 'text-red-600', bg: 'bg-red-50', title: 'Riesgos prevenidos', desc: 'Alertas proactivas de vencimientos societarios evitan multas como la ocurrida de Gs. 6.000.000.' },
  { icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', title: 'Listo para escalar', desc: 'Validado con 5 clientes. Arquitectura preparada para los 98 clientes activos de EFFORT.' },
]

export default function ExecutiveSummary() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-white">
        <h3 className="text-lg font-bold mb-2">Resumen del piloto</h3>
        <p className="text-blue-100 text-sm leading-relaxed">
          En este piloto de 5 clientes, <strong className="text-white">EFFORT Control 360</strong> permite visualizar
          documentos recibidos, faltantes, vencimientos, carga SIGA, liquidaciones y balances en un solo lugar.
          El sistema no reemplaza SIGA ni toma decisiones contables; <strong className="text-white">ordena la operación,
          reduce el seguimiento manual y alerta riesgos antes de que generen multas o atrasos.</strong>
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.map(item => {
          const Icon = item.icon
          return (
            <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
              <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg ${item.bg}`}>
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-700">
        <p className="font-semibold text-gray-900 mb-1">Propuesta de validación – 14 días</p>
        <p className="leading-relaxed">
          Esta demo muestra cómo EFFORT podría validar en 14 días una capa de control sobre SIGA, Drive y Calendar,
          usando solo 5 clientes reales, sin reemplazar sistemas actuales y midiendo:
          ahorro de tiempo, riesgos detectados y vencimientos prevenidos.
        </p>
      </div>
    </div>
  )
}
