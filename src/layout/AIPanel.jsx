import { useState } from 'react'
import { X, Bot, Send, Sparkles } from 'lucide-react'
import { AI_QUESTIONS, AI_ANSWER } from '../data/data'

export default function AIPanel({ open, onClose }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '¡Hola! Soy el Asistente EFFORT. Puedo ayudarte a analizar el estado de la cartera, vencimientos críticos y priorizar acciones. ¿Qué necesitás saber?' }
  ])
  const [loading, setLoading] = useState(false)

  const ask = (question) => {
    const q = question || input.trim()
    if (!q) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    setTimeout(() => {
      let response = AI_ANSWER
      if (q.toLowerCase().includes('riesgo')) {
        response = '4 clientes en riesgo detectados: RAMIRO GARCIA (Crítico), GARSO S.A. (Alto). Acciones recomendadas: escalar presentaciones pendientes y validar SIGA.'
      } else if (q.toLowerCase().includes('faltan')) {
        response = '23 documentos pendientes distribuidos en 5 clientes. RAMIRO GARCIA necesita presentación societaria en 7 días. Recomendación: solicitar urgente.'
      } else if (q.toLowerCase().includes('vencimiento')) {
        response = '9 vencimientos próximos en 30 días. 2 son críticos (riesgo de multa). Acción inmediata: escalar presentación de RAMIRO GARCIA y validación GARSO S.A.'
      } else if (q.toLowerCase().includes('balance')) {
        response = '3 balances pendientes de pre-revisión. LAURA SOSA requiere correcciones menores. Próximo paso: enviar a revisión humana después de validar inconsistencias.'
      } else if (q.toLowerCase().includes('resumen')) {
        response = '📊 Semana de 5 clientes: 184 docs procesados, 23 pendientes, 9 vencimientos próximos, 4 alertas críticas. Piloto en buen camino. Recomendación: iniciar fase 2 con feedback de usuario.'
      }
      setMessages(prev => [...prev, { role: 'assistant', text: response }])
      setLoading(false)
    }, 1200)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white flex flex-col h-full shadow-2xl border-l border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600 rounded-sm flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Asistente EFFORT</p>
              <p className="text-[10px] text-purple-400">Demo · No usa datos reales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-700 transition-colors" aria-label="Cerrar">
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                </div>
              )}
              <div className={`max-w-[85%] px-3 py-2 text-sm rounded-sm leading-relaxed
                ${m.role === 'user'
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-800'
                }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="bg-slate-100 px-3 py-2 rounded-sm flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Suggested questions */}
        <div className="px-4 pb-2 flex-shrink-0 border-t border-slate-100 pt-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Preguntas sugeridas</p>
          <div className="flex flex-col gap-1">
            {AI_QUESTIONS.slice(0, 3).map((q, i) => (
              <button
                key={i}
                onClick={() => ask(q)}
                className="text-left text-xs text-blue-700 hover:text-blue-900 hover:underline truncate"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="Escribí tu consulta..."
              className="flex-1 text-sm border border-slate-200 rounded-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Consulta al asistente"
            />
            <button
              onClick={() => ask()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 p-2 bg-purple-600 text-white rounded-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
