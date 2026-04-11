/**
 * ChatIaPage — Configuração de Canal + Agente + Modelo LLM
 *
 * Cada registro vincula um canal a um agente com um modelo LLM específico.
 * Quando uma mensagem chega no canal, o agente responde com o modelo configurado.
 */

import { useState, useRef, useMemo }  from 'react'
import { createPortal } from 'react-dom'
import { useForm }   from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z }         from 'zod'
import {
  MessageCircle, Plus, Trash2, Pencil,
  Smartphone, Bot, Cpu, ToggleLeft, ToggleRight,
  Copy, Check, Link, Zap, CheckCircle2, XCircle, AlertCircle, Loader2,
  ChevronDown, ChevronUp, Activity, RefreshCw, Settings2, Timer, UserCheck, HelpCircle,
  Users, Key, Clock, Sparkles, MessageSquare, GitBranch, Search, Filter,
} from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Badge }    from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAgents } from '@/features/agents/hooks/useAgents'
import { useChannels } from '@/features/channels/hooks/useChannels'
import {
  useChatIaList, useCreateChatIa, useUpdateChatIa, useDeleteChatIa, useTestChatIa, useIngestionLogs, useExplainLog,
} from './hooks/useChatIa'
import type { ConnectionTestResult, IngestionLog } from '@/services/chat-ia'
import { cn } from '@/lib/utils'
import type { ChannelAgent } from '@/types/chat-ia'

// ─── Info tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  const show = () => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top })
  }

  return (
    <span
      ref={ref}
      className="inline-flex items-center cursor-help"
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      <HelpCircle className={cn('w-3 h-3 transition-colors', pos ? 'text-beacon-primary' : 'text-white/30')} />
      {pos && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-56 rounded-lg bg-[#1a1a1a] text-white text-[11px] leading-relaxed px-3 py-2 shadow-lg"
          style={{ left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a1a]" />
        </div>,
        document.body,
      )}
    </span>
  )
}

// ─── Available LLM models ─────────────────────────────────────────────────────

const AVAILABLE_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Rápido)' },
  { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Equilibrado)' },
  { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6 (Máximo)' },
  { value: 'gpt-4o-mini',               label: 'GPT-4o Mini' },
  { value: 'gpt-4o',                    label: 'GPT-4o' },
]

// ─── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name:                     z.string().min(1, 'Nome obrigatório'),
  channelId:                z.string().min(1, 'Selecione um canal'),
  agentId:                  z.string().min(1, 'Selecione um agente'),
  llmModel:                 z.string().min(1, 'Selecione um modelo'),
  isActive:                 z.boolean().default(true),
  debounceMs:               z.number().min(500).max(15000),
  fragmentDelayMs:          z.number().min(300).max(5000),
  humanTakeoverTimeoutMin:  z.number().min(0).max(1440),
  sendDelayMs:              z.number().min(0).max(30000),
  allowGroups:              z.boolean().default(false),
  triggerMode:              z.enum(['always', 'keywords']).default('always'),
  triggerKeywords:          z.string().default(''),
})
type FormValues = z.infer<typeof schema>

// ─── Form component ───────────────────────────────────────────────────────────

type SubmitPayload = Omit<FormValues, 'triggerKeywords'> & { triggerKeywords: string[] }

