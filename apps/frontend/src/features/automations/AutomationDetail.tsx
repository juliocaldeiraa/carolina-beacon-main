/**
 * AutomationDetail — Detalhe + edição de automação
 *
 * Layout 2 colunas:
 * - Esquerda: formulário de edição + delete
 * - Direita: painel de teste + métricas + logs
 */

import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm }     from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z }           from 'zod'
import {
  ArrowLeft, Send, MessageSquare, TrendingUp,
  Users, CheckCircle2, Trash2, PlusCircle,
  FlaskConical, Play, RotateCcw, Save, ChevronDown, ChevronUp,
  Loader2, AlertCircle, RefreshCw, AlertTriangle, Power, Clock, ShieldCheck,
  Activity, Ban, X, Search, UserRound,
} from 'lucide-react'
import { Button }    from '@/components/ui/Button'
import { Badge }     from '@/components/ui/Badge'
import { ChannelConflictModal } from '@/components/ui/ChannelConflictModal'
import { useChannels, useCheckConflicts } from '@/features/channels/hooks/useChannels'
import { useAgents }   from '@/features/agents/hooks/useAgents'
import {
  useAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  useTestFire,
  useTestClear,
  useTestStatus,
  useDispatchLogs,
  useLeadStatuses,
} from './hooks/useAutomations'
import { useLeadFieldDefs } from '@/features/vendedor/hooks/useLeads'
import { cn } from '@/lib/utils'
import type { TestFireResult, PhoneTestStatus, TestLead, FollowupStep, DispatchLog } from '@/types/automation'
import type { ChannelConflictItem } from '@/types/channel'

// ─── Status Tag Select ─────────────────────────────────────────────────────────

const TAG_VARIANTS = {
  cyan: {
    focus:   'border-[#00b4d8]/60 shadow-[0_0_0_3px_rgba(0,180,216,0.10)]',
    tag:     'bg-[#00b4d8]/15 text-[#38bdf8] border border-[#00b4d8]/30',
    tagBtn:  'text-[#38bdf8]/60 hover:text-[#38bdf8]',
    dot:     'bg-[#00b4d8]/50',
    hover:   'hover:bg-[#00b4d8]/10 hover:text-[#38bdf8]',
    add:     'text-[#00b4d8]',
  },
  orange: {
    focus:   'border-orange-500/60 shadow-[0_0_0_3px_rgba(249,115,22,0.12)]',
    tag:     'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    tagBtn:  'text-orange-300/60 hover:text-orange-200',
    dot:     'bg-orange-500/50',
    hover:   'hover:bg-orange-500/10 hover:text-orange-200',
    add:     'text-orange-400',
  },
} as const

// ─── Template Token Blocks ────────────────────────────────────────────────────

const BUILTIN_TOKENS = [
  { key: 'nome', label: 'Nome' },
  { key: 'status', label: 'Status' },
  { key: 'campanha', label: 'Campanha' },
  { key: 'origem', label: 'Origem' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'lista', label: 'Lista' },
]

function TemplateTokens({ onInsert }: { onInsert: (token: string) => void }) {
  const { data: fieldDefs = [] } = useLeadFieldDefs()

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {BUILTIN_TOKENS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onInsert(`{${t.key}}`)}
          title={`Inserir {${t.key}}`}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00b4d8]/10 text-[#38bdf8] border border-[#00b4d8]/20 hover:bg-[#00b4d8]/20 transition-colors"
        >
          {`{${t.key}}`}
        </button>
      ))}
      {fieldDefs.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onInsert(`{${f.key}}`)}
          title={`Campo custom: ${f.label}`}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
        >
          {`{${f.key}}`}
        </button>
      ))}
    </div>
  )
}

