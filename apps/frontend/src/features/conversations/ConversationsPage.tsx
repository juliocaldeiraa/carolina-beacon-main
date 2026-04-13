/**
 * ConversationsPage — Inbox unificado de conversas
 * Layout 2 colunas: lista de conversas | mensagens da conversa selecionada
 * Inclui painel de feedback para supervisão humana
 */

import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare, Search, Phone, Bot, RefreshCw,
  CheckCircle, XCircle, Clock, UserCheck, UserX,
  MessageCircle, Sparkles, Loader2, Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  useConversations, useConversation, useUpdateConversationStatus, useSetTakeover,
} from './hooks/useConversations'
import type { ConversationStatus } from '@/services/conversations'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConversationStatus, {
  label: string
  variant: 'active' | 'default' | 'draft' | 'error'
}> = {
  OPEN:        { label: 'Aberta',     variant: 'active' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'draft' },
  RESOLVED:    { label: 'Resolvida',  variant: 'default' },
  CLOSED:      { label: 'Fechada',    variant: 'default' },
}

// ─── Conversation item in list ─────────────────────────────────────────────────

function ConvListItem({
  contactName, contactPhone, status, lastMessageAt, messages, agentName, humanTakeover, selected, onClick,
}: {
  contactName?: string
  contactPhone?: string
  status: ConversationStatus
  lastMessageAt?: string
  messages?: { content: string; role: string; createdAt: string }[]
  agentName?: string
  humanTakeover?: boolean
  selected: boolean
  onClick: () => void
}) {
  const lastMsg = messages?.[0]
  const displayName = contactName ?? contactPhone ?? 'Desconhecido'

  const timeAgo = lastMessageAt ? (() => {
    const diff = Math.round((Date.now() - new Date(lastMessageAt).getTime()) / 60_000)
    if (diff < 1)   return 'agora'
    if (diff < 60)  return `${diff}m`
    if (diff < 1440) return `${Math.round(diff / 60)}h`
    return `${Math.round(diff / 1440)}d`
  })() : ''

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-[rgba(255,255,255,0.06)] transition-colors',
        selected ? 'bg-beacon-primary/5 border-l-2 border-l-beacon-primary' : 'hover:bg-white/5',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-white truncate flex items-center gap-1">
          {humanTakeover && <UserCheck className="w-3 h-3 text-amber-500 shrink-0" />}
          {displayName}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {timeAgo && <span className="text-xs text-white/35">{timeAgo}</span>}
          <Badge variant={STATUS_CONFIG[status].variant} className="text-[10px] px-1.5 py-0">
            {STATUS_CONFIG[status].label}
          </Badge>
        </div>
      </div>
      {lastMsg && (
        <p className="text-xs text-white/50 truncate">
          {lastMsg.role === 'ASSISTANT' ? '🤖 ' : ''}{lastMsg.content}
        </p>
      )}
      {agentName && (
        <p className="text-[10px] text-white/35 mt-0.5">{agentName}</p>
      )}
    </button>
  )
}

// ─── Message bubble with feedback support ─────────────────────────────────────