function ChatIaForm({
  defaultValues,
  onClose,
  onSubmit: onSubmitProp,
  isPending,
}: {
  defaultValues?: Partial<FormValues>
  onClose: () => void
  onSubmit: (values: SubmitPayload) => void
  isPending: boolean
}) {
  const { data: agents }   = useAgents()
  const { data: channels } = useChannels()
  // Chat IA usa apenas agentes PASSIVOS (resposta inbound)
  const activeAgents       = agents?.filter((a) => a.status === 'ACTIVE' && (!a.agentType || a.agentType === 'PASSIVO')) ?? []
  const allChannels        = channels ?? []

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [takeoverAuto, setTakeoverAuto] = useState(() => (defaultValues?.humanTakeoverTimeoutMin ?? 0) > 0)
  const [allowGroupsState, setAllowGroupsState]   = useState(() => defaultValues?.allowGroups ?? false)
  const [triggerKeywordsMode, setTriggerKeywordsMode] = useState(() => (defaultValues?.triggerMode ?? 'always') === 'keywords')

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:            defaultValues?.name            ?? '',
      channelId:       defaultValues?.channelId       ?? '',
      agentId:         defaultValues?.agentId         ?? '',
      llmModel:        defaultValues?.llmModel        ?? AVAILABLE_MODELS[0].value,
      isActive:        defaultValues?.isActive        ?? true,
      debounceMs:               defaultValues?.debounceMs               ?? 3000,
      fragmentDelayMs:          defaultValues?.fragmentDelayMs          ?? 1200,
      humanTakeoverTimeoutMin:  defaultValues?.humanTakeoverTimeoutMin  ?? 0,
      sendDelayMs:              defaultValues?.sendDelayMs              ?? 0,
      allowGroups:              defaultValues?.allowGroups              ?? false,
      triggerMode:              (defaultValues?.triggerMode as 'always' | 'keywords') ?? 'always',
      triggerKeywords:          Array.isArray(defaultValues?.triggerKeywords)
        ? (defaultValues.triggerKeywords as string[]).join(', ')
        : (defaultValues?.triggerKeywords as string | undefined) ?? '',
    },
  })

  const watchedDebounce  = watch('debounceMs')
  const watchedSendDelay = watch('sendDelayMs')
  const sendDelayTooLow  = watchedSendDelay > 0 && watchedSendDelay < watchedDebounce

  const inputClass = cn(
    'w-full text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 bg-beacon-surface text-white/85',
    'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25',
  )

  const handleSubmitTransform = (values: FormValues) => {
    const keywords = values.triggerKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    onSubmitProp({ ...values, triggerKeywords: keywords })
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitTransform)} className="space-y-4">
      {/* Nome */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">
          Nome da configuração *
        </label>
        <input
          {...register('name')}
          className={inputClass}
          placeholder="Ex: WhatsApp Principal → Assistente Vendas"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* Canal */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">
          <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Canal *</span>
        </label>
        <select {...register('channelId')} className={inputClass}>
          <option value="">Selecionar canal…</option>
          {allChannels.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.channelId && <p className="text-xs text-red-500 mt-1">{errors.channelId.message}</p>}
      </div>

      {/* Agente */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">
          <span className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> Agente *
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-50 text-[#00b4d8] border border-cyan-200">
              Apenas Passivos
            </span>
          </span>
        </label>
        <select {...register('agentId')} className={inputClass}>
          <option value="">Selecionar agente…</option>
          {activeAgents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {activeAgents.length === 0 && (
          <p className="text-[10px] text-amber-600 mt-1">
            Nenhum agente Passivo ativo. Configure em{' '}
            <a href="/agents" className="underline">Agentes</a> com tipo "Passivo".
          </p>
        )}
        {errors.agentId && <p className="text-xs text-red-500 mt-1">{errors.agentId.message}</p>}
      </div>

      {/* Modelo LLM */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">
          <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Modelo LLM *</span>
        </label>
        <select {...register('llmModel')} className={inputClass}>
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {errors.llmModel && <p className="text-xs text-red-500 mt-1">{errors.llmModel.message}</p>}
      </div>

      {/* Configurações avançadas — acordeon */}
      <div className="border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/8 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs font-medium text-white/50">Configurações avançadas</span>
          </div>
          {showAdvanced
            ? <ChevronUp className="w-3.5 h-3.5 text-white/40" />
            : <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          }
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 pt-3 space-y-4">

            {/* Timing */}
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-3">Timing de resposta</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-white/70 mb-1">
                    Debounce (ms)
                    <InfoTooltip text="Se a pessoa mandar várias mensagens seguidas, a IA espera esse tempo antes de responder — assim ela responde tudo de uma vez, em vez de responder cada mensagem separada." />
                  </label>
                  <input
                    type="number"
                    {...register('debounceMs', { valueAsNumber: true })}
                    className={inputClass}
                    min={500} max={15000} step={500}
                  />
                  <p className="text-[10px] text-white/40 mt-1">Agrupa msgs rápidas (máx 15s)</p>
                  {errors.debounceMs && <p className="text-[10px] text-red-500 mt-0.5">{errors.debounceMs.message}</p>}
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-white/70 mb-1">
                    Delay fragmentos (ms)
                    <InfoTooltip text="A IA divide a resposta em partes para parecer mais natural. Esse é o tempo de espera entre o envio de cada parte — como se ela estivesse digitando." />
                  </label>
                  <input
                    type="number"
                    {...register('fragmentDelayMs', { valueAsNumber: true })}
                    className={inputClass}
                    min={300} max={5000} step={100}
                  />
                  <p className="text-[10px] text-white/40 mt-1">Intervalo por fragmento</p>
                  {errors.fragmentDelayMs && <p className="text-[10px] text-red-500 mt-0.5">{errors.fragmentDelayMs.message}</p>}
                </div>
              </div>
            </div>

            {/* Atraso de envio */}
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <div>
                    <p className="flex items-center gap-1 text-xs font-medium text-white/70">
                      Atraso antes de enviar
                      <InfoTooltip text="Depois que a IA termina de pensar, ela espera esse tempo antes de começar a digitar. Deixa a conversa mais natural, como se fosse uma pessoa que leva alguns segundos para responder." />
                    </p>
                    <p className="text-[10px] text-white/40">Humaniza o tempo de resposta</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  {...register('sendDelayMs', { valueAsNumber: true })}
                  className={cn(inputClass, 'w-24')}
                  min={0} max={30000} step={500}
                  placeholder="0"
                />
                <p className="text-xs text-white/50">ms de espera (0 = imediato)</p>
              </div>
              {sendDelayTooLow && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>
                    O atraso ({watchedSendDelay}ms) é menor que o debounce ({watchedDebounce}ms).
                    O debounce já introduz um atraso — o ideal é que o atraso de envio seja <strong>≥ {watchedDebounce}ms</strong> para o tempo total fazer sentido.
                  </span>
                </div>
              )}
            </div>

            {/* Filtro de grupos */}
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  <div>
                    <p className="flex items-center gap-1 text-xs font-medium text-white/70">
                      Responder grupos
                      <InfoTooltip text="Por padrão a IA só responde conversas individuais. Ative isso se quiser que ela também responda mensagens enviadas em grupos do WhatsApp." />
                    </p>
                    <p className="text-[10px] text-white/40">IA responde mensagens de grupos</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowGroupsState}
                  onClick={() => {
                    const next = !allowGroupsState
                    setAllowGroupsState(next)
                    setValue('allowGroups', next)
                  }}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none',
                    allowGroupsState ? 'bg-purple-400' : 'bg-white/8',
                  )}
                >
                  <span className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                    allowGroupsState ? 'translate-x-4.5' : 'translate-x-0.5',
                  )} />
                </button>
              </div>
            </div>

            {/* Gatilho de ativação */}
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-green-600" />
                  <div>
                    <p className="flex items-center gap-1 text-xs font-medium text-white/70">
                      Ativação por palavra-chave
                      <InfoTooltip text='Quando ativado, a IA só entra na conversa se a mensagem contiver uma das palavras configuradas. Útil para acionar a IA apenas quando o cliente digitar "oi", "olá", "quero" etc.' />
                    </p>
                    <p className="text-[10px] text-white/40">IA só responde com gatilho específico</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={triggerKeywordsMode}
                  onClick={() => {
                    const next = !triggerKeywordsMode
                    setTriggerKeywordsMode(next)
                    setValue('triggerMode', next ? 'keywords' : 'always')
                    if (!next) setValue('triggerKeywords', '')
                  }}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none',
                    triggerKeywordsMode ? 'bg-green-500' : 'bg-white/8',
                  )}
                >
                  <span className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                    triggerKeywordsMode ? 'translate-x-4.5' : 'translate-x-0.5',
                  )} />
                </button>
              </div>

              {triggerKeywordsMode && (
                <div className="mt-2 pl-5">
                  <input
                    {...register('triggerKeywords')}
                    className={inputClass}
                    placeholder="oi, olá, quero, comprar"
                  />
                  <p className="text-[10px] text-white/40 mt-1">Separe as palavras por vírgula</p>
                </div>
              )}
            </div>

            {/* Atendimento humano */}
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Timer className="w-3.5 h-3.5 text-amber-500" />
                  <div>
                    <p className="flex items-center gap-1 text-xs font-medium text-white/70">
                      Retomada automática pela IA
                      <InfoTooltip text="Quando um humano assume o atendimento, a IA fica em pausa. Com essa opção ativa, ela volta automaticamente depois do tempo configurado sem nenhuma resposta do humano." />
                    </p>
                    <p className="text-[10px] text-white/40">IA retoma após X min sem resposta humana</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={takeoverAuto}
                  onClick={() => {
                    const next = !takeoverAuto
                    setTakeoverAuto(next)
                    if (!next) setValue('humanTakeoverTimeoutMin', 0)
                  }}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none',
                    takeoverAuto ? 'bg-amber-400' : 'bg-white/8',
                  )}
                >
                  <span className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                    takeoverAuto ? 'translate-x-4.5' : 'translate-x-0.5',
                  )} />
                </button>
              </div>

              {takeoverAuto && (
                <div className="mt-2 flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <input
                    type="number"
                    {...register('humanTakeoverTimeoutMin', { valueAsNumber: true })}
                    className={cn(inputClass, 'w-24')}
                    min={5} max={1440} step={5}
                    placeholder="30"
                  />
                  <p className="text-xs text-white/50">minutos sem resposta → IA retoma</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isPending}>
          Salvar
        </Button>
      </div>
    </form>
  )
}

