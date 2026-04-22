/**
 * WebhooksPage — Gestão de webhooks de saída
 * Lista, criação, toggle ativo/inativo e botão "Testar"
 */

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Plus, Trash2, Webhook as WebhookIcon, Send, ToggleLeft, ToggleRight, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import {
  useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook, useTestWebhook,
} from '../hooks/useSettings'
import { WEBHOOK_EVENTS } from '@/services/settings'
import type { CreateWebhookPayload } from '@/services/settings'
import { cn } from '@/lib/utils'

function CreateWebhookModal({ onClose }: { onClose: () => void }) {
  const { mutate, isPending } = useCreateWebhook()
  const { toast } = useToast()

  const { register, handleSubmit, control, formState: { errors } } = useForm<CreateWebhookPayload & { eventMap: Record<string, boolean> }>()

  const onSubmit = handleSubmit((data) => {
    const events = WEBHOOK_EVENTS.filter((e) => data.eventMap?.[e.value]).map((e) => e.value)
    mutate({ name: data.name, url: data.url, events, secret: data.secret || undefined }, {
      onSuccess: () => {
        toast({ type: 'success', title: 'Webhook criado com sucesso' })
        onClose()
      },
      onError: () => toast({ type: 'error', title: 'Erro ao criar webhook' }),
    })
  })

  return (
    <Modal open title="Novo Webhook" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 w-[420px]">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Nome</label>
          <input
            {...register('name', { required: true })}
            placeholder="Ex: Notificações Slack"
            className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">URL</label>
          <input
            {...register('url', { required: true })}
            placeholder="https://hooks.slack.com/..."
            className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
          />
          {errors.url && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-2">Eventos</label>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {WEBHOOK_EVENTS.map((ev) => (
              <Controller
                key={ev.value}
                name={`eventMap.${ev.value}` as any}
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="w-4 h-4 accent-beacon-primary"
                    />
                    <span className="text-xs text-white group-hover:text-beacon-primary transition-colors">
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono mr-1">{ev.value}</code>
                      {ev.label}
                    </span>
                  </label>
                )}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">
            Secret HMAC <span className="text-white/40 font-normal">(opcional)</span>
          </label>
          <input
            {...register('secret')}
            type="password"
            placeholder="Chave secreta para assinar o payload"
            className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Criar webhook</Button>
        </div>
      </form>
    </Modal>
  )
}

export function WebhooksPage() {
  const { data: webhooks = [], isLoading } = useWebhooks()
  const { mutate: updateWebhook } = useUpdateWebhook()
  const { mutate: deleteWebhook } = useDeleteWebhook()
  const { mutate: testWebhook, isPending: testing } = useTestWebhook()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})

  const toggleActive = (id: string, current: boolean) => {
    updateWebhook({ id, data: { isActive: !current } }, {
      onSuccess: () => toast({ type: 'success', title: `Webhook ${current ? 'desativado' : 'ativado'}` }),
      onError: () => toast({ type: 'error', title: 'Erro ao atualizar webhook' }),
    })
  }

  const handleTest = (id: string) => {
    setTestingId(id)
    testWebhook(id, {
      onSuccess: (result) => {
        setTestResults((prev) => ({ ...prev, [id]: result }))
        toast({ type: result.ok ? 'success' : 'error', title: result.ok ? `Webhook respondeu: ${result.message}` : `Falha: ${result.message}` })
        setTestingId(null)
      },
      onError: () => { toast({ type: 'error', title: 'Erro ao testar webhook' }); setTestingId(null) },
    })
  }

  const handleDelete = (id: string) => {
    deleteWebhook(id, {
      onSuccess: () => toast({ type: 'success', title: 'Webhook removido' }),
      onError: () => toast({ type: 'error', title: 'Erro ao remover webhook' }),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-white/8 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">
          Receba notificações em sistemas externos quando eventos ocorrerem no VoxAI.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Novo webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 border-2 border-dashed border-[rgba(255,255,255,0.07)] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center">
            <WebhookIcon className="w-6 h-6 text-white/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Nenhum webhook configurado</p>
            <p className="text-xs text-white/40 mt-1">Envie eventos do VoxAI para sistemas externos</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Criar webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const testResult = testResults[wh.id]
            const events = wh.events as string[]
            return (
              <div
                key={wh.id}
                className={cn(
                  'bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-4 transition-opacity',
                  !wh.isActive && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <WebhookIcon className="w-4 h-4 text-white/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{wh.name}</span>
                      {!wh.isActive && (
                        <span className="text-[10px] bg-white/8 px-2 py-0.5 rounded-full text-white/50">Inativo</span>
                      )}
                      {testResult && (
                        <span className={cn(
                          'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium',
                          testResult.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                        )}>
                          {testResult.ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {testResult.message}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-white/50 truncate mb-2">{wh.url}</p>
                    <div className="flex flex-wrap gap-1">
                      {events.map((ev) => (
                        <code key={ev} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">{ev}</code>
                      ))}
                    </div>
                    {wh.lastTriggeredAt && (
                      <p className="text-[10px] text-white/40 mt-1.5">
                        Último disparo: {new Date(wh.lastTriggeredAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={testing && testingId === wh.id}
                      onClick={() => handleTest(wh.id)}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Testar
                    </Button>
                    <button
                      onClick={() => toggleActive(wh.id, wh.isActive)}
                      className="text-white/50 hover:text-beacon-primary transition-colors"
                      title={wh.isActive ? 'Desativar' : 'Ativar'}
                    >
                      {wh.isActive
                        ? <ToggleRight className="w-6 h-6 text-beacon-primary" />
                        : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={() => handleDelete(wh.id)}
                      className="text-white/30 hover:text-red-400 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateWebhookModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
