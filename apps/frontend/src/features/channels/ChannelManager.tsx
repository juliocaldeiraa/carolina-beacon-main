/**
 * ChannelManager — Gerenciamento de canais de mensagem
 *
 * Exibe cards por canal com status de conexão (CONNECTED/DISCONNECTED/BLOCKED/UNKNOWN)
 * Polling automático a cada 30s via react-query refetchInterval
 * Modal de criação com form dinâmico por tipo de provedor
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Smartphone, Plus, RefreshCw, Trash2,
  Wifi, WifiOff, AlertTriangle, HelpCircle,
  MessageCircle, Send, Phone, Bot, Instagram,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useChannels, useCreateChannel, useDeleteChannel, useCheckChannel } from './hooks/useChannels'
import { cn } from '@/lib/utils'
import type { Channel, ChannelType, ChannelStatus } from '@/types/channel'

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ChannelStatus, {
  label: string
  badgeVariant: 'active' | 'error' | 'draft' | 'default'
  icon: React.ElementType
  iconClass: string
}> = {
  CONNECTED:    { label: 'Conectado',    badgeVariant: 'active',  icon: Wifi,          iconClass: 'text-green-500' },
  DISCONNECTED: { label: 'Desconectado', badgeVariant: 'default', icon: WifiOff,        iconClass: 'text-white/35' },
  BLOCKED:      { label: 'Bloqueado',    badgeVariant: 'error',   icon: AlertTriangle,  iconClass: 'text-red-500' },
  UNKNOWN:      { label: 'Desconhecido', badgeVariant: 'draft',   icon: HelpCircle,     iconClass: 'text-white/35' },
}

const TYPE_CONFIG: Record<ChannelType, { label: string; icon: React.ElementType; color: string }> = {
  EVOLUTION_API:     { label: 'Evolution API',      icon: MessageCircle, color: 'text-green-600' },
  ZAPI:              { label: 'Z-API',               icon: Send,          color: 'text-blue-600' },
  WHATSAPP_OFFICIAL: { label: 'WhatsApp Oficial',   icon: Phone,         color: 'text-green-600' },
  TELEGRAM:          { label: 'Telegram',            icon: Bot,           color: 'text-blue-500' },
  INSTAGRAM:         { label: 'Instagram',           icon: Instagram,     color: 'text-pink-500' },
}

// ─── Channel Card ──────────────────────────────────────────────────────────────

function ChannelCard({ channel }: { channel: Channel }) {
  const { mutate: check, isPending: checking } = useCheckChannel()
  const { mutate: remove, isPending: removing } = useDeleteChannel()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const status = STATUS_CONFIG[channel.status]
  const type   = TYPE_CONFIG[channel.type]
  const StatusIcon = status.icon
  const TypeIcon   = type.icon

  const lastChecked = channel.lastCheckedAt
    ? (() => {
        const diff = Math.round((Date.now() - new Date(channel.lastCheckedAt).getTime()) / 60_000)
        if (diff < 1)  return 'agora'
        if (diff === 1) return '1 min atrás'
        return `${diff} min atrás`
      })()
    : 'nunca'

  return (
    <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
            <TypeIcon className={cn('w-5 h-5', type.color)} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{channel.name}</h3>
            <p className="text-xs text-white/50">{type.label}</p>
          </div>
        </div>
        <Badge variant={status.badgeVariant} className="shrink-0 flex items-center gap-1">
          <StatusIcon className={cn('w-3 h-3', status.iconClass)} aria-hidden="true" />
          {status.label}
        </Badge>
      </div>

      {/* Info */}
      <div className="space-y-1 mb-4 text-xs text-white/50">
        {channel.phoneNumber && (
          <p><span className="font-medium text-white">Número:</span> {channel.phoneNumber}</p>
        )}
        <p><span className="font-medium text-white">Última verificação:</span> {lastChecked}</p>
        {channel.blockedAt && (
          <p className="text-red-500">
            Bloqueado em {new Date(channel.blockedAt).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)} className="flex-1">
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={removing}
            onClick={() => remove(channel.id)}
            className="flex-1 !bg-red-500 hover:!bg-red-600"
          >
            Confirmar
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => check(channel.id)}
            loading={checking}
            className="flex-1"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Verificar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            className="text-red-400 hover:bg-red-500/10"
            aria-label={`Remover canal ${channel.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Channel Form (modal) ──────────────────────────────────────────────────────

const PROVIDER_FIELDS: Record<ChannelType, { field: string; label: string; placeholder: string }[]> = {
  EVOLUTION_API: [
    { field: 'instanceUrl',  label: 'URL da Instância',  placeholder: 'https://api.evolution.com' },
    { field: 'instanceName', label: 'Nome da Instância', placeholder: 'minha-instancia' },
    { field: 'apiKey',       label: 'API Key',            placeholder: 'seu-api-key' },
  ],
  ZAPI: [
    { field: 'instanceId', label: 'Instance ID', placeholder: 'seu-instance-id' },
    { field: 'token',      label: 'Token',       placeholder: 'seu-token' },
  ],
  WHATSAPP_OFFICIAL: [
    { field: 'phoneNumberId', label: 'Phone Number ID', placeholder: '123456789012345' },
    { field: 'accessToken',   label: 'Access Token',    placeholder: 'EAAxxxxx...' },
  ],
  TELEGRAM: [
    { field: 'botToken', label: 'Bot Token', placeholder: '123456789:ABCdefgh...' },
  ],
  INSTAGRAM: [
    { field: 'accessToken', label: 'Access Token', placeholder: 'EAAxxxxx...' },
    { field: 'pageId',      label: 'Page ID',       placeholder: 'seu-page-id' },
  ],
}

const schema = z.object({
  name:        z.string().min(2, 'Mínimo 2 caracteres'),
  type:        z.enum(['EVOLUTION_API', 'ZAPI', 'WHATSAPP_OFFICIAL', 'TELEGRAM', 'INSTAGRAM']),
  phoneNumber: z.string().optional(),
  config:      z.record(z.string()).default({}),
})

type FormValues = z.infer<typeof schema>

function ChannelForm({ onClose }: { onClose: () => void }) {
  const { mutate: create, isPending } = useCreateChannel()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'EVOLUTION_API', config: {} },
  })

  const selectedType = watch('type')
  const fields = PROVIDER_FIELDS[selectedType] ?? []

  function onSubmit(values: FormValues) {
    create(
      {
        name:        values.name,
        type:        values.type,
        phoneNumber: values.phoneNumber || undefined,
        config:      values.config ?? {},
      },
      { onSuccess: onClose },
    )
  }

  const labelClass = 'block text-xs font-medium text-white/70 mb-1'
  const inputClass = cn(
    'w-full text-sm text-white/85 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2',
    'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]',
    'placeholder:text-white/25',
  )
  const errorClass = 'text-xs text-red-500 mt-1'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nome */}
      <div>
        <label htmlFor="ch-name" className={labelClass}>Nome do canal *</label>
        <input
          id="ch-name"
          {...register('name')}
          className={inputClass}
          placeholder="Ex: WhatsApp Suporte"
        />
        {errors.name && <p className={errorClass}>{errors.name.message}</p>}
      </div>

      {/* Tipo */}
      <div>
        <label htmlFor="ch-type" className={labelClass}>Provedor *</label>
        <select id="ch-type" {...register('type')} className={inputClass}>
          {Object.entries(TYPE_CONFIG).map(([value, cfg]) => (
            <option key={value} value={value}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Número de telefone (opcional) */}
      <div>
        <label htmlFor="ch-phone" className={labelClass}>Número de telefone</label>
        <input
          id="ch-phone"
          {...register('phoneNumber')}
          className={inputClass}
          placeholder="+55 11 99999-9999"
        />
      </div>

      {/* Campos dinâmicos por provedor */}
      {fields.map((f) => (
        <div key={f.field}>
          <label htmlFor={`ch-${f.field}`} className={labelClass}>{f.label} *</label>
          <input
            id={`ch-${f.field}`}
            {...register(`config.${f.field}`)}
            className={inputClass}
            placeholder={f.placeholder}
            autoComplete="off"
          />
        </div>
      ))}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isPending}>
          Adicionar Canal
        </Button>
      </div>
    </form>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function ChannelManager() {
  const { data: channels, isLoading } = useChannels()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-beacon-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-white">
            {channels?.length ?? 0} canal{(channels?.length ?? 0) !== 1 ? 'is' : ''}
          </span>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Novo Canal
        </Button>
      </div>

      {/* Channel grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface p-5 space-y-3">
              <div className="flex gap-3">
                <div className="w-9 h-9 bg-white/8 rounded-lg animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-white/8 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-white/8 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-8 w-full bg-white/8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : channels?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-white/8 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-white/35" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nenhum canal cadastrado</p>
            <p className="text-xs text-white/40 mt-1">
              Conecte um número de WhatsApp, Telegram ou Instagram
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Adicionar Canal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels!.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Novo Canal"
        description="Conecte um número de WhatsApp, Telegram ou Instagram"
        size="lg"
      >
        <ChannelForm onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}