// ─── Card component ───────────────────────────────────────────────────────────

// ─── Test result display ───────────────────────────────────────────────────────

function TestResultPanel({ result }: { result: ConnectionTestResult }) {
  if (result.ok) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium">Conectado e funcionando</span>
      </div>
    )
  }

  const issues: string[] = []
  if (result.channelStatus !== 'CONNECTED') {
    issues.push(`Canal ${result.channelStatus === 'DISCONNECTED' ? 'desconectado' : result.channelStatus.toLowerCase()}`)
  }
  if (!result.webhookMatch && result.expectedUrl) {
    if (!result.registeredUrl) {
      issues.push('Webhook não registrado na Evolution API')
    } else {
      issues.push('URL do webhook não corresponde')
    }
  }
  if (result.error && !issues.length) {
    issues.push(result.error)
  }

  return (
    <div className="mt-2 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5 text-red-700 font-medium">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        Problema detectado
      </div>
      {issues.map((issue, i) => (
        <p key={i} className="text-red-600 pl-5">{issue}</p>
      ))}
      {result.registeredUrl && result.registeredUrl !== result.expectedUrl && (
        <p className="text-red-500 pl-5 font-mono text-[10px] truncate">
          Registrada: {result.registeredUrl}
        </p>
      )}
    </div>
  )
}

