/**
 * AutomationsPage — Motor de disparo inteligente
 *
 * Lista automações em cards com toggle ATIVO/INATIVO inline.
 * Modal de criação com 3 seções: Configuração, Disparo, IA.
 */

import { useState }    from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm }     from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z }           from 'zod'
import {
  Zap, Plus, Send, MessageSquare, TrendingUp,
  Clock, Users, ToggleLeft, ToggleRight, Eye,
  PlusCircle, Trash2, Pencil,
} from 'lucide-react'
import { Button }    from '@/components/ui/Button'
import { Badge }     from '@/components/ui/Badge'
import { Modal }     from '@/components/ui/Modal'
import { useChannels } from '@/features/channels/hooks/useChannels'
import { useAgents }   from '@/features/agents/hooks/useAgents'
import {
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
} from './hooks/useAutomations'
import { cn } from '@/lib/utils'
import type { Automation } from '@/types/automation'

// ─── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name:                    z.string().min(3, 'Mínimo 3 caracteres'),
  channelId:               z.string().optional(),
  filterStatus:            z.string().min(1, 'Campo obrigatório'),
  minHoursAfterCapture:    z.coerce.number().min(0),
  startHour:               z.coerce.number().min(0).max(23),
  endHour:                 z.coerce.number().min(1).max(24),
  batchIntervalMinMinutes: z.coerce.number().min(1),
  batchIntervalMaxMinutes: z.coerce.number().min(1),
  batchSizeMin:            z.coerce.number().min(1).max(500),
  batchSizeMax:            z.coerce.number().min(1).max(500),
  linkedAgentId:           z.string().optional(),
  aiChannelId:             z.string().optional(),
  aiModel:                 z.string().optional(),
  dispatchDelayMinSec:     z.coerce.number().min(5).max(600).optional(),
  dispatchDelayMaxSec:     z.coerce.number().min(5).max(600).optional(),
})
type FormValues = z.infer<typeof schema>

// ─── Quick Edit Modal ──────────────────────────────────────────────────────────