function MessageBubble({ role, content, createdAt, messageIndex, onFeedback, feedbackActive }: {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  createdAt: string
  messageIndex: number
  onFeedback?: (index: number) => void
  feedbackActive?: boolean
}) {
  const isAI = role === 'ASSISTANT'
  const isSystem = role === 'SYSTEM'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-white/40 bg-white/8 px-3 py-1 rounded-full">{content}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex group', isAI ? 'justify-start' : 'justify-end')}>
      <div className="flex flex-col gap-1 max-w-[70%]">
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm relative',
          isAI
            ? 'bg-beacon-surface-2 text-white/85 rounded-tl-sm'
            : 'bg-beacon-primary text-white rounded-tr-sm',
          isAI && feedbackActive && 'ring-2 ring-amber-400/50',
        )}>
          <p className="whitespace-pre-wrap">{content}</p>
          <p className={cn('text-[10px] mt-1', isAI ? 'text-white/40' : 'text-white/70')}>
            {new Date(createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {/* Feedback button — only for AI messages */}
        {isAI && onFeedback && (
          <button
            onClick={() => onFeedback(messageIndex)}
            className={cn(
              'self-start flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all',
              feedbackActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-white/25 hover:text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100',
            )}
          >
            <MessageCircle className="w-3 h-3" />
            Feedback
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Feedback input panel ─────────────────────────────────────────────────────

function FeedbackPanel({ agentId, conversationId, messageIndex, onClose, onSuccess }: {
  agentId: string
  conversationId: string
  messageIndex: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submitFeedback = useMutation({
    mutationFn: () => api.post(`/agents/${agentId}/feedbacks`, {
      conversationId,
      messageIndex,
      feedbackText: text,
    }),
    onSuccess: () => {
      setText('')
      onSuccess()
    },
  })

  return (
    <div className="px-5 py-3 border-t border-amber-500/20 bg-amber-500/5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-amber-400">Feedback na mensagem #{messageIndex + 1}</span>
        <button onClick={onClose} className="ml-auto text-xs text-white/30 hover:text-white/60">Cancelar</button>
      </div>
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="O que poderia ser melhor nessa resposta?"
          rows={2}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-amber-500/40"
        />
        <Button
          onClick={() => submitFeedback.mutate()}
          disabled={!text.trim() || submitFeedback.isPending}
          className="self-end bg-amber-500 hover:bg-amber-600 text-white"
          size="sm"
        >
          {submitFeedback.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-white/25 mt-1.5">
        A IA vai processar seu feedback e gerar uma regra de melhoria automaticamente.
      </p>
    </div>
  )
}

// ─── Right panel — conversation detail ────────────────────────────────────────

function ConversationDetail({ convId }: { convId: string }) {
  const { data: conv, isLoading } = useConversation(convId)
  const { mutate: updateStatus, isPending: updatingStatus } = useUpdateConversationStatus()
  const { mutate: setTakeover, isPending: updatingTakeover } = useSetTakeover()
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null)
  const qc = useQueryClient()

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-white/35 animate-spin" />
      </div>
    )
  }

  if (!conv) return null

  const status = conv.status as ConversationStatus

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {conv.contactName ?? conv.contactPhone ?? 'Desconhecido'}
          </h3>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/50">
            {conv.contactPhone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />{conv.contactPhone}
              </span>
            )}
            {conv.agent && (
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3" />{conv.agent.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={STATUS_CONFIG[status].variant}>
            {STATUS_CONFIG[status].label}
          </Badge>

          {/* Human Takeover toggle */}
          {(status === 'OPEN' || status === 'IN_PROGRESS') && (
            <Button
              size="sm"
              variant={conv.humanTakeover ? 'primary' : 'secondary'}
              loading={updatingTakeover}
              onClick={() => setTakeover({ id: convId, active: !conv.humanTakeover })}
              title={conv.humanTakeover ? 'Devolver para IA' : 'Assumir atendimento humano'}
              className={cn(conv.humanTakeover && 'bg-amber-500 hover:bg-amber-600 border-amber-500')}
            >
              {conv.humanTakeover
                ? <><UserX className="w-3.5 h-3.5" /> Devolver IA</>
                : <><UserCheck className="w-3.5 h-3.5" /> Humano</>
              }
            </Button>
          )}

          {(status === 'OPEN' || status === 'IN_PROGRESS') && (
            <Button
              size="sm"
              variant="secondary"
              loading={updatingStatus}
              onClick={() => updateStatus({ id: convId, status: 'RESOLVED' })}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Resolver
            </Button>
          )}
          {status !== 'CLOSED' && (
            <Button
              size="sm"
              variant="ghost"
              loading={updatingStatus}
              onClick={() => updateStatus({ id: convId, status: 'CLOSED' })}
              className="text-white/40 hover:text-white"
            >
              <XCircle className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {conv.messages && conv.messages.length > 0 ? (
          conv.messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'USER' | 'ASSISTANT' | 'SYSTEM'}
              content={msg.content}
              createdAt={msg.createdAt}
              messageIndex={idx}
              onFeedback={(i) => setFeedbackIndex(feedbackIndex === i ? null : i)}
              feedbackActive={feedbackIndex === idx}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageSquare className="w-8 h-8 text-white/25" />
            <p className="text-sm text-white/40">Nenhuma mensagem ainda</p>
          </div>
        )}
      </div>

      {/* Feedback panel */}
      {feedbackIndex !== null && conv.agent && (
        <FeedbackPanel
          agentId={conv.agent.id}
          conversationId={convId}
          messageIndex={feedbackIndex}
          onClose={() => setFeedbackIndex(null)}
          onSuccess={() => {
            setFeedbackIndex(null)
            qc.invalidateQueries({ queryKey: ['conversations'] })
          }}
        />
      )}

      {/* Footer info */}
      <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.07)] bg-white/4">
        <p className="text-xs text-white/40">
          <span className="font-medium text-white">{conv.turns}</span> turnos ·
          Iniciada em {new Date(conv.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {conv.agent && (
            <span className="ml-2 text-white/25">· Passe o mouse nas respostas da IA para deixar feedback</span>
          )}
        </p>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data, isLoading } = useConversations({ search: search || undefined, status: statusFilter || undefined })

  const conversations = data?.items ?? []

  return (
    <div className="flex h-[calc(100vh-88px)] -m-6 overflow-hidden">
      {/* Left column — list */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[rgba(255,255,255,0.07)] bg-beacon-surface">
        {/* Search + filter */}
        <div className="px-4 pt-4 pb-3 space-y-2 border-b border-[rgba(255,255,255,0.07)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou número..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-[rgba(255,255,255,0.08)] rounded-lg text-white/85 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 placeholder:text-white/25"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 bg-beacon-surface text-white/85 focus:outline-none focus:border-[#00b4d8]/60"
          >
            <option value="">Todas as conversas</option>
            <option value="OPEN">Abertas</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="RESOLVED">Resolvidas</option>
            <option value="CLOSED">Fechadas</option>
          </select>
        </div>

        {/* Count */}
        <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.06)]">
          <span className="text-xs text-white/40">
            {data?.total ?? 0} conversa{(data?.total ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/8 rounded animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-4">
              <Clock className="w-8 h-8 text-white/25" />
              <p className="text-sm text-white/40">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConvListItem
                key={conv.id}
                contactName={conv.contactName}
                contactPhone={conv.contactPhone}
                status={conv.status as ConversationStatus}
                lastMessageAt={conv.lastMessageAt}
                messages={conv.messages}
                agentName={conv.agent?.name}
                humanTakeover={conv.humanTakeover}
                selected={selectedId === conv.id}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right column — detail */}
      <div className="flex-1 bg-beacon-surface overflow-hidden">
        {selectedId ? (
          <ConversationDetail convId={selectedId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-white/8 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-white/35" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Selecione uma conversa</p>
              <p className="text-xs text-white/50 mt-1">
                Escolha uma conversa na lista para ver as mensagens
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
