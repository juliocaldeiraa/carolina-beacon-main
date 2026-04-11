import { AlertTriangle, MessageSquare, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChannelConflictItem } from '@/types/channel'

interface ChannelConflictModalProps {
  open:        boolean
  conflicts:   ChannelConflictItem[]
  actionLabel: string
  onConfirm:   () => void
  onCancel:    () => void
}

export function ChannelConflictModal({
  open,
  conflicts,
  actionLabel,
  onConfirm,
  onCancel,
}: ChannelConflictModalProps) {
  if (!open) return null

  const hasChatIa = conflicts.some((c) => c.chatIa.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#1a1209] shadow-2xl overflow-hidden">

        {/* Header âmbar */}
        <div className="flex items-start gap-4 px-5 pt-5 pb-4 border-b border-amber-500/20">
          <div className="mt-0.5 shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-amber-200">Conflito de Canal Detectado</h2>
            <p className="text-xs text-amber-400/70 mt-0.5">
              {hasChatIa
                ? 'Um ou mais canais estão ativos no Chat IA ao mesmo tempo.'
                : 'Um ou mais canais já estão em uso por outra campanha ativa.'}
            </p>
          </div>
        </div>

        {/* Corpo — lista de conflitos */}
        <div className="px-5 py-4 space-y-4 max-h-64 overflow-y-auto">
          {conflicts.map((conflict) => (
            <div key={conflict.channelId} className="space-y-2">
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">
                Canal: <span className="text-white/70 normal-case">{conflict.channelName}</span>
              </p>

              {/* Chat IA conflicts */}
              {conflict.chatIa.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2.5 rounded-lg border border-orange-500/25 bg-orange-500/8 px-3 py-2.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-orange-300">
                      Chat IA ativo: "{c.name}"
                    </p>
                    <p className="text-[11px] text-orange-400/70 mt-0.5">
                      Agente: <span className="text-orange-300">{c.agentName}</span>
                    </p>
                    <p className="text-[11px] text-orange-400/60 mt-1 leading-relaxed">
                      Quando um lead responder, este agente vai interceptar a mensagem e responder no lugar do agente desta campanha.
                    </p>
                  </div>
                </div>
              ))}

              {/* Automation conflicts */}
              {conflict.automations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2.5 rounded-lg border border-yellow-500/25 bg-yellow-500/8 px-3 py-2.5"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-300">
                      Campanha ativa: "{a.name}"
                    </p>
                    <p className="text-[11px] text-yellow-400/60 mt-0.5">
                      Outra campanha está usando este canal agora. Disparos simultâneos podem causar mensagens duplicadas ou conflito de contexto.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Aviso leigo */}
        <div className="mx-5 mb-4 rounded-lg bg-white/4 border border-white/8 px-3 py-2.5">
          <p className="text-[11px] text-white/50 leading-relaxed">
            <span className="font-semibold text-white/70">O que pode acontecer:</span>{' '}
            {hasChatIa
              ? 'O agente do Chat IA vai responder às mensagens dos seus contatos de teste, como se fosse um atendimento real — o contexto estará errado.'
              : 'Dois sistemas vão tentar usar o mesmo canal ao mesmo tempo, o que pode causar respostas duplicadas ou bloqueio do número.'}
          </p>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'border border-white/12 text-white/60 hover:text-white hover:border-white/25',
            )}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onCancel() }}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-amber-500/20 text-amber-300 border border-amber-500/40',
              'hover:bg-amber-500/30 hover:border-amber-500/60',
            )}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