function StatusTagSelect({
  tags,
  onChange,
  suggestions,
  placeholder = 'Pesquisar ou adicionar status…',
  variant = 'cyan',
}: {
  tags:         string[]
  onChange:     (tags: string[]) => void
  suggestions:  string[]
  placeholder?: string
  variant?:     keyof typeof TAG_VARIANTS
}) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const v        = TAG_VARIANTS[variant]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Mostra sugestões mesmo sem digitar (ao focar)
  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(query.toLowerCase()) && !tags.includes(s)
  )
  const showCustom = query.trim().length > 0 && !tags.includes(query.trim()) && !suggestions.includes(query.trim())
  const hasDropdown = open && (filtered.length > 0 || showCustom)

  function addTag(value: string) {
    const v = value.trim()
    if (!v || tags.includes(v)) return
    onChange([...tags, v])
    setQuery('')
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) addTag(filtered[0])
      else if (query.trim()) addTag(query.trim())
    } else if (e.key === 'Backspace' && query === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        className={cn(
          'min-h-[42px] w-full flex flex-wrap items-center gap-1.5 px-3 py-2 cursor-text',
          'border rounded-lg bg-[#0d1117] transition-all',
          open ? v.focus : 'border-[rgba(255,255,255,0.10)] hover:border-[rgba(255,255,255,0.20)]',
        )}
      >
        {tags.map((tag) => (
          <span key={tag} className={cn('inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium', v.tag)}>
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
              className={cn('transition-colors rounded', v.tagBtn)}
              aria-label={`Remover ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <Search className="w-3.5 h-3.5 text-white/25 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 bg-transparent text-sm text-white/85 outline-none placeholder:text-white/25"
          />
        </div>
      </div>

      {hasDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0d1117] shadow-2xl overflow-hidden">
          <div className="py-1 max-h-48 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-white/75 transition-colors text-left', v.hover)}
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', v.dot)} />
                {s}
              </button>
            ))}
            {showCustom && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(query.trim()) }}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-white/75 transition-colors text-left border-t border-[rgba(255,255,255,0.06)]', v.hover)}
              >
                <span className={cn('font-medium text-xs', v.add)}>+ Adicionar</span>
                <span className="text-white/85 font-medium">"{query.trim()}"</span>
              </button>
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-[rgba(255,255,255,0.06)] bg-white/3">
            <p className="text-[10px] text-white/35">
              Enter para selecionar · Backspace para remover · Esc para fechar
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name:                    z.string().min(3),
  channelId:               z.string().optional(),
  minHoursAfterCapture:    z.coerce.number().min(0),
  startHour:               z.coerce.number().min(0).max(23),
  endHour:                 z.coerce.number().min(1).max(24),
  batchIntervalMinMinutes: z.coerce.number().min(1),
  batchIntervalMaxMinutes: z.coerce.number().min(1),
  batchSizeMin:            z.coerce.number().min(1),
  batchSizeMax:            z.coerce.number().min(1),
  linkedAgentId:           z.string().optional(),
  aiChannelId:             z.string().optional(),
  aiModel:                 z.string().optional(),
  debounceMs:              z.coerce.number().min(500).max(15000).optional(),
  sendDelayMs:             z.coerce.number().min(0).max(30000).optional(),
  fragmentDelayMs:         z.coerce.number().min(300).max(5000).optional(),
  dispatchDelayMinSec:     z.coerce.number().min(5).max(600).optional(),
  dispatchDelayMaxSec:     z.coerce.number().min(5).max(600).optional(),
})
type FormValues = z.infer<typeof schema>

const AVAILABLE_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Rápido)' },
  { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Equilibrado)' },
  { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6 (Máximo)' },
  { value: 'gpt-4o-mini',               label: 'GPT-4o Mini' },
  { value: 'gpt-4o',                    label: 'GPT-4o' },
]

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
}) {
  return (
    <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-card p-4">
      <div className="flex items-center gap-2 text-white/50 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Reason badge ──────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  success:                    'Sucesso',
  out_of_hours:               'Fora do horário',
  batch_interval_not_reached: 'Intervalo não atingido',
  no_leads:                   'Sem leads',
  no_channel:                 'Sem canal disponível',
}

// ─── Ingestion Log Pill ────────────────────────────────────────────────────────

const LOG_STATUS_STYLES: Record<string, string> = {
  completed:      'bg-green-500/15 text-green-400 border-green-500/25',
  processing:     'bg-blue-500/15 text-blue-400 border-blue-500/25',
  received:       'bg-white/8 text-white/50 border-white/10',
  no_agent:       'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  ai_error:       'bg-red-500/15 text-red-400 border-red-500/25',
  parse_error:    'bg-red-500/15 text-red-400 border-red-500/25',
  send_error:     'bg-red-500/15 text-red-400 border-red-500/25',
  human_takeover: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  automation:     'bg-amber-500/15 text-amber-400 border-amber-500/25',
}

function IngestionLogPill({ log }: { log: { status: string; model: string | null; latencyMs: number | null; errorMsg: string | null; createdAt: string } }) {
  const style = LOG_STATUS_STYLES[log.status] ?? 'bg-white/8 text-white/40 border-white/10'
  const time  = new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium', style)} title={log.errorMsg ?? undefined}>
      <span>{log.status}</span>
      {log.model && <span className="opacity-60">· {log.model.split('-').slice(0,2).join('-')}</span>}
      {log.latencyMs != null && <span className="opacity-60">· {(log.latencyMs / 1000).toFixed(1)}s</span>}
      <span className="opacity-40">· {time}</span>
      {log.errorMsg && <AlertCircle className="w-3 h-3 text-red-400" />}
    </div>
  )
}

// ─── Phone Monitor Card ────────────────────────────────────────────────────────

function PhoneMonitorCard({ result, statusData }: { result: TestFireResult; statusData: PhoneTestStatus | undefined }) {
  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      result.ok ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5',
    )}>
      {/* Phone header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold', result.ok ? 'text-green-300' : 'text-red-300')}>
            {result.ok ? '✓' : '✗'} {result.phone}
          </span>
          {result.variantIndex !== undefined && (
            <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded">
              Variação {result.variantIndex + 1}
            </span>
          )}
          {result.firedAt && (
            <span className="text-[10px] text-white/30">
              {new Date(result.firedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {statusData && (
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded font-medium',
            statusData.leadStatus === 'teste' ? 'text-amber-400 bg-amber-500/15' : 'text-white/40 bg-white/5',
          )}>
            {statusData.leadStatus ?? '—'}
          </span>
        )}
      </div>

      {/* Mensagem enviada */}
      {result.ok && (
        <div className="px-3 py-2 border-b border-white/5">
          <p className="text-[10px] text-white/30 uppercase font-semibold mb-1">Mensagem enviada</p>
          <div className="flex justify-end">
            <div className="max-w-[80%] bg-green-600/20 border border-green-500/20 rounded-lg rounded-tr-none px-3 py-2">
              <p className="text-[11px] text-green-200/80 whitespace-pre-wrap">{result.message}</p>
            </div>
          </div>
        </div>
      )}

      {result.error && (
        <div className="px-3 py-2 border-b border-white/5">
          <p className="text-[10px] text-red-400/60 uppercase font-semibold mb-1">Erro de disparo</p>
          <p className="text-[11px] text-red-300/70">{result.error}</p>
        </div>
      )}

      {/* Conversa */}
      {statusData && statusData.conversation.length > 0 && (
        <div className="px-3 py-2 border-b border-white/5 space-y-1.5">
          <p className="text-[10px] text-white/30 uppercase font-semibold mb-2">Conversa</p>
          {statusData.conversation.map((turn, i) => (
            <div key={i} className={cn('flex', turn.role === 'assistant' ? 'justify-start' : 'justify-end')}>
              <div className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-[11px]',
                turn.role === 'assistant'
                  ? 'bg-blue-600/15 border border-blue-500/20 text-blue-200/80 rounded-tl-none'
                  : 'bg-white/8 border border-white/10 text-white/60 rounded-tr-none',
              )}>
                <p className="whitespace-pre-wrap">{turn.content}</p>
                {turn.timestamp && (
                  <p className="text-[9px] opacity-40 mt-0.5 text-right">
                    {new Date(turn.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ingestion logs */}
      {statusData && statusData.ingestionLogs.length > 0 && (
        <div className="px-3 py-2">
          <p className="text-[10px] text-white/30 uppercase font-semibold mb-1.5">Pipeline</p>
          <div className="flex flex-wrap gap-1.5">
            {statusData.ingestionLogs.map((log) => (
              <IngestionLogPill key={log.id} log={log} />
            ))}
          </div>
          {statusData.ingestionLogs.some((l) => l.errorMsg) && (
            <div className="mt-2 space-y-1">
              {statusData.ingestionLogs.filter((l) => l.errorMsg).map((l) => (
                <p key={l.id} className="text-[10px] text-red-400/70 bg-red-500/8 rounded px-2 py-1">
                  {l.errorMsg}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state for conversation */}
      {statusData && statusData.conversation.length === 0 && statusData.ingestionLogs.length === 0 && (
        <div className="px-3 py-3 text-center text-[10px] text-white/25 flex items-center justify-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Aguardando resposta…
        </div>
      )}
    </div>
  )
}

// ─── Dispatch Feed ─────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)}d`
}

function DispatchFeed({ logs, isActive }: { logs: DispatchLog[]; isActive: boolean }) {
  return (
    <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-card">
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-semibold text-white">Feed de Disparos</h3>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            ao vivo
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="py-8 text-center space-y-1.5">
          {isActive ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white/30 mx-auto" />
              <p className="text-xs text-white/35">Aguardando próximo ciclo de disparo…</p>
            </>
          ) : (
            <p className="text-xs text-white/35">Ative a automação para ver disparos em tempo real.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[rgba(255,255,255,0.05)] max-h-[420px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-3 flex gap-3 items-start">
              {/* Status badge */}
              <span className={cn(
                'mt-0.5 shrink-0 w-2 h-2 rounded-full',
                log.status === 'sent'    ? 'bg-green-400' :
                log.status === 'error'   ? 'bg-red-400' :
                                           'bg-white/25',
              )} />

              <div className="flex-1 min-w-0 space-y-0.5">
                {/* Phone + name */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'text-xs font-medium',
                    log.status === 'sent'  ? 'text-white'      :
                    log.status === 'error' ? 'text-red-300'    :
                                             'text-white/40',
                  )}>
                    {log.phone}
                  </span>
                  {log.name && (
                    <span className="text-[11px] text-white/40">· {log.name}</span>
                  )}
                  <span className={cn(
                    'ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                    log.status === 'sent'    ? 'bg-green-500/15 text-green-400' :
                    log.status === 'error'   ? 'bg-red-500/15 text-red-400' :
                                               'bg-white/8 text-white/40',
                  )}>
                    {log.status === 'sent' ? 'enviado' : log.status === 'error' ? 'erro' : 'pulado'}
                  </span>
                </div>

                {/* Message preview or error */}
                {log.status === 'sent' && log.message && (
                  <p className="text-[11px] text-white/50 truncate">
                    "{log.message.length > 80 ? log.message.slice(0, 80) + '…' : log.message}"
                  </p>
                )}
                {log.status === 'error' && log.errorMsg && (
                  <p className="text-[11px] text-red-400/70">
                    {log.errorMsg.length > 100 ? log.errorMsg.slice(0, 100) + '…' : log.errorMsg}
                  </p>
                )}
                {log.status === 'skipped' && (
                  <p className="text-[11px] text-white/30">Número duplicado na fila</p>
                )}

                {/* Meta: channel + step + time */}
                <div className="flex items-center gap-2 text-[10px] text-white/25">
                  {log.channelName && <span>Canal: {log.channelName}</span>}
                  <span>·</span>
                  <span>{log.step === 0 ? 'Etapa inicial' : `Follow-up ${log.step}`}</span>
                  <span>·</span>
                  <span>{timeAgo(log.executedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Test Panel ────────────────────────────────────────────────────────────────

function TestPanel({
  automationId,
  channelId,
  templates,
  savedPhones,
  onSavePhones,
}: {
  automationId:  string
  channelId:     string | null | undefined
  templates:     string[]
  savedPhones:   string[]
  onSavePhones:  (phones: string[]) => void
}) {
  const [open, setOpen]                 = useState(false)
  const [testLeads, setTestLeads]       = useState<TestLead[]>(
    savedPhones.length > 0 ? savedPhones.map((p) => ({ phone: p, name: '' })) : [{ phone: '', name: '' }]
  )
  const [templateIdx, setTemplateIdx]   = useState<number | undefined>(undefined)
  const [lastResults, setLastResults]   = useState<TestFireResult[] | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [conflictModal, setConflictModal] = useState<{
    open: boolean; conflicts: ChannelConflictItem[]; onConfirm: () => void
  }>({ open: false, conflicts: [], onConfirm: () => {} })

  const { mutate: fire,  isPending: firing  } = useTestFire(automationId)
  const { mutate: clear, isPending: clearing } = useTestClear(automationId)
  const { mutateAsync: checkConflicts, isPending: checkingConflicts } = useCheckConflicts()

  const validLeads    = testLeads.filter((l) => l.phone.replace(/\D/g, '').trim().length > 0)
  const parsedPhones  = validLeads.map((l) => l.phone.replace(/\D/g, '').trim())

  const monitorEnabled = lastResults !== null && parsedPhones.length > 0
  const { data: statusData, dataUpdatedAt } = useTestStatus(automationId, parsedPhones, monitorEnabled)

  useEffect(() => {
    if (savedPhones.length > 0) {
      setTestLeads((prev) => {
        // merge: mantém nomes digitados, só atualiza phones se mudaram
        const merged = savedPhones.map((phone, i) => ({
          phone,
          name: prev[i]?.name ?? '',
        }))
        return merged
      })
    }
  }, [savedPhones.join(',')])

  const activeTemplates = templates.filter((t) => t.trim().length > 0)

  // Preview usa o primeiro nome válido digitado como token de simulação
  const previewNameToken = testLeads.find((l) => l.name.trim())?.name.trim() || '[nome]'
  const previewMessage = templateIdx !== undefined && activeTemplates[templateIdx]
    ? activeTemplates[templateIdx].replace(/\{nome\}/g, previewNameToken)
    : activeTemplates.length > 0
      ? activeTemplates[0].replace(/\{nome\}/g, previewNameToken) + (activeTemplates.length > 1 ? '  ← (variação aleatória)' : '')
      : '—'

  function addLead() {
    if (testLeads.length < 5) setTestLeads((l) => [...l, { phone: '', name: '' }])
  }

  function removeLead(i: number) {
    setTestLeads((l) => l.length > 1 ? l.filter((_, idx) => idx !== i) : [{ phone: '', name: '' }])
  }

  function updateLead(i: number, field: 'phone' | 'name', value: string) {
    setTestLeads((l) => l.map((lead, idx) => idx === i ? { ...lead, [field]: value } : lead))
  }

  function doFire() {
    fire(
      { leads: validLeads.map((l) => ({ phone: l.phone.replace(/\D/g, '').trim(), name: l.name.trim() || undefined as any })), templateIndex: templateIdx },
      {
        onSuccess: ({ results }) => setLastResults(
          results.map((r) => ({ ...r, variantIndex: templateIdx, firedAt: new Date().toISOString() }))
        ),
      },
    )
  }

  async function handleFire() {
    if (!channelId) { doFire(); return }
    const { conflicts } = await checkConflicts([channelId])
    if (conflicts.length === 0) { doFire(); return }
    setConflictModal({ open: true, conflicts, onConfirm: doFire })
  }

  function handleClear() {
    clear(
      { phones: parsedPhones },
      { onSuccess: () => { setLastResults(null); setConfirmClear(false) } },
    )
  }

  return (
    <>
    <ChannelConflictModal
      open={conflictModal.open}
      conflicts={conflictModal.conflicts}
      actionLabel="Disparar Teste Mesmo Assim"
      onConfirm={conflictModal.onConfirm}
      onCancel={() => setConflictModal((s) => ({ ...s, open: false }))}
    />
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-500/8 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-300">Teste da Campanha</span>
          <span className="text-[10px] text-amber-500/70 bg-amber-500/15 px-1.5 py-0.5 rounded">
            não afeta métricas reais
          </span>
          {monitorEnabled && (
            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
              ao vivo
            </span>
          )}
        </div>
        {open
          ? <ChevronUp   className="w-4 h-4 text-amber-400/60" />
          : <ChevronDown className="w-4 h-4 text-amber-400/60" />
        }
      </button>

      {open && (
        <div className="border-t border-amber-500/15">

          {/* ── Phase 1: Config ── */}
          <div className="px-4 py-4 space-y-4">
            {/* Tabela Número + Nome */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-amber-300/80">
                  Leads de teste
                  <span className="ml-1 font-normal text-amber-500/60">(máx. 5)</span>
                </label>
                <button
                  type="button"
                  onClick={() => onSavePhones(parsedPhones)}
                  disabled={parsedPhones.length === 0}
                  className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-30"
                >
                  <Save className="w-3 h-3" />
                  Salvar na campanha
                </button>
              </div>

              {/* Cabeçalho */}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-1 px-1">
                <span className="text-[10px] font-semibold text-amber-500/50 uppercase">Número WhatsApp</span>
                <span className="text-[10px] font-semibold text-amber-500/50 uppercase">Nome</span>
                <span className="w-5" />
              </div>

              {/* Linhas */}
              <div className="space-y-1.5">
                {testLeads.map((lead, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input
                      type="text"
                      value={lead.phone}
                      onChange={(e) => updateLead(i, 'phone', e.target.value)}
                      placeholder="5511999990001"
                      className={cn(
                        'text-xs border border-amber-500/20 rounded px-2.5 py-1.5',
                        'bg-amber-500/5 text-amber-100/80 placeholder:text-amber-500/25',
                        'focus:outline-none focus:border-amber-500/50',
                      )}
                    />
                    <input
                      type="text"
                      value={lead.name}
                      onChange={(e) => updateLead(i, 'name', e.target.value)}
                      placeholder="João Silva"
                      className={cn(
                        'text-xs border border-amber-500/20 rounded px-2.5 py-1.5',
                        'bg-amber-500/5 text-amber-100/80 placeholder:text-amber-500/25',
                        'focus:outline-none focus:border-amber-500/50',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => removeLead(i)}
                      className="w-5 h-5 flex items-center justify-center text-white/25 hover:text-red-400 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Adicionar linha */}
              {testLeads.length < 5 && (
                <button
                  type="button"
                  onClick={addLead}
                  className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-500/60 hover:text-amber-400 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Adicionar lead
                </button>
              )}
            </div>

            {/* Variações */}
            <div>
              <p className="text-xs font-medium text-amber-300/80 mb-2">Variação para testar</p>
              <div className="flex flex-wrap gap-2">
                {activeTemplates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTemplateIdx(undefined)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                      templateIdx === undefined
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:border-amber-500/30',
                    )}
                  >
                    Aleatória
                  </button>
                )}
                {activeTemplates.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTemplateIdx(i)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                      templateIdx === i || (activeTemplates.length === 1 && templateIdx === undefined)
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                        : 'bg-white/5 text-white/50 border border-white/10 hover:border-amber-500/30',
                    )}
                  >
                    Variação {i + 1}
                    {tpl.length > 0 && (
                      <span className="ml-1 text-[9px] opacity-50">
                        {tpl.substring(0, 20)}{tpl.length > 20 ? '…' : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Preview da variação selecionada */}
              <div className="mt-2 rounded-lg bg-black/20 border border-amber-500/15 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-amber-500/60 uppercase mb-1">Preview</p>
                <p className="text-xs text-amber-100/70 whitespace-pre-wrap">{previewMessage}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={validLeads.length === 0}
                  className="flex items-center gap-1.5 text-xs text-amber-500/70 hover:text-amber-400 transition-colors disabled:opacity-30"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Resetar histórico
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-400">Confirmar reset?</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={clearing}
                    className="text-[11px] text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                  >
                    {clearing ? 'Limpando…' : 'Sim'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="text-[11px] text-white/40 hover:text-white/70"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleFire}
                disabled={firing || checkingConflicts || validLeads.length === 0}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                  'hover:bg-amber-500/30 hover:border-amber-500/50',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {(firing || checkingConflicts)
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Play className="w-3.5 h-3.5" />
                }
                {checkingConflicts ? 'Verificando…' : firing ? 'Disparando…' : 'Disparar Teste'}
              </button>
            </div>
          </div>

          {/* ── Phase 2 + 3: Monitor ── */}
          {lastResults && (
            <div className="border-t border-amber-500/10 px-4 py-4 space-y-3">
              {/* Métricas de disparo */}
              {(() => {
                const total   = lastResults.length
                const success = lastResults.filter((r) => r.ok).length
                const failed  = total - success
                // Derived from live statusData (conversations + messages)
                const enviados  = statusData?.phones.filter((p) => p.conversation.some((m) => m.role === 'assistant')).length ?? 0
                const respostas = statusData?.phones.filter((p) => p.conversation.some((m) => m.role === 'user')).length ?? 0
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-[10px] font-semibold text-amber-500/60 uppercase">Monitor de Teste</p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-white/40">{total} disparado{total > 1 ? 's' : ''}</span>
                        <span className="text-green-400 font-medium">{success} ✓ enviado{success !== 1 ? 's' : ''}</span>
                        {failed > 0 && <span className="text-red-400 font-medium">{failed} ✗</span>}
                      </div>
                      {statusData && (
                        <div className="flex items-center gap-2 text-[11px] border-l border-white/10 pl-2">
                          <span className="text-blue-300/80">{enviados} agente respondeu</span>
                          <span className="text-purple-300/80">{respostas} lead respondeu</span>
                        </div>
                      )}
                    </div>
                    {dataUpdatedAt > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-white/30">
                        <RefreshCw className="w-2.5 h-2.5" />
                        {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </div>
                )
              })()}
              {lastResults.map((result) => {
                const phoneStatus = statusData?.phones.find((p) => p.phone === result.phone)
                return (
                  <PhoneMonitorCard
                    key={result.phone}
                    result={result}
                    statusData={phoneStatus}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function AutomationDetail() {
  const { id }         = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const { data, isLoading }                         = useAutomation(id ?? '')
  const { data: channels = [] }                     = useChannels()
  const { data: agents = [] }                       = useAgents()
  const { mutate: update, isPending }               = useUpdateAutomation()
  const { mutate: remove, isPending: deleting }     = useDeleteAutomation()
  const { mutateAsync: checkConflicts }             = useCheckConflicts()
  const { data: dispatchLogs = [] }                 = useDispatchLogs(id ?? '', data?.status === 'ACTIVE')

  const [templates,             setTemplates]             = useState<string[]>([''])
  const [followupSteps,         setFollowupSteps]         = useState<FollowupStep[]>([])
  const [fallbackChannelIds,    setFallbackChannelIds]    = useState<string[]>([])
  const [filterStatusTags,    setFilterStatusTags]    = useState<string[]>([])
  const [useExclusionList,    setUseExclusionList]    = useState(false)
  const [exclusionFilterTags, setExclusionFilterTags] = useState<string[]>([])
  const [followupEnabled,      setFollowupEnabled]      = useState(true)
  const [humanHandoffEnabled,  setHumanHandoffEnabled]  = useState(false)
  const [humanHandoffPhone,    setHumanHandoffPhone]    = useState('')
  const [humanHandoffMessage,  setHumanHandoffMessage]  = useState('')
  const { data: leadStatuses = [] } = useLeadStatuses()

  // Conflito de canal: inline warnings por campo + modal de ativação
  const [channelWarning,   setChannelWarning]   = useState<ChannelConflictItem[]>([])
  const [aiChanWarning,    setAiChanWarning]    = useState<ChannelConflictItem[]>([])
  const [activateModal, setActivateModal] = useState<{
    open: boolean; conflicts: ChannelConflictItem[]; pendingPayload: Parameters<typeof update>[0] | null
  }>({ open: false, conflicts: [], pendingPayload: null })

  async function onChannelPickChange(value: string, field: 'primary' | 'ai') {
    const setter = field === 'primary' ? setChannelWarning : setAiChanWarning
    if (!value) { setter([]); return }
    const { conflicts } = await checkConflicts([value])
    setter(conflicts)
  }

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data) {
      reset({
        name:                    data.name,
        channelId:               data.channelId ?? '',
        minHoursAfterCapture:    data.minHoursAfterCapture,
        startHour:               data.startHour,
        endHour:                 data.endHour,
        batchIntervalMinMinutes: data.batchIntervalMinMinutes ?? data.batchIntervalHours * 60,
        batchIntervalMaxMinutes: data.batchIntervalMaxMinutes ?? data.batchIntervalHours * 60 + 15,
        batchSizeMin:            data.batchSizeMin ?? data.batchSize,
        batchSizeMax:            data.batchSizeMax ?? data.batchSize,
        linkedAgentId:           data.linkedAgentId ?? '',
        aiChannelId:             data.aiChannelId   ?? '',
        aiModel:                 data.aiModel       ?? '',
        debounceMs:              data.debounceMs    ?? undefined,
        sendDelayMs:             data.sendDelayMs   ?? undefined,
        fragmentDelayMs:         data.fragmentDelayMs ?? undefined,
        dispatchDelayMinSec:     data.dispatchDelayMinMs ? Math.round(data.dispatchDelayMinMs / 1000) : undefined,
        dispatchDelayMaxSec:     data.dispatchDelayMaxMs ? Math.round(data.dispatchDelayMaxMs / 1000) : undefined,
      })
      const tpls = data.messageTemplates.length > 0
        ? data.messageTemplates
        : (data.messageTemplate ? [data.messageTemplate] : [''])
      setTemplates(tpls)
      setFollowupSteps(data.followupSteps ?? [])
      setFallbackChannelIds(data.fallbackChannelIds ?? [])
      setFilterStatusTags(
        data.filterStatus
          ? data.filterStatus.split(',').map((s) => s.trim()).filter(Boolean)
          : []
      )
      setUseExclusionList(data.useExclusionList ?? false)
      setExclusionFilterTags(
        data.exclusionFilterStatus
          ? data.exclusionFilterStatus.split(',').map((s) => s.trim()).filter(Boolean)
          : []
      )
      setFollowupEnabled(data.followupEnabled ?? true)
      setHumanHandoffEnabled(data.humanHandoffEnabled ?? false)
      setHumanHandoffPhone(data.humanHandoffPhone ?? '')
      setHumanHandoffMessage(data.humanHandoffMessage ?? '')
    }
  }, [data, reset])

  async function onSubmit(values: FormValues) {
    if (!id) return
    const validTemplates = templates.filter((t) => t.trim().length > 0)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dispatchDelayMinSec, dispatchDelayMaxSec, ...restValues } = values
    const payload = {
      ...restValues,
      channelId:        values.channelId     || undefined,
      linkedAgentId:    values.linkedAgentId  || undefined,
      aiChannelId:      values.aiChannelId    || undefined,
      aiModel:          values.aiModel        || undefined,
      filterStatus:          filterStatusTags.join(',') || data?.filterStatus || '',
      messageTemplates:      validTemplates,
      followupSteps:         followupSteps,
      fallbackChannelIds:    fallbackChannelIds,
      useExclusionList:      useExclusionList,
      exclusionFilterStatus: exclusionFilterTags.length > 0 ? exclusionFilterTags.join(',') : null,
      followupEnabled:       followupEnabled,
      humanHandoffEnabled:   humanHandoffEnabled,
      humanHandoffPhone:     humanHandoffPhone.trim()    || null,
      humanHandoffMessage:   humanHandoffMessage.trim()  || null,
      debounceMs:         values.debounceMs     ?? null,
      sendDelayMs:        values.sendDelayMs    ?? null,
      fragmentDelayMs:    values.fragmentDelayMs ?? null,
      dispatchDelayMinMs: values.dispatchDelayMinSec ? values.dispatchDelayMinSec * 1000 : null,
      dispatchDelayMaxMs: values.dispatchDelayMaxSec ? values.dispatchDelayMaxSec * 1000 : null,
    }

    // Se está ativando a campanha, verifica conflitos de canal primeiro
    const isActivating = data?.status !== 'ACTIVE' && (values as any).status === 'ACTIVE'
    if (isActivating) {
      const ids = [values.channelId, values.aiChannelId].filter(Boolean) as string[]
      if (ids.length) {
        const { conflicts } = await checkConflicts(ids)
        if (conflicts.length > 0) {
          setActivateModal({ open: true, conflicts, pendingPayload: { id, payload } })
          return
        }
      }
    }

    update({ id, payload })
  }

  async function handleActivateToggle() {
    if (!id || !data) return
    const newStatus = data.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    if (newStatus === 'ACTIVE') {
      const ids = [data.channelId, data.primaryChannelId, data.aiChannelId].filter(Boolean) as string[]
      if (ids.length) {
        const { conflicts } = await checkConflicts(ids)
        if (conflicts.length > 0) {
          setActivateModal({
            open: true,
            conflicts,
            pendingPayload: { id, payload: { status: newStatus } },
          })
          return
        }
      }
    }

    update({ id, payload: { status: newStatus } })
  }

  function handleDelete() {
    if (!id || !window.confirm('Remover esta automação?')) return
    remove(id, { onSuccess: () => navigate('/vendedor') })
  }

  function addTemplate() {
    if (templates.length < 4) setTemplates((t) => [...t, ''])
  }

  function removeTemplate(i: number) {
    setTemplates((t) => t.filter((_, idx) => idx !== i))
  }

  function updateTemplate(i: number, value: string) {
    setTemplates((t) => t.map((v, idx) => (idx === i ? value : v)))
  }

  // ── Follow-up steps helpers ──────────────────────────────────────────────────
  function addFollowupStep() {
    setFollowupSteps((s) => [...s, { afterHours: 24, templates: [''] }])
  }
  function removeFollowupStep(i: number) {
    setFollowupSteps((s) => s.filter((_, idx) => idx !== i))
  }
  function updateFollowupStepHours(i: number, hours: number) {
    setFollowupSteps((s) => s.map((step, idx) => idx === i ? { ...step, afterHours: hours } : step))
  }
  function addFollowupTemplate(stepIdx: number) {
    setFollowupSteps((s) => s.map((step, idx) =>
      idx === stepIdx ? { ...step, templates: [...step.templates, ''] } : step
    ))
  }
  function removeFollowupTemplate(stepIdx: number, tplIdx: number) {
    setFollowupSteps((s) => s.map((step, idx) =>
      idx === stepIdx ? { ...step, templates: step.templates.filter((_, ti) => ti !== tplIdx) } : step
    ))
  }
  function updateFollowupTemplate(stepIdx: number, tplIdx: number, value: string) {
    setFollowupSteps((s) => s.map((step, idx) =>
      idx === stepIdx ? { ...step, templates: step.templates.map((t, ti) => ti === tplIdx ? value : t) } : step
    ))
  }

  function handleSaveTestPhones(phones: string[]) {
    if (!id) return
    update({ id, payload: { testPhones: phones } })
  }

  const allChannelsSorted = [
    ...channels.filter((c) => c.status === 'CONNECTED'),
    ...channels.filter((c) => c.status !== 'CONNECTED'),
  ]

  const labelClass = 'block text-xs font-medium text-white/70 mb-1'
  const inputClass = cn(
    'w-full text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 bg-beacon-surface text-white/85',
    'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]',
    'placeholder:text-white/25',
  )
  const errorClass = 'text-xs text-red-500 mt-1'

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-white/8 rounded animate-pulse" />
        <div className="h-64 w-full bg-white/8 rounded animate-pulse" />
      </div>
    )
  }

  const stats = data.stats
  const logs  = data.logs ?? []

  return (
    <>
    {/* Modal de conflito ao ativar campanha */}
    <ChannelConflictModal
      open={activateModal.open}
      conflicts={activateModal.conflicts}
      actionLabel="Ativar Campanha Mesmo Assim"
      onConfirm={() => {
        if (activateModal.pendingPayload) update(activateModal.pendingPayload)
      }}
      onCancel={() => setActivateModal((s) => ({ ...s, open: false }))}
    />

    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/vendedor')}
        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Campanhas
      </button>

      {/* Title + status */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-white">{data.name}</h1>
        <Badge variant={data.status === 'ACTIVE' ? 'active' : 'draft'}>
          {data.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Left: Edit form ─────────────────────────────────── */}
        <div className="space-y-6">
          <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-card p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Configurações</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Nome */}
              <div>
                <label htmlFor="det-name" className={labelClass}>Nome *</label>
                <input id="det-name" {...register('name')} className={inputClass} />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>

              {/* Canal */}
              <div>
                <label htmlFor="det-channel" className={labelClass}>Canal WhatsApp</label>
                <select
                  id="det-channel"
                  {...register('channelId')}
                  onChange={(e) => { register('channelId').onChange(e); onChannelPickChange(e.target.value, 'primary') }}
                  className={inputClass}
                >
                  <option value="">Sem canal (simulação)</option>
                  {allChannelsSorted.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}{ch.status !== 'CONNECTED' ? ` (${ch.status === 'DISCONNECTED' ? 'desconectado' : 'offline'})` : ''}
                    </option>
                  ))}
                </select>
                {channelWarning.length > 0 && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {channelWarning[0].chatIa.length > 0
                        ? `Canal ativo no Chat IA com o agente "${channelWarning[0].chatIa[0].agentName}". Respostas dos leads entrarão no contexto errado.`
                        : `Canal em uso pela campanha ativa "${channelWarning[0].automations[0]?.name}".`}
                    </span>
                  </div>
                )}
              </div>

              {/* Canais de Reserva — lista ordenada com prioridade */}
              {channels.filter((c) => c.id !== (data.primaryChannelId ?? data.channelId)).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-white/40" />
                    <label className={labelClass + ' mb-0'}>Canais de Reserva</label>
                  </div>
                  <p className="text-[10px] text-white/40 mb-2">
                    Se o canal principal ficar offline, o sistema tenta os reservas <strong className="text-white/50">nesta ordem</strong>. Use as setas para definir a sequência.
                  </p>

                  {/* Canais já na sequência */}
                  {fallbackChannelIds.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {fallbackChannelIds.map((id, idx) => {
                        const ch = channels.find((c) => c.id === id)
                        if (!ch) return null
                        return (
                          <div key={id} className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5">
                            {/* Posição */}
                            <span className="text-[10px] font-mono text-white/30 w-4 text-center">{idx + 1}</span>
                            {/* Setas */}
                            <div className="flex flex-col gap-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => setFallbackChannelIds((ids) => {
                                  const next = [...ids]
                                  ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                  return next
                                })}
                                className="text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === fallbackChannelIds.length - 1}
                                onClick={() => setFallbackChannelIds((ids) => {
                                  const next = [...ids]
                                  ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
                                  return next
                                })}
                                className="text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Nome + status */}
                            <span className="text-xs text-white/80 flex-1">{ch.name}</span>
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              ch.status === 'CONNECTED' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
                            )}>
                              {ch.status === 'CONNECTED' ? 'Online' : 'Offline'}
                            </span>
                            {/* Remover */}
                            <button
                              type="button"
                              onClick={() => setFallbackChannelIds((ids) => ids.filter((i) => i !== id))}
                              className="text-white/20 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Canais disponíveis para adicionar */}
                  {channels
                    .filter((c) => c.id !== (data.primaryChannelId ?? data.channelId) && !fallbackChannelIds.includes(c.id))
                    .map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setFallbackChannelIds((ids) => [...ids, ch.id])}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-dashed border-white/10 hover:border-white/30 text-white/40 hover:text-white/70 transition-colors mb-1"
                      >
                        <PlusCircle className="w-3 h-3 shrink-0" />
                        <span className="text-xs flex-1 text-left">{ch.name}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          ch.status === 'CONNECTED' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
                        )}>
                          {ch.status === 'CONNECTED' ? 'Online' : 'Offline'}
                        </span>
                      </button>
                    ))}
                </div>
              )}

              {/* Filter status */}
              <div>
                <label className={labelClass}>Status de filtro do lead *</label>
                <StatusTagSelect
                  tags={filterStatusTags}
                  onChange={setFilterStatusTags}
                  suggestions={leadStatuses}
                  placeholder="Pesquisar status dos leads…"
                  variant="cyan"
                />
                <p className="text-[10px] text-white/35 mt-1.5">
                  Selecione um ou mais valores do campo <code className="text-[#38bdf8]/70">status</code> na tabela lead_many_insta.
                </p>
              </div>

              {/* Lista de exclusão */}
              <div className="rounded-lg border border-[rgba(255,255,255,0.07)] p-3 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setUseExclusionList((v) => !v)}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors cursor-pointer',
                      useExclusionList ? 'bg-orange-500' : 'bg-white/15',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      useExclusionList ? 'translate-x-4' : 'translate-x-0',
                    )} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-orange-400" />
                    <span className={labelClass + ' !mb-0'}>Usar Lista de Exclusão</span>
                  </div>
                </label>
                {useExclusionList && (
                  <div>
                    <label className={labelClass}>Filtro por status</label>
                    <StatusTagSelect
                      tags={exclusionFilterTags}
                      onChange={setExclusionFilterTags}
                      suggestions={leadStatuses}
                      placeholder="Pesquisar status da lista de exclusão…"
                      variant="orange"
                    />
                    <p className="text-[10px] text-white/35 mt-1.5">
                      Selecione um ou mais status do campo <code className="text-orange-300/70">status</code> na lista de exclusão.
                      Vazio = bloqueia <strong className="text-white/50">todos</strong> os números da lista.
                    </p>
                  </div>
                )}
              </div>

              {/* Handoff para Humano */}
              <div className="rounded-lg border border-[rgba(255,255,255,0.07)] p-3 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setHumanHandoffEnabled((v) => !v)}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors cursor-pointer',
                      humanHandoffEnabled ? 'bg-purple-500' : 'bg-white/15',
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      humanHandoffEnabled ? 'translate-x-4' : 'translate-x-0',
                    )} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserRound className="w-3.5 h-3.5 text-purple-400" />
                    <span className={labelClass + ' !mb-0'}>Atendimento Humano</span>
                  </div>
                </label>
                {humanHandoffEnabled && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-white/40">
                      Quando ativado, se o lead pedir para falar com humano, a IA solicita uma confirmação. Se confirmado, envia o link do atendente e para de responder automaticamente.
                    </p>
                    <div>
                      <label className={labelClass}>WhatsApp do Atendente *</label>
                      <input
                        type="text"
                        value={humanHandoffPhone}
                        onChange={(e) => setHumanHandoffPhone(e.target.value)}
                        placeholder="5511999990001"
                        className={inputClass}
                      />
                      <p className="text-[10px] text-white/35 mt-1">
                        Número no formato internacional sem + (ex: 5511999990001). Gerado link <code className="text-purple-300/70">wa.me/NUMERO</code>.
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>Mensagem de Handoff</label>
                      <textarea
                        value={humanHandoffMessage}
                        onChange={(e) => setHumanHandoffMessage(e.target.value)}
                        rows={2}
                        className={cn(inputClass, 'resize-none')}
                        placeholder={`Ótimo! Conectando você agora com nosso atendente 👇\nhttps://wa.me/{whatsapp_atendente}`}
                      />
                      <p className="text-[10px] text-white/35 mt-1">
                        Use <code className="text-purple-300/70">{'{nome}'}</code> e <code className="text-purple-300/70">{'{whatsapp_atendente}'}</code>. Vazio = mensagem padrão.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Min hours */}
              <div>
                <label htmlFor="det-minhours" className={labelClass}>Horas mínimas após captura *</label>
                <input id="det-minhours" type="number" {...register('minHoursAfterCapture')} className={inputClass} min={0} />
              </div>

              {/* Horário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="det-start" className={labelClass}>Hora início (BRT)</label>
                  <input id="det-start" type="number" {...register('startHour')} className={inputClass} min={0} max={23} />
                </div>
                <div>
                  <label htmlFor="det-end" className={labelClass}>Hora fim (BRT)</label>
                  <input id="det-end" type="number" {...register('endHour')} className={inputClass} min={1} max={24} />
                </div>
              </div>

              {/* Intervalo entre lotes */}
              <div>
                <label className={labelClass}>Intervalo entre lotes (min)</label>
                <p className="text-[10px] text-white/40 mb-1.5">Range randomizado a cada ciclo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="det-int-min" className="text-[10px] text-white/50 mb-1 block">Mínimo</label>
                    <input id="det-int-min" type="number" {...register('batchIntervalMinMinutes')} className={inputClass} min={1} />
                    {errors.batchIntervalMinMinutes && <p className={errorClass}>{errors.batchIntervalMinMinutes.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="det-int-max" className="text-[10px] text-white/50 mb-1 block">Máximo</label>
                    <input id="det-int-max" type="number" {...register('batchIntervalMaxMinutes')} className={inputClass} min={1} />
                    {errors.batchIntervalMaxMinutes && <p className={errorClass}>{errors.batchIntervalMaxMinutes.message}</p>}
                  </div>
                </div>
              </div>

              {/* Tamanho do lote */}
              <div>
                <label className={labelClass}>Tamanho do lote</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="det-size-min" className="text-[10px] text-white/50 mb-1 block">Mínimo</label>
                    <input id="det-size-min" type="number" {...register('batchSizeMin')} className={inputClass} min={1} />
                  </div>
                  <div>
                    <label htmlFor="det-size-max" className="text-[10px] text-white/50 mb-1 block">Máximo</label>
                    <input id="det-size-max" type="number" {...register('batchSizeMax')} className={inputClass} min={1} />
                  </div>
                </div>
              </div>

              {/* Templates */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass}>
                    Mensagens de Disparo
                    <span className="ml-1 font-normal text-white/40">(até 4 variações)</span>
                  </label>
                  {templates.length < 4 && (
                    <button
                      type="button"
                      onClick={addTemplate}
                      className="flex items-center gap-1 text-xs text-beacon-primary hover:text-beacon-primary-hover font-medium"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-white/40 mb-2">Clique num token para inserir no template. Variação sorteada por lead.</p>
                <TemplateTokens onInsert={(token) => {
                  const el = document.activeElement as HTMLTextAreaElement | null
                  if (el?.tagName === 'TEXTAREA') {
                    const s = el.selectionStart ?? el.value.length
                    const e2 = el.selectionEnd   ?? el.value.length
                    const idx = templates.findIndex((_, i2) => el.id === `tpl-${i2}`)
                    if (idx >= 0) {
                      const next = templates[idx].slice(0, s) + token + templates[idx].slice(e2)
                      updateTemplate(idx, next)
                      setTimeout(() => { el.selectionStart = el.selectionEnd = s + token.length; el.focus() }, 0)
                    }
                  } else {
                    updateTemplate(templates.length - 1, (templates[templates.length - 1] ?? '') + token)
                  }
                }} />
                <div className="space-y-3">
                  {templates.map((tpl, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-white/40 uppercase">
                          Variação {i + 1}
                        </span>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => removeTemplate(i)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <textarea
                        id={`tpl-${i}`}
                        value={tpl}
                        onChange={(e) => updateTemplate(i, e.target.value)}
                        rows={3}
                        className={cn(inputClass, 'resize-none')}
                        placeholder={'Olá {nome}! …'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up Sequencial */}
              <div className="border-t border-white/5 pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-white/40" />
                    <p className={labelClass + ' mb-0'}>Sequência de Follow-up</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFollowupEnabled((v) => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${followupEnabled ? 'bg-beacon-primary' : 'bg-white/15'}`}
                      title={followupEnabled ? 'Desativar follow-up' : 'Ativar follow-up'}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${followupEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    {followupEnabled && (
                      <button
                        type="button"
                        onClick={addFollowupStep}
                        className="flex items-center gap-1 text-xs text-beacon-primary hover:text-beacon-primary-hover font-medium"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Adicionar etapa
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-white/40 mb-3">
                  {followupEnabled
                    ? 'Enviado automaticamente se o lead não converter após o tempo configurado. Use {nome} para personalizar.'
                    : 'Follow-up desativado — leads recebem apenas o disparo inicial.'}
                </p>

                {followupEnabled && followupSteps.length === 0 && (
                  <p className="text-[11px] text-white/25 text-center py-3 border border-dashed border-white/10 rounded-lg">
                    Nenhuma etapa configurada — lead recebe apenas o disparo inicial.
                  </p>
                )}

                <div className="space-y-4">
                  {followupEnabled && followupSteps.map((step, si) => (
                    <div key={si} className="border border-white/8 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white/50 uppercase">
                          Etapa {si + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFollowupStep(si)}
                          className="text-white/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <label className={labelClass}>Aguardar sem conversão (horas)</label>
                        <input
                          type="number"
                          value={step.afterHours}
                          min={1}
                          onChange={(e) => updateFollowupStepHours(si, Number(e.target.value))}
                          className={inputClass}
                        />
                        <p className="text-[10px] text-white/35 mt-1">
                          Ex: 24 = envia 24h após o contato inicial se o lead não respondeu/converteu
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={labelClass + ' mb-0'}>Mensagens desta etapa</label>
                          {step.templates.length < 4 && (
                            <button
                              type="button"
                              onClick={() => addFollowupTemplate(si)}
                              className="flex items-center gap-1 text-[11px] text-beacon-primary hover:text-beacon-primary-hover"
                            >
                              <PlusCircle className="w-3 h-3" />
                              + variação
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {step.templates.map((tpl, ti) => (
                            <div key={ti} className="relative">
                              <textarea
                                value={tpl}
                                onChange={(e) => updateFollowupTemplate(si, ti, e.target.value)}
                                rows={2}
                                className={cn(inputClass, 'resize-none pr-8')}
                                placeholder={`Variação ${ti + 1} — Olá {nome}! Voltei aqui…`}
                              />
                              {step.templates.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeFollowupTemplate(si, ti)}
                                  className="absolute top-2 right-2 text-white/25 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agente de IA */}
              <div>
                <label htmlFor="det-agent" className={labelClass}>Agente de IA Conversacional</label>
                <select id="det-agent" {...register('linkedAgentId')} className={inputClass}>
                  <option value="">Nenhum (sem IA)</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}{agent.description ? ` — ${agent.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Canal de resposta da IA */}
              <div>
                <label htmlFor="det-ai-channel" className={labelClass}>Canal de Resposta da IA</label>
                <p className="text-[10px] text-white/40 mb-1">Se vazio, usa o mesmo canal do disparo.</p>
                <select
                  id="det-ai-channel"
                  {...register('aiChannelId')}
                  onChange={(e) => { register('aiChannelId').onChange(e); onChannelPickChange(e.target.value, 'ai') }}
                  className={inputClass}
                >
                  <option value="">Mesmo canal do disparo</option>
                  {allChannelsSorted.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}{ch.status !== 'CONNECTED' ? ` (${ch.status === 'DISCONNECTED' ? 'desconectado' : 'offline'})` : ''}
                    </option>
                  ))}
                </select>
                {aiChanWarning.length > 0 && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {aiChanWarning[0].chatIa.length > 0
                        ? `Canal ativo no Chat IA com o agente "${aiChanWarning[0].chatIa[0].agentName}".`
                        : `Canal em uso pela campanha "${aiChanWarning[0].automations[0]?.name}".`}
                    </span>
                  </div>
                )}
              </div>

              {/* Modelo LLM */}
              <div>
                <label htmlFor="det-ai-model" className={labelClass}>Modelo LLM da IA</label>
                <select id="det-ai-model" {...register('aiModel')} className={inputClass}>
                  <option value="">Padrão (Claude Haiku 4.5)</option>
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Delay entre disparos */}
              <div className="border-t border-white/5 pt-4">
                <p className={`${labelClass} mb-1`}>Delay entre Mensagens do Lote</p>
                <p className="text-[10px] text-white/40 mb-3">Pausa aleatória entre cada envio individual — reduz risco de ban. Padrão: 80–160s.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="det-dispatch-min" className={labelClass}>Mínimo (seg)</label>
                    <input
                      id="det-dispatch-min"
                      type="number"
                      placeholder="80"
                      min={5}
                      max={600}
                      {...register('dispatchDelayMinSec')}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="det-dispatch-max" className={labelClass}>Máximo (seg)</label>
                    <input
                      id="det-dispatch-max"
                      type="number"
                      placeholder="160"
                      min={5}
                      max={600}
                      {...register('dispatchDelayMaxSec')}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Timing de Resposta */}
              <div className="border-t border-white/5 pt-4">
                <p className={`${labelClass} mb-3`}>Timing de Resposta da IA</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="det-debounce" className={labelClass}>Debounce (ms)</label>
                    <input
                      id="det-debounce"
                      type="number"
                      placeholder="ex: 5000"
                      {...register('debounceMs')}
                      className={inputClass}
                    />
                    <p className="mt-1 text-[10px] text-white/35">Aguarda silêncio antes de responder. Deixe vazio para usar o padrão do canal.</p>
                  </div>
                  <div>
                    <label htmlFor="det-send-delay" className={labelClass}>Delay inicial (ms)</label>
                    <input
                      id="det-send-delay"
                      type="number"
                      placeholder="ex: 800"
                      {...register('sendDelayMs')}
                      className={inputClass}
                    />
                    <p className="mt-1 text-[10px] text-white/35">Pausa antes do primeiro fragmento. Deixe vazio para usar o padrão do canal.</p>
                  </div>
                  <div>
                    <label htmlFor="det-fragment-delay" className={labelClass}>Delay entre frases (ms)</label>
                    <input
                      id="det-fragment-delay"
                      type="number"
                      placeholder="ex: 1500"
                      {...register('fragmentDelayMs')}
                      className={inputClass}
                    />
                    <p className="mt-1 text-[10px] text-white/35">Pausa entre cada fragmento da resposta. Deixe vazio para usar o padrão do canal.</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover automação
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleActivateToggle}
                    disabled={isPending}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border',
                      data?.status === 'ACTIVE'
                        ? 'bg-red-500/10 text-red-400 border-red-500/25 hover:bg-red-500/20'
                        : 'bg-green-500/10 text-green-400 border-green-500/25 hover:bg-green-500/20',
                    )}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {data?.status === 'ACTIVE' ? 'Desativar' : 'Ativar Campanha'}
                  </button>
                  <Button type="submit" variant="primary" loading={isPending}>
                    Salvar
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* ─── Right: Test Panel + Metrics + Logs ──────────────── */}
        <div className="space-y-5">

          {/* Painel de Teste */}
          {id && (
            <TestPanel
              automationId={id}
              channelId={data.channelId ?? data.primaryChannelId}
              templates={templates.filter((t) => t.trim().length > 0)}
              savedPhones={data.testPhones ?? []}
              onSavePhones={handleSaveTestPhones}
            />
          )}

          {stats && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Send}          label="Enviados"    value={stats.totalSent}      />
              <StatCard icon={MessageSquare} label="Respostas"   value={stats.totalReplied}   />
              <StatCard icon={CheckCircle2}  label="Convertidos" value={stats.totalConverted} />
              <StatCard icon={TrendingUp}    label="Conversão"   value={`${stats.conversionRate}%`} />
              {data.useExclusionList && (
                <div className="col-span-2">
                  <StatCard
                    icon={Ban}
                    label="Lista de Exclusão"
                    value={stats.leadsExcluidos}
                    sub={exclusionFilterTags.length > 0 ? `filtro: ${exclusionFilterTags.join(', ')}` : 'todos os registros'}
                  />
                </div>
              )}
            </div>
          )}

          {stats && (
            <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-card p-4">
              <div className="flex items-center gap-2 text-white/50 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium">Leads na fila</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.leadsNaFila}</p>
              <p className="text-xs text-white/40 mt-0.5">Prontos para contato inicial</p>
            </div>
          )}

          {/* Dispatch Feed — per-lead real-time monitor */}
          <DispatchFeed logs={dispatchLogs} isActive={data.status === 'ACTIVE'} />

          {/* Execution logs */}
          <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-card">
            <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
              <h3 className="text-sm font-semibold text-white">Logs de Execução</h3>
            </div>
            {logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-white/40">
                Nenhum log ainda. O scheduler executa a cada 30 minutos.
              </div>
            ) : (
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.07)] bg-white/4">
                      <th className="px-4 py-2 text-left font-medium text-white/50">Data</th>
                      <th className="px-3 py-2 text-center font-medium text-white/50">Enviados</th>
                      <th className="px-3 py-2 text-center font-medium text-white/50">Pulados</th>
                      <th className="px-3 py-2 text-center font-medium text-white/50">Erros</th>
                      <th className="px-3 py-2 text-left font-medium text-white/50">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-[rgba(255,255,255,0.07)] hover:bg-white/4">
                        <td className="px-4 py-2 text-white/50 whitespace-nowrap">
                          {new Date(log.executedAt).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-white">{log.sent}</td>
                        <td className="px-3 py-2 text-center text-white/40">{log.skipped}</td>
                        <td className="px-3 py-2 text-center text-red-500">{log.errors}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-medium',
                            log.reason === 'success'
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-white/8 text-white/50',
                          )}>
                            {REASON_LABELS[log.reason ?? ''] ?? log.reason ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