function WebhookUrlRow({ channelId }: { channelId: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/inbound/${channelId}`

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
      <p className="text-[10px] font-medium text-white/40 mb-1 flex items-center gap-1">
        <Link className="w-3 h-3" /> URL do Webhook
      </p>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 text-[10px] bg-white/8 rounded px-2 py-1 truncate text-white/85 font-mono">
          {url}
        </code>
        <button
          onClick={handleCopy}
          className="p-1 rounded text-white/40 hover:text-beacon-primary hover:bg-beacon-primary/10 transition-colors shrink-0"
          title="Copiar URL"
        >
          {copied
            ? <Check className="w-3.5 h-3.5 text-green-500" />
            : <Copy className="w-3.5 h-3.5" />
          }
        </button>
      </div>
    </div>
  )
}

function ChannelAgentCard({
  item,
  agents,
  channels,
}: {
  item: ChannelAgent
  agents: { id: string; name: string }[]
  channels: { id: string; name: string }[]
}) {
  const { toast }  = useToast()
  const updateMut  = useUpdateChatIa()
  const deleteMut  = useDeleteChatIa()
  const testMut    = useTestChatIa()
  const [editOpen, setEditOpen]       = useState(false)
  const [deleteOpen, setDeleteOpen]   = useState(false)
  const [testResult, setTestResult]   = useState<ConnectionTestResult | null>(null)

  const agentName   = agents.find((a) => a.id === item.agentId)?.name   ?? item.agentId
  const channelName = channels.find((c) => c.id === item.channelId)?.name ?? item.channelId
  const modelLabel  = AVAILABLE_MODELS.find((m) => m.value === item.llmModel)?.label ?? item.llmModel

  const handleToggle = () => {
    updateMut.mutate(
      { id: item.id, data: { isActive: !item.isActive } },
      {
        onSuccess: () => toast({ type: 'success', title: item.isActive ? 'Config desativada' : 'Config ativada' }),
        onError:   () => toast({ type: 'error',   title: 'Erro ao atualizar' }),
      },
    )
  }

  const handleDelete = () => {
    deleteMut.mutate(item.id, {
      onSuccess: () => { toast({ type: 'success', title: 'Config removida' }); setDeleteOpen(false) },
      onError:   () => toast({ type: 'error', title: 'Erro ao remover' }),
    })
  }

  const handleEdit = (values: SubmitPayload) => {
    updateMut.mutate(
      { id: item.id, data: values },
      {
        onSuccess: () => { toast({ type: 'success', title: 'Config atualizada' }); setEditOpen(false) },
        onError:   () => toast({ type: 'error', title: 'Erro ao atualizar' }),
      },
    )
  }

  const handleTest = () => {
    setTestResult(null)
    testMut.mutate(item.id, {
      onSuccess: (result) => setTestResult(result),
      onError:   () => toast({ type: 'error', title: 'Erro ao testar conexão' }),
    })
  }

  return (
    <>
      <div className="bg-beacon-surface rounded-card border border-[rgba(255,255,255,0.07)] shadow-card p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{item.name}</h3>
            <Badge variant={item.isActive ? 'active' : 'paused'} className="mt-1 text-[10px]">
              {item.isActive ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleTest}
              disabled={testMut.isPending}
              className="p-1.5 rounded-lg text-white/40 hover:bg-beacon-primary/10 hover:text-beacon-primary transition-colors disabled:opacity-50"
              title="Testar conexão"
            >
              {testMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : testResult === null
                  ? <Zap className="w-4 h-4" />
                  : testResult.ok
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <AlertCircle className="w-4 h-4 text-red-500" />
              }
            </button>
            <button
              onClick={handleToggle}
              className="p-1.5 rounded-lg text-white/40 hover:bg-white/8 hover:text-white transition-colors"
              title={item.isActive ? 'Desativar' : 'Ativar'}
            >
              {item.isActive
                ? <ToggleRight className="w-4 h-4 text-beacon-primary" />
                : <ToggleLeft  className="w-4 h-4" />
              }
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="p-1.5 rounded-lg text-white/40 hover:bg-white/8 hover:text-white transition-colors"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Details */}
        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1 text-white/40 w-16 shrink-0">
              <Smartphone className="w-3 h-3" /> Canal
            </dt>
            <dd className="text-white font-medium truncate">{channelName}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1 text-white/40 w-16 shrink-0">
              <Bot className="w-3 h-3" /> Agente
            </dt>
            <dd className="text-white font-medium truncate">{agentName}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1 text-white/40 w-16 shrink-0">
              <Cpu className="w-3 h-3" /> Modelo
            </dt>
            <dd className="text-white font-medium truncate">{modelLabel}</dd>
          </div>
        </dl>

        {testResult && <TestResultPanel result={testResult} />}

        <WebhookUrlRow channelId={item.channelId} />
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Chat IA" size="md">
        <ChatIaForm
          defaultValues={{ ...item, triggerMode: item.triggerMode as 'always' | 'keywords', triggerKeywords: (item.triggerKeywords ?? []).join(', ') }}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEdit}
          isPending={updateMut.isPending}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Remover configuração"
        description={`Tem certeza que deseja remover "${item.name}"?`}
        confirmLabel="Remover"
        confirmVariant="danger"
        loading={deleteMut.isPending}
      />
    </>
  )
}

// ─── Ingestion logs panel ─────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  received:       { label: 'Recebido',         className: 'bg-gray-100 text-gray-600' },
  debounced:      { label: 'Aguardando',        className: 'bg-gray-100 text-gray-500' },
  processing:     { label: 'Processando',       className: 'bg-blue-100 text-blue-700' },
  completed:      { label: 'Concluído',         className: 'bg-green-100 text-green-700' },
  no_agent:       { label: 'Sem agente',        className: 'bg-amber-100 text-amber-700' },
  no_channel:     { label: 'Sem canal',         className: 'bg-amber-100 text-amber-700' },
  ai_error:       { label: 'Erro IA',           className: 'bg-red-100 text-red-700' },
  parse_error:    { label: 'Parse inválido',    className: 'bg-red-100 text-red-700' },
  send_error:     { label: 'Erro envio',        className: 'bg-red-100 text-red-700' },
  failed:         { label: 'Falha',             className: 'bg-red-100 text-red-700' },
  human_takeover: { label: 'Atend. humano',     className: 'bg-purple-100 text-purple-700' },
  automation:     { label: 'Automação',         className: 'bg-blue-100 text-blue-600' },
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`
  return `${Math.floor(diff / 3600)}h atrás`
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function PayloadModal({ log, onClose }: { log: IngestionLog; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Payload recebido" size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <StatusBadge status={log.status} />
          <span>{log.channelName ?? log.channelId}</span>
          <span className="text-white/40">{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
        </div>
        {log.errorMsg && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {log.errorMsg}
          </div>
        )}
        <pre className="text-[11px] font-mono bg-white/6 border border-[rgba(255,255,255,0.08)] rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all text-white/85">
          {log.rawPayload ? JSON.stringify(log.rawPayload, null, 2) : '(sem payload)'}
        </pre>
      </div>
    </Modal>
  )
}

// ─── Status dot indicator ─────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  completed:      'bg-green-500',
  processing:     'bg-blue-400 animate-pulse',
  received:       'bg-gray-300',
  debounced:      'bg-gray-300',
  human_takeover: 'bg-purple-400',
  automation:     'bg-blue-300',
  no_agent:       'bg-amber-400',
  no_channel:     'bg-amber-400',
  ai_error:       'bg-red-500',
  parse_error:    'bg-red-500',
  send_error:     'bg-red-500',
  failed:         'bg-red-500',
}

// ─── LogRow ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: IngestionLog }) {
  const [expanded,    setExpanded]    = useState(false)
  const [showPayload, setShowPayload] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const explainMut = useExplainLog()

  const isError    = ['ai_error', 'parse_error', 'send_error', 'failed', 'no_agent', 'no_channel'].includes(log.status)
  const hasPayload = !!log.rawPayload
  const isStale    = log.status === 'processing' &&
    (Date.now() - new Date(log.createdAt).getTime()) > 5 * 60_000

  // Exibe UUID truncado com aviso visual para logs antigos sem channelName
  const channelDisplay = log.channelName
    ? <span className="font-medium">{log.channelName}</span>
    : <span className="text-white/30 font-mono text-[10px]">{(log.channelId ?? '—').substring(0, 8)}…</span>

  const handleExplain = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (explanation) { setExplanation(null); return }
    explainMut.mutate(log.id, {
      onSuccess: (data) => setExplanation(data.explanation),
    })
  }

  return (
    <>
      {/* Linha principal */}
      <div
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'grid text-xs py-2.5 px-4 gap-3 border-b border-[rgba(255,255,255,0.07)] last:border-0 cursor-pointer select-none transition-colors items-center',
          'grid-cols-[8px_100px_160px_160px_1fr_110px_70px_100px]',
          expanded ? 'bg-blue-500/10' : isError ? 'hover:bg-red-500/8 bg-red-500/5' : 'hover:bg-white/5',
        )}
      >
        {/* Dot */}
        <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[log.status] ?? 'bg-gray-300')} />
        {/* Quando */}
        <span className="text-white/40 tabular-nums">{timeAgo(log.createdAt)}</span>
        {/* Canal */}
        <span className="truncate">{channelDisplay}</span>
        {/* Contato */}
        <span className="text-white/50 truncate">
          {log.contactName
            ? <>{log.contactName} <span className="text-white/40 text-[10px]">{log.contactPhone}</span></>
            : <span className="text-white/30">{log.contactPhone ?? '—'}</span>
          }
        </span>
        {/* Mensagem prévia */}
        <span className="text-white/40 truncate italic">
          {log.messagePreview ? `"${log.messagePreview}"` : '—'}
        </span>
        {/* Status */}
        <span className="flex items-center gap-1">
          {isStale
            ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">⚠ Preso</span>
            : <StatusBadge status={log.status} />
          }
        </span>
        {/* Latência */}
        <span className={cn('text-right tabular-nums', isError ? 'text-red-400' : 'text-white/40')}>
          {log.latencyMs ? `${log.latencyMs}ms` : '—'}
        </span>
        {/* Botão Analisar inline */}
        <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleExplain}
            disabled={explainMut.isPending}
            className={cn(
              'flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors whitespace-nowrap',
              explanation
                ? 'border-beacon-primary/40 bg-beacon-primary/5 text-beacon-primary'
                : 'border-[rgba(255,255,255,0.07)] bg-transparent text-white/40 hover:text-beacon-primary hover:border-beacon-primary/40',
            )}
          >
            {explainMut.isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Sparkles className="w-3 h-3" />
            }
            {explainMut.isPending ? 'Analisando…' : explanation ? 'Fechar' : 'Analisar'}
          </button>
        </span>
      </div>

      {/* Painel de detalhes expandido */}
      {expanded && (
        <div className={cn(
          'border-b border-[rgba(255,255,255,0.07)] px-6 py-4 space-y-3',
          isError ? 'bg-red-500/5' : 'bg-white/3',
        )}>

          {/* Mensagem recebida */}
          {log.messagePreview && (
            <div className="bg-white/6 border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-white/40 uppercase font-semibold tracking-wide mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Mensagem recebida
              </p>
              <p className="text-xs text-white/85 leading-relaxed">{log.messagePreview}</p>
            </div>
          )}

          {/* Metadados em linha */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-white/50">
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3 text-white/30" />
              {new Date(log.createdAt).toLocaleString('pt-BR')}
            </span>
            {log.contactPhone && (
              <span className="flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-white/30" />
                {log.contactPhone}
              </span>
            )}
            {log.step && (
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-white/30" />
                Etapa: <span className="font-mono">{log.step}</span>
              </span>
            )}
            {log.model && (
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3 text-white/30" />
                {log.model}
              </span>
            )}
            {log.latencyMs != null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-white/30" />
                {log.latencyMs}ms ({(log.latencyMs / 1000).toFixed(1)}s)
              </span>
            )}
          </div>

          {/* Erro */}
          {log.errorMsg && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{log.errorMsg}</span>
            </div>
          )}

          {isStale && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Este log ficou preso em "Processando" — provavelmente o serviço foi reiniciado durante o processamento. Será limpo automaticamente no próximo ciclo do cron (a cada 5 min).</span>
            </div>
          )}

          {/* Resultado da análise IA */}
          {explanation && (
            <div className="rounded-lg border border-beacon-primary/20 bg-beacon-primary/5 px-3 py-3">
              <p className="text-[10px] font-semibold text-beacon-primary uppercase tracking-wide mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Análise da IA Central
              </p>
              <p className="text-[11px] text-white/85 leading-relaxed whitespace-pre-wrap">{explanation}</p>
            </div>
          )}

          {/* Ação: ver payload */}
          {hasPayload && (
            <div className="pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); setShowPayload(true) }}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-transparent text-white/50 hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-colors"
              >
                <AlertCircle className="w-3 h-3" /> Ver payload bruto
              </button>
            </div>
          )}
        </div>
      )}

      {showPayload && <PayloadModal log={log} onClose={() => setShowPayload(false)} />}
    </>
  )
}

