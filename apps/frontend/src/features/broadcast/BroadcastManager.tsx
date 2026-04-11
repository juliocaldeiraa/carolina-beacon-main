/**
 * BroadcastManager — Gestão de campanhas de mensagens (anti-ban)
 *
 * - Lista de campanhas com status e progresso
 * - Formulário de criação com campos de timing randomizado anti-ban
 * - Lançamento via BullMQ (status muda para QUEUED → RUNNING → COMPLETED)
 * - Polling automático em campanhas ativas (3s)
 */

import { useState, useMemo }  from 'react'
import { useForm }             from 'react-hook-form'
import { zodResolver }         from '@hookform/resolvers/zod'
import { z }                   from 'zod'
import {
  Megaphone, Plus, Users, CheckCircle2, Clock, Loader2,
  XCircle, Play, FileText, Smartphone, Timer,
} from 'lucide-react'
import { Button }    from '@/components/ui/Button'
import { Badge }     from '@/components/ui/Badge'
import { Modal }     from '@/components/ui/Modal'
import { useChannels } from '@/features/channels/hooks/useChannels'
import {
  useBroadcasts,
  useCreateBroadcast,
  useLaunchBroadcast,
} from './hooks/useBroadcast'
import { cn } from '@/lib/utils'
import type { Broadcast, BroadcastStatus } from '@/types/broadcast'

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BroadcastStatus, {
  label: string
  badgeVariant: 'draft' | 'default' | 'active' | 'notification' | 'error'
  icon: React.ElementType
}> = {
  DRAFT:     { label: 'Rascunho',  badgeVariant: 'draft',         icon: FileText     },
  QUEUED:    { label: 'Na fila',   badgeVariant: 'default',       icon: Clock        },
  RUNNING:   { label: 'Enviando',  badgeVariant: 'notification',  icon: Loader2      },
  COMPLETED: { label: 'Concluída', badgeVariant: 'active',        icon: CheckCircle2 },
  FAILED:    { label: 'Falhou',    badgeVariant: 'error',         icon: XCircle      },
}

// ─── Campaign form schema ──────────────────────────────────────────────────────

const schema = z.object({
  name:                    z.string().min(3, 'Mínimo 3 caracteres'),
  channelId:               z.string().optional(),
  template:                z.string().min(10, 'Mínimo 10 caracteres'),
  contacts:                z.string().min(1, 'Adicione ao menos um contato'),
  messageDelayMinSeconds:  z.coerce.number().int().min(1).default(3),
  messageDelayMaxSeconds:  z.coerce.number().int().min(1).default(8),
  batchSizeMin:            z.coerce.number().int().min(1).default(20),
  batchSizeMax:            z.coerce.number().int().min(1).default(30),
  batchIntervalMinMinutes: z.coerce.number().int().min(1).default(30),
  batchIntervalMaxMinutes: z.coerce.number().int().min(1).default(45),
})
type FormValues = z.infer<typeof schema>

// ─── Campaign Card ──────────────────────────────────────────────────────────────