function QuickEditModal({ automation, onClose }: { automation: Automation; onClose: () => void }) {
  const { data: channels = [] }             = useChannels()
  const { mutate: update, isPending }       = useUpdateAutomation()
  const allChannelsSorted                   = [
    ...channels.filter((c) => c.status === 'CONNECTED'),
    ...channels.filter((c) => c.status !== 'CONNECTED'),
  ]

  const [name,            setName]            = useState(automation.name)
  const [channelId,       setChannelId]       = useState(automation.channelId ?? '')
  const [filterStatus,    setFilterStatus]    = useState(automation.filterStatus)
  const [followupEnabled, setFollowupEnabled] = useState(automation.followupEnabled ?? true)
  const [templates,       setTemplates]       = useState<string[]>(
    automation.messageTemplates.length > 0
      ? automation.messageTemplates
      : automation.messageTemplate ? [automation.messageTemplate] : ['']
  )

  const labelClass = 'block text-xs font-medium text-white/70 mb-1'
  const inputClass = cn(
    'w-full text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 bg-beacon-surface text-white/85',
    'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]',
    'placeholder:text-white/25',
  )

  function addTemplate() {
    if (templates.length < 3) setTemplates((t) => [...t, ''])
  }

  function removeTemplate(i: number) {
    setTemplates((t) => t.filter((_, idx) => idx !== i))
  }

  function updateTemplate(i: number, value: string) {
    setTemplates((t) => t.map((v, idx) => (idx === i ? value : v)))
  }

  function handleSave() {
    const validTemplates = templates.filter((t) => t.trim().length > 0)
    update(
      {
        id: automation.id,
        payload: {
          name: name.trim() || automation.name,
          channelId: channelId || undefined,
          filterStatus: filterStatus.trim() || automation.filterStatus,
          messageTemplates: validTemplates,
          followupEnabled,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Nome da automação"
        />
      </div>

      <div>
        <label className={labelClass}>Canal WhatsApp</label>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inputClass}>
          <option value="">Sem canal (simulação)</option>
          {allChannelsSorted.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}{ch.status !== 'CONNECTED' ? ` (${ch.status === 'DISCONNECTED' ? 'desconectado' : 'offline'})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Filtro de Status do Lead</label>
        <input
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={inputClass}
          placeholder="ebook_enviado"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>
            Mensagens de Disparo
            <span className="ml-1 font-normal text-white/40">(até 3)</span>
          </label>
          {templates.length < 3 && (
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
        <div className="space-y-2">
          {templates.map((tpl, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                {templates.length > 1 && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-white/40 uppercase">Msg {i + 1}</span>
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
                )}
                <textarea
                  value={tpl}
                  onChange={(e) => updateTemplate(i, e.target.value)}
                  rows={3}
                  className={cn(inputClass, 'resize-none')}
                  placeholder="Olá {nome}! Temos algo especial para você…"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-1">Use {'{nome}'} para personalizar.</p>
      </div>

      {/* Follow-up toggle */}
      <div className="flex items-center justify-between py-2 border-t border-white/5">
        <div>
          <p className="text-xs font-medium text-white/70">Sequência de Follow-up</p>
          <p className="text-[10px] text-white/40">{followupEnabled ? 'Ativo — etapas serão disparadas' : 'Desativado — apenas disparo inicial'}</p>
        </div>
        <button
          type="button"
          onClick={() => setFollowupEnabled((v) => !v)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${followupEnabled ? 'bg-beacon-primary' : 'bg-white/15'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${followupEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} loading={isPending}>
          Salvar
        </Button>
      </div>
    </div>
  )
}

// ─── Automation Card ───────────────────────────────────────────────────────────

function AutomationCard({ automation, channelName }: {
  automation:  Automation
  channelName: string | null
}) {
  const navigate                                = useNavigate()
  const { mutate: update, isPending: toggling } = useUpdateAutomation()
  const isActive = automation.status === 'ACTIVE'
  const [editOpen, setEditOpen] = useState(false)

  function toggleStatus() {
    update({ id: automation.id, payload: { status: isActive ? 'INACTIVE' : 'ACTIVE' } })
  }

  const convRate = automation.totalSent > 0
    ? Math.round((automation.totalConverted / automation.totalSent) * 100)
    : 0

  // Interval para exibição: usa minutos (novo) ou horas (legado)
  const intervalMs = automation.batchIntervalMinMinutes
    ? automation.batchIntervalMinMinutes * 60 * 1000
    : automation.batchIntervalHours * 60 * 60 * 1000

  const nextBatch = automation.lastBatchAt
    ? (() => {
        const next   = new Date(new Date(automation.lastBatchAt).getTime() + intervalMs)
        const diffMs = next.getTime() - Date.now()
        if (diffMs <= 0) return 'Em breve'
        const diffH   = Math.floor(diffMs / 3600000)
        const diffMin = Math.floor((diffMs % 3600000) / 60000)
        return diffH > 0 ? `em ${diffH}h ${diffMin}min` : `em ${diffMin}min`
      })()
    : 'Aguardando 1º lote'

  // Range de lote
  const batchDisplay = automation.batchSizeMin && automation.batchSizeMax
    ? `${automation.batchSizeMin}–${automation.batchSizeMax}`
    : `${automation.batchSize}`

  // Número de templates
  const tplCount = automation.messageTemplates.length || (automation.messageTemplate ? 1 : 0)

  return (
    <div className={cn(
      'bg-beacon-surface rounded-xl shadow-surface p-5 transition-all',
      isActive ? 'border-beacon-primary/30' : 'border-[rgba(255,255,255,0.07)]',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant={isActive ? 'active' : 'draft'} className="shrink-0">
              {isActive ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{automation.name}</h3>
          {channelName && (
            <p className="text-xs text-white/40 mt-0.5">Canal: {channelName}</p>
          )}
        </div>
        <button
          onClick={toggleStatus}
          disabled={toggling}
          aria-label={isActive ? 'Pausar automação' : 'Ativar automação'}
          className="shrink-0 text-white/40 hover:text-beacon-primary transition-colors disabled:opacity-50"
        >
          {isActive
            ? <ToggleRight className="w-6 h-6 text-beacon-primary" />
            : <ToggleLeft  className="w-6 h-6" />
          }
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-white/8">
          <div className="flex items-center justify-center gap-1 text-white/50 mb-0.5">
            <Send className="w-3 h-3" />
            <span className="text-[10px]">Enviados</span>
          </div>
          <p className="text-sm font-bold text-white">{automation.totalSent}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/8">
          <div className="flex items-center justify-center gap-1 text-white/50 mb-0.5">
            <MessageSquare className="w-3 h-3" />
            <span className="text-[10px]">Respostas</span>
          </div>
          <p className="text-sm font-bold text-white">{automation.totalReplied}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/8">
          <div className="flex items-center justify-center gap-1 text-white/50 mb-0.5">
            <TrendingUp className="w-3 h-3" />
            <span className="text-[10px]">Conversão</span>
          </div>
          <p className="text-sm font-bold text-white">{convRate}%</p>
        </div>
      </div>

      {/* Next batch + actions */}
      <div className="flex items-center justify-between gap-2 text-xs text-white/50">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Próximo: {nextBatch}
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {batchDisplay}
          </span>
          {tplCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] bg-white/8 px-1.5 py-0.5 rounded">
              <MessageSquare className="w-3 h-3" />
              {tplCount} msg{tplCount !== 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="text-xs h-7 px-2"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/vendedor/campanhas/${automation.id}`)}
            className="text-xs h-7 px-2"
          >
            <Eye className="w-3.5 h-3.5" />
            Detalhes
          </Button>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Editar: ${automation.name}`}
        size="lg"
      >
        <QuickEditModal automation={automation} onClose={() => setEditOpen(false)} />
      </Modal>
    </div>
  )
}

// ─── Create Form (modal) ───────────────────────────────────────────────────────

function AutomationForm({ onClose }: { onClose: () => void }) {
  const { data: channels = [] }       = useChannels()
  const { data: agents   = [] }       = useAgents()
  const { mutate: create, isPending } = useCreateAutomation()
  const connectedChannels             = channels.filter((c) => c.status === 'CONNECTED')
  // Apenas agentes ATIVOS podem ser vinculados a automações de disparo
  const ativoAgents                   = agents.filter((a) => !a.agentType || a.agentType === 'ATIVO')
  const [section, setSection]         = useState<'config' | 'dispatch' | 'ai'>('config')

  // Templates gerenciados fora do react-hook-form (array dinâmico)
  const [templates, setTemplates] = useState<string[]>([''])

  const {
    register, handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      filterStatus:            'ebook_enviado',
      minHoursAfterCapture:    12,
      startHour:               6,
      endHour:                 21,
      batchIntervalMinMinutes: 120,
      batchIntervalMaxMinutes: 135,
      batchSizeMin:            25,
      batchSizeMax:            35,
      dispatchDelayMinSec:     80,
      dispatchDelayMaxSec:     160,
    },
  })

  function addTemplate() {
    if (templates.length < 3) setTemplates((t) => [...t, ''])
  }

  function removeTemplate(i: number) {
    setTemplates((t) => t.filter((_, idx) => idx !== i))
  }

  function updateTemplate(i: number, value: string) {
    setTemplates((t) => t.map((v, idx) => (idx === i ? value : v)))
  }

  function onSubmit(values: FormValues) {
    const validTemplates = templates.filter((t) => t.trim().length > 0)
    create(
      {
        name:                    values.name,
        channelId:               values.channelId || undefined,
        filterStatus:            values.filterStatus,
        minHoursAfterCapture:    values.minHoursAfterCapture,
        messageTemplates:        validTemplates,
        startHour:               values.startHour,
        endHour:                 values.endHour,
        batchIntervalMinMinutes: values.batchIntervalMinMinutes,
        batchIntervalMaxMinutes: values.batchIntervalMaxMinutes,
        batchSizeMin:            values.batchSizeMin,
        batchSizeMax:            values.batchSizeMax,
        linkedAgentId:           values.linkedAgentId || undefined,
        aiChannelId:             values.aiChannelId   || undefined,
        aiModel:                 values.aiModel       || undefined,
        dispatchDelayMinMs:      values.dispatchDelayMinSec ? values.dispatchDelayMinSec * 1000 : null,
        dispatchDelayMaxMs:      values.dispatchDelayMaxSec ? values.dispatchDelayMaxSec * 1000 : null,
      },
      { onSuccess: onClose },
    )
  }

  const AVAILABLE_MODELS = [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Rápido)' },
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Equilibrado)' },
    { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6 (Máximo)' },
    { value: 'gpt-4o-mini',               label: 'GPT-4o Mini' },
    { value: 'gpt-4o',                    label: 'GPT-4o' },
  ]

  const labelClass = 'block text-xs font-medium text-white/70 mb-1'
  const inputClass = cn(
    'w-full text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 bg-beacon-surface text-white/85',
    'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]',
    'placeholder:text-white/25',
  )
  const errorClass = 'text-xs text-red-500 mt-1'

  const SECTIONS = [
    { key: 'config',   label: '1. Configuração' },
    { key: 'dispatch', label: '2. Disparo'       },
    { key: 'ai',       label: '3. IA'            },
  ] as const

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Section tabs */}
      <nav className="flex gap-1 bg-white/6 p-1 rounded-lg">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={cn(
              'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
              section === s.key
                ? 'bg-beacon-surface-2 text-white shadow-sm'
                : 'text-white/50 hover:text-white',
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Scrollable content */}
      <div className="overflow-y-auto max-h-[60vh] pr-1">

      {/* Section: Configuração */}
      {section === 'config' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="at-name" className={labelClass}>Nome *</label>
            <input
              id="at-name"
              {...register('name')}
              className={inputClass}
              placeholder="Ex: Follow-up Ebook Marketing"
            />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="at-channel" className={labelClass}>Canal WhatsApp</label>
            <select id="at-channel" {...register('channelId')} className={inputClass}>
              <option value="">Sem canal (simulação)</option>
              {connectedChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
            {connectedChannels.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">
                Nenhum canal conectado. Configure em <a href="/channels" className="underline">Canais</a>.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="at-filter" className={labelClass}>Status do Lead para Filtro *</label>
            <input
              id="at-filter"
              {...register('filterStatus')}
              className={inputClass}
              placeholder="ebook_enviado"
            />
            <p className="text-[10px] text-white/40 mt-1">
              Valor do campo <code>status</code> na tabela lead_many_insta
            </p>
            {errors.filterStatus && <p className={errorClass}>{errors.filterStatus.message}</p>}
          </div>

          <div>
            <label htmlFor="at-hours" className={labelClass}>Horas mínimas após captura *</label>
            <input
              id="at-hours"
              type="number"
              {...register('minHoursAfterCapture')}
              className={inputClass}
              min={0}
            />
            {errors.minHoursAfterCapture && <p className={errorClass}>{errors.minHoursAfterCapture.message}</p>}
          </div>
        </div>
      )}

      {/* Section: Disparo */}
      {section === 'dispatch' && (
        <div className="space-y-4">
          {/* Templates */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>
                Mensagens de Disparo *
                <span className="ml-1 font-normal text-white/40">(até 3, escolhida aleatoriamente)</span>
              </label>
              {templates.length < 3 && (
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
            <p className="text-[10px] text-white/40 mb-2">Use {'{nome}'} para personalizar com o nome do lead.</p>

            <div className="space-y-3">
              {templates.map((tpl, i) => (
                <div key={i} className="relative">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-white/40 uppercase">
                          Mensagem {i + 1}
                        </span>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => removeTemplate(i)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                            aria-label="Remover mensagem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={tpl}
                        onChange={(e) => updateTemplate(i, e.target.value)}
                        rows={3}
                        className={cn(inputClass, 'resize-none')}
                        placeholder={i === 0
                          ? 'Olá {nome}! Temos algo especial para você…'
                          : `Variação ${i + 1} — ex: Oi {nome}, vi que você baixou nosso material…`
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="at-start" className={labelClass}>Hora início (BRT) *</label>
              <input id="at-start" type="number" {...register('startHour')} className={inputClass} min={0} max={23} />
              {errors.startHour && <p className={errorClass}>{errors.startHour.message}</p>}
            </div>
            <div>
              <label htmlFor="at-end" className={labelClass}>Hora fim (BRT) *</label>
              <input id="at-end" type="number" {...register('endHour')} className={inputClass} min={1} max={24} />
              {errors.endHour && <p className={errorClass}>{errors.endHour.message}</p>}
            </div>
          </div>

          {/* Intervalo entre lotes (range em minutos) */}
          <div>
            <label className={labelClass}>Intervalo entre lotes (minutos) *</label>
            <p className="text-[10px] text-white/40 mb-1.5">Range randomizado a cada ciclo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="at-int-min" className="text-[10px] text-white/50 mb-1 block">Mínimo</label>
                <input
                  id="at-int-min"
                  type="number"
                  {...register('batchIntervalMinMinutes')}
                  className={inputClass}
                  min={1}
                  placeholder="120"
                />
                {errors.batchIntervalMinMinutes && (
                  <p className={errorClass}>{errors.batchIntervalMinMinutes.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="at-int-max" className="text-[10px] text-white/50 mb-1 block">Máximo</label>
                <input
                  id="at-int-max"
                  type="number"
                  {...register('batchIntervalMaxMinutes')}
                  className={inputClass}
                  min={1}
                  placeholder="135"
                />
                {errors.batchIntervalMaxMinutes && (
                  <p className={errorClass}>{errors.batchIntervalMaxMinutes.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tamanho do lote (range) */}
          <div>
            <label className={labelClass}>Tamanho do lote *</label>
            <p className="text-[10px] text-white/40 mb-1.5">Quantidade de leads por disparo (randomizada no range)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="at-size-min" className="text-[10px] text-white/50 mb-1 block">Mínimo</label>
                <input
                  id="at-size-min"
                  type="number"
                  {...register('batchSizeMin')}
                  className={inputClass}
                  min={1}
                  max={500}
                  placeholder="25"
                />
                {errors.batchSizeMin && <p className={errorClass}>{errors.batchSizeMin.message}</p>}
              </div>
              <div>
                <label htmlFor="at-size-max" className="text-[10px] text-white/50 mb-1 block">Máximo</label>
                <input
                  id="at-size-max"
                  type="number"
                  {...register('batchSizeMax')}
                  className={inputClass}
                  min={1}
                  max={500}
                  placeholder="35"
                />
                {errors.batchSizeMax && <p className={errorClass}>{errors.batchSizeMax.message}</p>}
              </div>
            </div>
          </div>

          {/* Delay entre disparos */}
          <div>
            <label className={labelClass}>Delay entre mensagens (segundos)</label>
            <p className="text-[10px] text-white/40 mb-1.5">Pausa aleatória entre cada envio individual — reduz risco de ban</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="at-delay-min" className="text-[10px] text-white/50 mb-1 block">Mínimo</label>
                <input
                  id="at-delay-min"
                  type="number"
                  {...register('dispatchDelayMinSec')}
                  className={inputClass}
                  min={5}
                  max={600}
                  placeholder="80"
                />
              </div>
              <div>
                <label htmlFor="at-delay-max" className="text-[10px] text-white/50 mb-1 block">Máximo</label>
                <input
                  id="at-delay-max"
                  type="number"
                  {...register('dispatchDelayMaxSec')}
                  className={inputClass}
                  min={5}
                  max={600}
                  placeholder="160"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section: IA */}
      {section === 'ai' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="at-agent" className={labelClass}>Agente de IA Conversacional</label>
            <p className="text-[10px] text-white/40 mb-2">
              Quando um lead responder ao disparo, este agente assumirá a conversa automaticamente.
              Somente agentes do tipo <strong>ATIVO</strong> podem ser usados em Vendedor.
            </p>
            <select id="at-agent" {...register('linkedAgentId')} className={inputClass}>
              <option value="">Nenhum (sem IA)</option>
              {ativoAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.description ? ` — ${agent.description}` : ''}
                </option>
              ))}
            </select>
            {ativoAgents.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">
                Nenhum agente ATIVO criado. Configure em{' '}
                <a href="/agents" className="underline">Agentes</a> e selecione o tipo "Ativo".
              </p>
            )}
          </div>



          <div>
            <label htmlFor="at-ai-channel" className={labelClass}>Canal de Resposta da IA</label>
            <p className="text-[10px] text-white/40 mb-1">Canal pelo qual a IA responderá. Se vazio, usa o mesmo canal do disparo.</p>
            <select id="at-ai-channel" {...register('aiChannelId')} className={inputClass}>
              <option value="">Mesmo canal do disparo</option>
              {connectedChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="at-ai-model" className={labelClass}>Modelo LLM da IA</label>
            <select id="at-ai-model" {...register('aiModel')} className={inputClass}>
              <option value="">Padrão (Claude Haiku 4.5)</option>
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white/6 rounded-lg p-3 border border-[rgba(255,255,255,0.08)] text-[11px] text-white/50 space-y-1">
            <p className="font-medium text-white text-xs">Como funciona</p>
            <p>• O lead recebe a mensagem de disparo</p>
            <p>• Quando responde, o agente + modelo selecionados assumem</p>
            <p>• Histórico mantido automaticamente por conversa</p>
            <p>• Encerra após 16 trocas ou ao enviar link de conversão</p>
          </div>
        </div>
      )}

      </div>{/* end scroll */}

      {/* Navigation + submit */}
      <div className="flex items-center justify-between pt-2 gap-3">
        <div className="flex gap-2">
          {section !== 'config' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSection(section === 'ai' ? 'dispatch' : 'config')}
            >
              Anterior
            </Button>
          )}
          {section !== 'ai' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSection(section === 'config' ? 'dispatch' : 'ai')}
            >
              Próximo
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          {section === 'ai' && (
            <Button type="submit" variant="primary" loading={isPending}>
              Criar Automação
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function AutomationsPage() {
  const { data: automations = [], isLoading } = useAutomations()
  const { data: channels = [] }               = useChannels()
  const [showForm, setShowForm]               = useState(false)

  const active   = automations.filter((a) => a.status === 'ACTIVE').length
  const inactive = automations.filter((a) => a.status === 'INACTIVE').length

  function getChannelName(channelId: string | null) {
    if (!channelId) return null
    return channels.find((c) => c.id === channelId)?.name ?? channelId
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-beacon-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-white">
              {active} ativa{active !== 1 ? 's' : ''}
            </span>
          </div>
          {inactive > 0 && (
            <span className="text-xs text-white/40">{inactive} inativa{inactive !== 1 ? 's' : ''}</span>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nova Automação
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface p-5 space-y-3">
              <div className="h-4 w-36 bg-white/8 rounded animate-pulse" />
              <div className="h-3 w-24 bg-white/8 rounded animate-pulse" />
              <div className="h-16 w-full bg-white/8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-white/8 flex items-center justify-center">
            <Zap className="w-8 h-8 text-white/35" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nenhuma automação criada</p>
            <p className="text-xs text-white/40 mt-1">
              Configure fluxos de disparo inteligente para seus leads
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Nova Automação
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              channelName={getChannelName(automation.channelId)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nova Automação"
        description="Configure o fluxo de disparo e IA para seus leads"
        size="lg"
      >
        <AutomationForm onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}
