/**
 * DatabasePage — Inspeção e limpeza de dados por número de telefone
 * Permite ver histórico de conversas por campanha, logs de ingestão
 * e realizar operações de limpeza cirúrgica. ADMIN only.
 */

import { useState }        from 'react'
import { Search, Trash2, RefreshCw, MessageSquare, FileText, AlertTriangle, Clock } from 'lucide-react'
import { Button }          from '@/components/ui/Button'
import { Modal }           from '@/components/ui/Modal'
import { useToast }        from '@/components/ui/Toast'
import { cn }              from '@/lib/utils'
import {
  useInspectPhone, useClearHistory, useClearLogs, useResetLead,
} from '../hooks/useDatabase'
import type { PhoneInspectResult } from '@/services/settings'

type ConfirmAction = 'history' | 'logs' | 'reset'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    teste:              'bg-blue-500/15 text-blue-300',
    em_conversa:        'bg-green-500/15 text-green-300',
    followup_enviado:   'bg-yellow-500/15 text-yellow-300',
    conversa_encerrada: 'bg-white/10 text-white/40',
    opt_out:            'bg-red-500/15 text-red-300',
    link_enviado:       'bg-purple-500/15 text-purple-300',
  }
  const cls = map[status ?? ''] ?? 'bg-white/8 text-white/40'
  return (
    <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', cls)}>
      {status ?? 'sem status'}
    </span>
  )
}