function CampaignCard({ campaign, channels }: {
  campaign: Broadcast
  channels: { id: string; name: string }[]
}) {
  const { mutate: launch, isPending: launching } = useLaunchBroadcast()
  const config       = STATUS_CONFIG[campaign.status]
  const StatusIcon   = config.icon
  const channelName  = campaign.channelId ? channels.find((c) => c.id === campaign.channelId)?.name : null
  const contactCount = campaign.audience.length

  return (
    <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{campaign.name}</h3>
          {channelName ? (
            <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
              <Smartphone className="w-3 h-3" />
              {channelName}
            </p>
          ) : (
            <p className="text-xs text-white/30 mt-0.5">Sem canal (simulação)</p>
          )}
        </div>
        <Badge variant={config.badgeVariant} className="shrink-0 flex items-center gap-1">
          <StatusIcon
            className={cn('w-3 h-3', campaign.status === 'RUNNING' && 'animate-spin')}
            aria-hidden="true"
          />
          {config.label}
        </Badge>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          {contactCount} contato{contactCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Timer className="w-3.5 h-3.5" />
          {campaign.messageDelayMinSeconds}–{campaign.messageDelayMaxSeconds}s
        </span>
        {campaign.sentAt ? (
          <span className="flex items-center gap-1 ml-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
            {new Date(campaign.sentAt).toLocaleDateString('pt-BR')}
          </span>
        ) : (
          <span className="text-white/30 ml-auto">
            {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      {/* Progress bar for RUNNING/QUEUED */}
      {(campaign.status === 'RUNNING' || campaign.status === 'QUEUED') && (
        <div
          className="w-full h-1.5 bg-white/12 rounded-full overflow-hidden mb-4"
          role="progressbar"
          aria-label="Progresso do envio"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={campaign.status === 'QUEUED' ? 0 : 50}
        >
          <div
            className={cn(
              'h-full rounded-full bg-beacon-primary',
              campaign.status === 'RUNNING' && 'animate-pulse',
            )}
            style={{ width: campaign.status === 'QUEUED' ? '5%' : '60%' }}
          />
        </div>
      )}

      {/* Launch button for DRAFT */}
      {campaign.status === 'DRAFT' && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => launch(campaign.id)}
          loading={launching}
          className="w-full"
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          Lançar Campanha
        </Button>
      )}
    </div>
  )
}

// ─── Range input pair ──────────────────────────────────────────────────────────

function RangePair({
  label, minName, maxName, register, unit,
}: {
  label: string
  minName: keyof FormValues
  maxName: keyof FormValues
  register: ReturnType<typeof useForm<FormValues>>['register']
  unit: string
}) {
  const inputClass = 'w-20 text-sm border border-[rgba(255,255,255,0.08)] rounded-lg bg-beacon-surface text-white/85 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-beacon-primary/30'
  return (
    <div>
      <label className="block text-xs font-medium text-white/70 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" min={1} {...register(minName)} className={inputClass} placeholder="min" />
        <span className="text-xs text-white/40">até</span>
        <input type="number" min={1} {...register(maxName)} className={inputClass} placeholder="max" />
        <span className="text-xs text-white/50">{unit}</span>
      </div>
    </div>
  )
}

// ─── Campaign Form (modal) ──────────────────────────────────────────────────────

function CampaignForm({ onClose }: { onClose: () => void }) {
  const { data: channels = [] }       = useChannels()
  const { mutate: create, isPending } = useCreateBroadcast()
  const connectedChannels = channels.filter((c) => c.status === 'CONNECTED')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      messageDelayMinSeconds:  3,
      messageDelayMaxSeconds:  8,
      batchSizeMin:            20,
      batchSizeMax:            30,
      batchIntervalMinMinutes: 30,
      batchIntervalMaxMinutes: 45,
    },
  })

  const contacts    = watch('contacts') ?? ''
  const contactList = contacts.split('\n').map((c) => c.trim()).filter(Boolean)

  function onSubmit(values: FormValues) {
    create(
      {
        name:                    values.name,
        channelId:               values.channelId || undefined,
        template:                values.template,
        audience:                values.contacts.split('\n').map((c) => c.trim()).filter(Boolean),
        messageDelayMinSeconds:  values.messageDelayMinSeconds,
        messageDelayMaxSeconds:  values.messageDelayMaxSeconds,
        batchSizeMin:            values.batchSizeMin,
        batchSizeMax:            values.batchSizeMax,
        batchIntervalMinMinutes: values.batchIntervalMinMinutes,
        batchIntervalMaxMinutes: values.batchIntervalMaxMinutes,
      },
      { onSuccess: onClose },
    )
  }

  const labelClass = 'block text-xs font-medium text-white/70 mb-1'
  const inputClass = cn(
    'w-full text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 bg-beacon-surface text-white/85',
    'focus:outline-none focus:ring-2 focus:ring-beacon-primary/30',
    'placeholder:text-white/25',
  )
  const errorClass = 'text-xs text-red-500 mt-1'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
      {/* Nome */}
      <div>
        <label htmlFor="bc-name" className={labelClass}>Nome da Campanha *</label>
        <input id="bc-name" {...register('name')} className={inputClass} placeholder="Ex: Black Friday 2025" />
        {errors.name && <p className={errorClass}>{errors.name.message}</p>}
      </div>

      {/* Canal de envio */}
      <div>
        <label htmlFor="bc-channel" className={labelClass}>
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            Canal de Envio
          </span>
        </label>
        <select id="bc-channel" {...register('channelId')} className={inputClass}>
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

      {/* Template */}
      <div>
        <label htmlFor="bc-template" className={labelClass}>Mensagem Template *</label>
        <p className="text-[10px] text-white/40 mb-1">Use {'{nome}'} para incluir o nome do contato.</p>
        <textarea
          id="bc-template"
          {...register('template')}
          rows={3}
          className={cn(inputClass, 'resize-none')}
          placeholder="Olá {nome}, temos uma oferta especial para você!"
        />
        {errors.template && <p className={errorClass}>{errors.template.message}</p>}
      </div>

      {/* Contatos */}
      <div>
        <label htmlFor="bc-contacts" className={labelClass}>
          Contatos * — um por linha, formato: <code className="text-beacon-primary">nome|55119...</code>
        </label>
        <textarea
          id="bc-contacts"
          {...register('contacts')}
          rows={4}
          className={cn(inputClass, 'resize-none font-mono text-xs')}
          placeholder={'Maria|5511999990001\nJoão|5511999990002'}
        />
        <p className="text-[10px] text-white/40 mt-1">
          {contactList.length} contato{contactList.length !== 1 ? 's' : ''} reconhecido{contactList.length !== 1 ? 's' : ''}
        </p>
        {errors.contacts && <p className={errorClass}>{errors.contacts.message}</p>}
      </div>

      {/* Timing anti-ban */}
      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/4 p-4 space-y-3">
        <p className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-beacon-primary" />
          Configurações Anti-ban
        </p>
        <RangePair
          label="Intervalo entre mensagens"
          minName="messageDelayMinSeconds"
          maxName="messageDelayMaxSeconds"
          register={register}
          unit="segundos"
        />
        <RangePair
          label="Tamanho do lote"
          minName="batchSizeMin"
          maxName="batchSizeMax"
          register={register}
          unit="contatos"
        />
        <RangePair
          label="Intervalo entre lotes"
          minName="batchIntervalMinMinutes"
          maxName="batchIntervalMaxMinutes"
          register={register}
          unit="minutos"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isPending}>
          Criar Campanha
        </Button>
      </div>
    </form>
  )
}