// ─── Filtros de status ────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'all',          label: 'Todos' },
  { value: 'completed',    label: 'Concluído' },
  { value: 'failed',       label: 'Erro' },
  { value: 'ai_error',     label: 'Erro IA' },
  { value: 'processing',   label: 'Processando' },
  { value: 'human_takeover', label: 'Atend. Humano' },
  { value: 'automation',   label: 'Automação' },
  { value: 'no_agent',     label: 'Sem agente' },
]

// ─── Painel de execuções ──────────────────────────────────────────────────────

function IngestionLogsPanel() {
  const [open,       setOpen]       = useState(true)
  const [statusFilter, setStatus]   = useState('all')
  const [search,     setSearch]     = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Debounce da busca
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (v: string) => {
    setSearchInput(v)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setSearch(v), 400)
  }

  const queryParams = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
    limit:  50,
  }), [statusFilter, search])

  const { data: logs = [], isFetching } = useIngestionLogs(queryParams)

  const errorCount = logs.filter((l) =>
    ['ai_error', 'parse_error', 'send_error', 'failed', 'no_agent', 'no_channel'].includes(l.status)
  ).length

  return (
    <div className="bg-beacon-surface rounded-card border border-[rgba(255,255,255,0.07)] shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Activity className="w-4 h-4 text-beacon-primary" />
          <span className="text-sm font-semibold text-white">Execuções Recentes</span>
          {isFetching && <RefreshCw className="w-3 h-3 text-white/40 animate-spin" />}
          {errorCount > 0 && (
            <span className="text-[10px] font-medium text-white bg-red-500 rounded-full px-1.5 py-0.5">
              {errorCount} erro{errorCount > 1 ? 's' : ''}
            </span>
          )}
          {logs.length > 0 && errorCount === 0 && (
            <span className="text-[10px] text-white/40 bg-white/8 rounded-full px-1.5 py-0.5">
              {logs.length}
            </span>
          )}
        </button>
        <button onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </button>
      </div>

      {open && (
        <>
          {/* Barra de filtros */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white/4 border-b border-[rgba(255,255,255,0.07)] flex-wrap">
            {/* Filtros de status */}
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="w-3 h-3 text-white/30 shrink-0" />
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatus(f.value)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap',
                    statusFilter === f.value
                      ? 'bg-beacon-primary text-white border-beacon-primary'
                      : 'border-[rgba(255,255,255,0.07)] text-white/50 hover:border-[rgba(255,255,255,0.15)]',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Busca */}
            <div className="flex items-center gap-1.5 ml-auto border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-1 bg-beacon-surface">
              <Search className="w-3 h-3 text-white/30" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar contato ou telefone…"
                className="text-[11px] outline-none w-44 placeholder:text-white/25 bg-transparent text-white/85"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); setSearch('') }} className="text-white/30 hover:text-white/50">
                  <XCircle className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="grid text-[10px] font-semibold text-white/40 uppercase tracking-wide px-4 py-2 bg-white/4 border-b border-[rgba(255,255,255,0.07)] items-center grid-cols-[8px_100px_160px_160px_1fr_110px_70px_100px]">
            <span />
            <span>Quando</span>
            <span>Canal</span>
            <span>Contato</span>
            <span>Mensagem</span>
            <span>Status</span>
            <span className="text-right">Latência</span>
            <span />
          </div>

          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <Activity className="w-8 h-8 text-white/20" />
              <p className="text-xs text-white/40">
                {search || statusFilter !== 'all'
                  ? 'Nenhum resultado para os filtros selecionados.'
                  : 'Nenhuma execução registrada ainda. Envie uma mensagem para o canal.'
                }
              </p>
              {(search || statusFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setSearchInput(''); setStatus('all') }}
                  className="text-[11px] text-beacon-primary hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div>
              {logs.map((log) => <LogRow key={log.id} log={log} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ChatIaPage() {
  const { data: items = [], isLoading } = useChatIaList()
  const { data: agents }                = useAgents()
  const { data: channels }              = useChannels()
  const createMut                       = useCreateChatIa()
  const { toast }                       = useToast()
  const [showCreate, setShowCreate]     = useState(false)

  const agentList   = (agents   ?? []).map((a) => ({ id: a.id, name: a.name }))
  const channelList = (channels ?? []).map((c) => ({ id: c.id, name: c.name }))

  const handleCreate = (values: SubmitPayload) => {
    createMut.mutate(values, {
      onSuccess: () => {
        toast({ type: 'success', title: 'Configuração criada com sucesso' })
        setShowCreate(false)
      },
      onError: () => toast({ type: 'error', title: 'Erro ao criar configuração' }),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-beacon-primary" />
            Chat IA
          </h2>
          <p className="text-sm text-white/50 mt-0.5">
            Vincule um canal a um agente e modelo LLM para IA conversacional em tempo real.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Nova Config
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-card bg-white/8 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-white/8 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-white/40" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nenhuma configuração ainda</p>
            <p className="text-xs text-white/50 mt-1">
              Crie uma configuração para ativar a IA conversacional em um canal
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Nova Config
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ChannelAgentCard
              key={item.id}
              item={item}
              agents={agentList}
              channels={channelList}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nova Configuração Chat IA"
        description="Vincule um canal a um agente e modelo LLM"
        size="md"
      >
        <ChatIaForm
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={createMut.isPending}
        />
      </Modal>

      {/* Execution log panel */}
      <IngestionLogsPanel />
    </div>
  )
}
