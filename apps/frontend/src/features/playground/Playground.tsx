/**
 * Playground — Simulador de agentes em 3 modos:
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  [Agente] [Disparo] [Automação]      modelo ▾       │
 * ├──────────────────────────────────────┬──────────────┤
 * │  Seletor contextual (por aba)        │  Metadados   │
 * │  ──────────────────────────────────  │              │
 * │  Chat area (igual nos 3 modos)       │              │
 * │  [typing indicator]                  │              │
 * ├──────────────────────────────────────┴──────────────┤
 * │  [textarea]                              [Enviar ➤] │
 * └─────────────────────────────────────────────────────┘
 *
 * Agente:    seleciona agente → chat direto
 * Disparo:   seleciona campanha → pré-carrega template como contexto → simula reply do lead
 * Automação: seleciona automação → pré-carrega templates → simula reply do lead
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import {
  Bot, Send, RotateCcw, MessageSquare, Zap, Hash, Cpu,
  Megaphone, Workflow, Info,
} from 'lucide-react'
import { useQuery }         from '@tanstack/react-query'
import { Button }           from '@/components/ui/Button'
import { useAgents }        from '@/features/agents/hooks/useAgents'
import { usePlayground }    from './hooks/usePlayground'
import { useToast }         from '@/components/ui/Toast'
import { playgroundService } from '@/services/playground'
import { cn }               from '@/lib/utils'
import type { ChatMessage, MessageMetadata, PlaygroundMode } from '@/types/playground'

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm',
        isUser
          ? 'bg-beacon-primary text-white rounded-br-sm'
          : msg.isContext
            ? 'bg-white/8 border border-dashed border-white/20 text-white/80 rounded-bl-sm'
            : 'bg-beacon-surface-2 border border-[rgba(255,255,255,0.08)] text-white/85 rounded-bl-sm',
      )}>
        {msg.isContext && (
          <p className="text-[9px] text-white/40 font-medium uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Info className="w-3 h-3" /> Contexto inicial
          </p>
        )}
        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
        <p className={cn('text-[10px] mt-1.5', isUser ? 'text-orange-200 text-right' : 'text-white/35')}>
          {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ─── Metadata panel ───────────────────────────────────────────────────────────

function MetadataPanel({ meta }: { meta: MessageMetadata | null }) {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 border-l border-[rgba(255,255,255,0.07)] bg-beacon-surface flex-col gap-5 p-5">
      <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-beacon-primary" />
        Última Resposta
      </h3>
      {meta ? (
        <dl className="space-y-4">
          {meta.latencyMs !== undefined && (
            <div>
              <dt className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5">Latência</dt>
              <dd className="text-lg font-bold text-white">{meta.latencyMs}ms</dd>
            </div>
          )}
          {meta.inputTokens !== undefined && (
            <div>
              <dt className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Tokens Entrada
              </dt>
              <dd className="text-sm font-semibold text-white">{meta.inputTokens}</dd>
            </div>
          )}
          {meta.outputTokens !== undefined && (
            <div>
              <dt className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Tokens Saída
              </dt>
              <dd className="text-sm font-semibold text-white">{meta.outputTokens}</dd>
            </div>
          )}
          {meta.inputTokens !== undefined && meta.outputTokens !== undefined && (
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3">
              <dt className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5">Total Tokens</dt>
              <dd className="text-base font-bold text-beacon-primary">
                {meta.inputTokens + meta.outputTokens}
              </dd>
            </div>
          )}
          {meta.model && (
            <div>
              <dt className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Modelo
              </dt>
              <dd className="text-xs font-medium text-white truncate">{meta.model}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-xs text-white/40 leading-relaxed">
          Envie uma mensagem para ver os metadados da resposta.
        </p>
      )}
    </aside>
  )
}

// ─── Available models ─────────────────────────────────────────────────────────

const AVAILABLE_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6' },
  { value: 'gpt-4o-mini',               label: 'GPT-4o Mini' },
  { value: 'gpt-4o',                    label: 'GPT-4o' },
]

const TABS: { id: PlaygroundMode; label: string; Icon: React.ElementType }[] = [
  { id: 'agent',     label: 'Agente',    Icon: Bot },
  { id: 'broadcast', label: 'Disparo',   Icon: Megaphone },
  { id: 'vendedor',  label: 'Vendedor',  Icon: Workflow },
]

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-white/8 flex items-center justify-center">
        <Icon className="w-8 h-8 text-white/35" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/40 mt-1">{subtitle}</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Playground() {
  const { toast }                          = useToast()
  const [mode, setMode]                    = useState<PlaygroundMode>('agent')
  const [model, setModel]                  = useState(AVAILABLE_MODELS[0].value)
  const [input, setInput]                  = useState('')
  const scrollRef                          = useRef<HTMLDivElement>(null)

  // Selectors per mode
  const [agentId,       setAgentId]       = useState('')
  const [broadcastId,   setBroadcastId]   = useState('')
  const [automationId,  setAutomationId]  = useState('')

  // Queries
  const { data: agents, isLoading: agentsLoading }         = useAgents()
  const { data: broadcasts, isLoading: broadcastsLoading } = useQuery({
    queryKey: ['playground-broadcasts'],
    queryFn:  () => playgroundService.getBroadcasts(),
  })
  const { data: automations, isLoading: automationsLoading } = useQuery({
    queryKey: ['playground-automations'],
    queryFn:  () => playgroundService.getAutomations(),
  })

  // Resolve agentId + context based on mode
  const selectedBroadcast  = broadcasts?.find((b) => b.id === broadcastId)
  const selectedAutomation = automations?.find((a) => a.id === automationId)

  const resolvedAgentId = mode === 'agent'
    ? (agentId || null)
    : mode === 'broadcast'
      ? (selectedBroadcast?.agentId ?? null)
      : (selectedAutomation?.linkedAgentId ?? null)

  const contextMessages = mode === 'broadcast' && selectedBroadcast
    ? [{ role: 'assistant' as const, content: selectedBroadcast.template }]
    : mode === 'vendedor' && selectedAutomation
      ? selectedAutomation.messageTemplates.map((t) => ({ role: 'assistant' as const, content: t }))
      : []

  const { messages, lastMeta, loading, error, sendMessage, resetSession } = usePlayground(
    resolvedAgentId,
    model,
    contextMessages,
  )

  useEffect(() => { if (error) toast({ type: 'error', title: error }) }, [error, toast])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || !resolvedAgentId || loading) return
    setInput('')
    await sendMessage(msg)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend()
  }

  const activeAgents = agents?.filter((a) => a.status === 'ACTIVE') ?? []
  const hasSource    = !!resolvedAgentId

  // Info tag shown under selector for broadcast/vendedor
  const infoLine = mode === 'broadcast' && selectedBroadcast
    ? `Agente: ${selectedBroadcast.agentName ?? '—'} · Status: ${selectedBroadcast.status}`
    : mode === 'vendedor' && selectedAutomation
      ? `Agente: ${selectedAutomation.agentName ?? 'nenhum'} · Status: ${selectedAutomation.status}`
      : null

  return (
    <div className="flex flex-col -m-6" style={{ height: 'calc(100vh - 4rem - 1px)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.07)] bg-beacon-surface shrink-0">

        {/* Tabs + model */}
        <div className="flex items-center justify-between px-6 pt-3 pb-0">
          <div className="flex items-center gap-1">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors border-b-2',
                  mode === id
                    ? 'border-beacon-primary text-beacon-primary bg-beacon-primary/10'
                    : 'border-transparent text-white/50 hover:text-white hover:bg-white/6',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Model selector + nova sessão */}
          <div className="flex items-center gap-2 pb-1">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-xs border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-1.5 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 text-white/85"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetSession()}
              disabled={!hasSource}
              title="Iniciar nova sessão"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Nova Sessão
            </Button>
          </div>
        </div>

        {/* Source selector (contextual per tab) */}
        <div className="px-6 py-2.5 flex items-center gap-3 flex-wrap">

          {mode === 'agent' && (
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={agentsLoading}
              className="text-sm border border-beacon-gray rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-beacon-primary-hover text-beacon-black max-w-xs disabled:opacity-50"
            >
              <option value="">Selecionar agente…</option>
              {activeAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {mode === 'broadcast' && (
            <>
              <select
                value={broadcastId}
                onChange={(e) => setBroadcastId(e.target.value)}
                disabled={broadcastsLoading}
                className="text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-1.5 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 text-white/85 max-w-xs disabled:opacity-50"
              >
                <option value="">Selecionar disparo…</option>
                {(broadcasts ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {infoLine && (
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <Info className="w-3 h-3" /> {infoLine}
                </span>
              )}
              {selectedBroadcast && !selectedBroadcast.agentId && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  ⚠ Este disparo não tem agente vinculado
                </span>
              )}
            </>
          )}

          {mode === 'vendedor' && (
            <>
              <select
                value={automationId}
                onChange={(e) => setAutomationId(e.target.value)}
                disabled={automationsLoading}
                className="text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-1.5 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 text-white/85 max-w-xs disabled:opacity-50"
              >
                <option value="">Selecionar campanha…</option>
                {(automations ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {infoLine && (
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <Info className="w-3 h-3" /> {infoLine}
                </span>
              )}
              {selectedAutomation && !selectedAutomation.linkedAgentId && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  ⚠ Esta campanha não tem agente vinculado
                </span>
              )}
              {selectedAutomation?.agentType === 'ATIVO' && (
                <span className="text-xs text-[#f06529] font-medium flex items-center gap-1 bg-beacon-primary/15 px-2 py-1 rounded-lg border border-beacon-primary/30">
                  ⚡ Simulando Agente ATIVO — contexto de disparo pré-carregado
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-beacon-app"
          >
            {/* Empty states */}
            {!hasSource && mode === 'agent' && (
              <EmptyState icon={Bot} title="Selecione um agente" subtitle="Escolha um agente ativo no seletor acima" />
            )}
            {!hasSource && mode === 'broadcast' && (
              <EmptyState icon={Megaphone} title="Selecione um disparo" subtitle="Escolha uma campanha para simular a resposta do lead" />
            )}
            {!hasSource && mode === 'vendedor' && (
              <EmptyState icon={Workflow} title="Selecione uma campanha" subtitle="Escolha uma campanha do Vendedor para simular o fluxo de resposta" />
            )}

            {hasSource && messages.length === 0 && !loading && (
              <EmptyState icon={MessageSquare} title="Sessão pronta" subtitle="Envie uma mensagem para iniciar a simulação" />
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-beacon-surface-2 border border-[rgba(255,255,255,0.08)] rounded-2xl rounded-bl-sm shadow-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[rgba(255,255,255,0.07)] bg-beacon-surface px-6 py-4 shrink-0">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !hasSource
                    ? 'Selecione uma fonte acima'
                    : mode === 'agent'
                      ? 'Digite uma mensagem… (Ctrl+Enter para enviar)'
                      : 'Simule a resposta do lead… (Ctrl+Enter para enviar)'
                }
                disabled={!hasSource || loading}
                rows={2}
                className={cn(
                  'flex-1 text-sm text-white/85 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 resize-none',
                  'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]',
                  'disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-white/25',
                )}
              />
              <Button
                variant="primary"
                size="md"
                onClick={handleSend}
                disabled={!input.trim() || !hasSource || loading}
                loading={loading}
                className="shrink-0 self-end"
              >
                <Send className="w-4 h-4" />
                Enviar
              </Button>
            </div>
            {hasSource && (
              <p className="text-[10px] text-white/25 mt-1.5">Ctrl+Enter para enviar</p>
            )}
          </div>
        </div>

        <MetadataPanel meta={lastMeta} />
      </div>
    </div>
  )
}