// ─── Filter tabs ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | BroadcastStatus

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all',       label: 'Todas'     },
  { value: 'DRAFT',     label: 'Rascunho'  },
  { value: 'QUEUED',    label: 'Na fila'   },
  { value: 'RUNNING',   label: 'Enviando'  },
  { value: 'COMPLETED', label: 'Concluída' },
  { value: 'FAILED',    label: 'Falhou'    },
]

// ─── Main component ─────────────────────────────────────────────────────────────

export function BroadcastManager() {
  const { data: broadcasts, isLoading } = useBroadcasts()
  const { data: channels = [] }         = useChannels()
  const [showForm, setShowForm]         = useState(false)
  const [filter, setFilter]             = useState<FilterTab>('all')

  const channelList = useMemo(
    () => channels.map((c) => ({ id: c.id, name: c.name })),
    [channels],
  )

  const filtered = useMemo(
    () => (broadcasts ?? []).filter((b) => filter === 'all' || b.status === filter),
    [broadcasts, filter],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-beacon-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-white">
            {broadcasts?.length ?? 0} campanha{(broadcasts?.length ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nova Campanha
        </Button>
      </div>

      {/* Filter tabs */}
      <nav
        role="tablist"
        aria-label="Filtrar campanhas por status"
        className="flex gap-1 bg-white/6 p-1 rounded-lg w-fit"
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={filter === tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              filter === tab.value
                ? 'bg-beacon-surface-2 text-white shadow-sm'
                : 'text-white/50 hover:text-white',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface p-5 space-y-3">
              <div className="h-4 w-36 bg-white/8 rounded animate-pulse" />
              <div className="h-3 w-24 bg-white/8 rounded animate-pulse" />
              <div className="h-8 w-full bg-white/8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-white/8 flex items-center justify-center">
            <Megaphone className="w-8 h-8 text-white/35" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {filter === 'all' ? 'Nenhuma campanha ainda' : `Nenhuma campanha ${TABS.find((t) => t.value === filter)?.label.toLowerCase()}`}
            </p>
            {filter === 'all' && (
              <p className="text-xs text-white/40 mt-1">Crie sua primeira campanha de mensagens</p>
            )}
          </div>
          {filter === 'all' && (
            <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Nova Campanha
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} channels={channelList} />
          ))}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nova Campanha"
        description="Configure e lance sua campanha de mensagens"
        size="lg"
      >
        <CampaignForm onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}