function ConfirmModal({
  action,
  phone,
  onConfirm,
  onClose,
  isPending,
}: {
  action:    ConfirmAction
  phone:     string
  onConfirm: () => void
  onClose:   () => void
  isPending: boolean
}) {
  const labels: Record<ConfirmAction, { title: string; desc: string; btn: string }> = {
    history: {
      title: 'Limpar histórico de conversas',
      desc:  `Todo o histórico de conversas de ${phone} será apagado. O lead continuará existindo no banco.`,
      btn:   'Limpar histórico',
    },
    logs: {
      title: 'Limpar logs de ingestão',
      desc:  `Todos os registros de log de ingestão de ${phone} serão deletados permanentemente.`,
      btn:   'Limpar logs',
    },
    reset: {
      title: 'Reset completo do número',
      desc:  `Histórico, logs de ingestão, mensagem enviada e tentativas de follow-up de ${phone} serão zerados. O lead voltará ao status "teste".`,
      btn:   'Confirmar reset',
    },
  }
  const { title, desc, btn } = labels[action]

  return (
    <Modal open title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-amber-500/8 border border-amber-500/25 px-3 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-200/80 leading-relaxed">{desc}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Aguarde…' : btn}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function DatabasePage() {
  const { toast }   = useToast()
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<PhoneInspectResult | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)

  const inspect      = useInspectPhone()
  const clearHistory = useClearHistory()
  const clearLogs    = useClearLogs()
  const resetLead    = useResetLead()

  const cleaned = phone.replace(/\D/g, '').trim()

  function handleInspect() {
    if (!cleaned) return
    inspect.mutate(cleaned, {
      onSuccess: (data) => setResult(data),
      onError:   () => toast({ type: 'error', title: 'Erro ao buscar número.' }),
    })
  }

  function handleConfirm() {
    if (!confirm || !cleaned) return

    const refreshAfter = () => {
      // Re-inspeciona para atualizar o card
      inspect.mutate(cleaned, { onSuccess: (data) => setResult(data) })
      setConfirm(null)
    }

    if (confirm === 'history') {
      clearHistory.mutate({ phones: [cleaned] }, {
        onSuccess: ({ cleared }) => {
          toast({ type: 'success', title: `Histórico limpo (${cleared} lead).` })
          refreshAfter()
        },
        onError: () => toast({ type: 'error', title: 'Erro ao limpar histórico.' }),
      })
    } else if (confirm === 'logs') {
      clearLogs.mutate([cleaned], {
        onSuccess: ({ deleted }) => {
          toast({ type: 'success', title: `${deleted} log(s) deletados.` })
          refreshAfter()
        },
        onError: () => toast({ type: 'error', title: 'Erro ao limpar logs.' }),
      })
    } else if (confirm === 'reset') {
      resetLead.mutate([cleaned], {
        onSuccess: ({ resetLeads, deletedLogs }) => {
          toast({ type: 'success', title: `Reset completo: ${resetLeads} lead, ${deletedLogs} logs.` })
          refreshAfter()
        },
        onError: () => toast({ type: 'error', title: 'Erro ao resetar.' }),
      })
    }
  }

  const isActioning = clearHistory.isPending || clearLogs.isPending || resetLead.isPending

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-white">Banco de Dados</h1>
        <p className="text-sm text-white/50 mt-1">
          Inspecione e limpe dados acumulados por número de telefone.
        </p>
      </div>

      {/* Busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
            placeholder="5511999990000"
            className={cn(
              'w-full h-10 pl-9 pr-3 rounded-lg text-sm',
              'bg-white/5 border border-white/10 text-white placeholder-white/25',
              'focus:outline-none focus:border-beacon-primary/50',
            )}
          />
        </div>
        <Button onClick={handleInspect} disabled={!cleaned || inspect.isPending}>
          {inspect.isPending ? 'Buscando…' : 'Inspecionar'}
        </Button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="space-y-4">
          {!result.found ? (
            <div className="rounded-xl border border-white/8 bg-white/3 px-5 py-6 text-center text-sm text-white/40">
              Nenhum lead encontrado para este número.
            </div>
          ) : (
            <>
              {/* Dados do lead */}
              <div className="rounded-xl border border-white/8 bg-beacon-surface px-5 py-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{result.lead!.nome}</p>
                    <p className="text-xs text-white/40 mt-0.5">{result.lead!.whatsapp}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={result.lead!.status} />
                    <span className="flex items-center gap-1 text-[11px] text-white/30">
                      <Clock className="w-3 h-3" />
                      {formatDate(result.lead!.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Histórico de conversas */}
              <div className="rounded-xl border border-white/8 bg-beacon-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-white/40" />
                    <span className="text-sm font-medium text-white">Histórico de conversas</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm('history')}
                    disabled={isActioning}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar
                  </Button>
                </div>

                <div className="px-5 py-3 space-y-2">
                  {result.lead!.legacyTurns > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-xs text-white/40 italic">Formato legado</span>
                      <span className="text-xs text-white/30">{result.lead!.legacyTurns} turnos</span>
                    </div>
                  )}

                  {result.lead!.history.length === 0 && result.lead!.legacyTurns === 0 ? (
                    <p className="text-xs text-white/30 py-2">Nenhum histórico de conversa.</p>
                  ) : (
                    result.lead!.history.map((h) => (
                      <div
                        key={h.automationId}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <div>
                          <p className="text-xs font-medium text-white/80">{h.automationName}</p>
                          <p className="text-[11px] text-white/30 mt-0.5 font-mono">{h.automationId.slice(0, 8)}…</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/60">{h.turnCount} turnos</p>
                          <p className="text-[11px] text-white/30">{formatDate(h.lastAt)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Logs de ingestão */}
              <div className="rounded-xl border border-white/8 bg-beacon-surface overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/6">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-white/40" />
                    <span className="text-sm font-medium text-white">Logs de Ingestão</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm('logs')}
                    disabled={isActioning || result.ingestionLogs.total === 0}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar
                  </Button>
                </div>

                <div className="px-5 py-3">
                  {result.ingestionLogs.total === 0 ? (
                    <p className="text-xs text-white/30 py-1">Nenhum log de ingestão.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        <span><span className="font-semibold text-white/80">{result.ingestionLogs.total}</span> registros</span>
                        <span>primeiro: {formatDate(result.ingestionLogs.firstAt)}</span>
                        <span>último: {formatDate(result.ingestionLogs.lastAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(result.ingestionLogs.byStatus).map(([status, count]) => (
                          <span
                            key={status}
                            className="px-2 py-0.5 rounded text-[11px] bg-white/6 text-white/50"
                          >
                            {status}: <span className="text-white/80 font-medium">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reset completo */}
              <div className="flex justify-end">
                <Button
                  variant="danger"
                  onClick={() => setConfirm('reset')}
                  disabled={isActioning}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Completo do Número
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal de confirmação */}
      {confirm && (
        <ConfirmModal
          action={confirm}
          phone={cleaned}
          onConfirm={handleConfirm}
          onClose={() => setConfirm(null)}
          isPending={isActioning}
        />
      )}
    </div>
  )
}
