/**
 * AiProvidersPage — Gestão de provedores de API de IA
 * Cards por provedor com toggle ativo/inativo e modal de criação
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Bot, ToggleLeft, ToggleRight, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import {
  useAiProviders, useCreateAiProvider, useUpdateAiProvider, useDeleteAiProvider,
} from '../hooks/useSettings'
import type { AiProviderType, CreateAiProviderPayload } from '@/services/settings'
import { cn } from '@/lib/utils'

const PROVIDER_META: Record<AiProviderType, { label: string; color: string; placeholder: string }> = {
  ANTHROPIC:         { label: 'Anthropic',   color: 'bg-orange-100 text-orange-700', placeholder: 'sk-ant-...' },
  OPENAI:            { label: 'OpenAI',      color: 'bg-green-100 text-green-700',   placeholder: 'sk-...' },
  GROQ:              { label: 'Groq',        color: 'bg-purple-100 text-purple-700', placeholder: 'gsk_...' },
  OPENAI_COMPATIBLE: { label: 'Compatível',  color: 'bg-blue-100 text-blue-700',     placeholder: 'sua-chave...' },
}

function CreateProviderModal({ onClose }: { onClose: () => void }) {
  const { mutate, isPending } = useCreateAiProvider()
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<AiProviderType>('ANTHROPIC')

  const { register, handleSubmit, formState: { errors } } = useForm<CreateAiProviderPayload>()

  const onSubmit = handleSubmit((data) => {
    mutate({ ...data, type: selectedType }, {
      onSuccess: () => {
        toast({ type: 'success', title: 'Provedor criado com sucesso' })
        onClose()
      },
      onError: () => toast({ type: 'error', title: 'Erro ao criar provedor' }),
    })
  })

  return (
    <Modal open title="Adicionar Provedor de IA" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 w-96">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Tipo de provedor</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PROVIDER_META) as AiProviderType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left',
                  selectedType === type
                    ? 'border-beacon-primary bg-beacon-primary/5 text-beacon-primary'
                    : 'border-[rgba(255,255,255,0.07)] hover:border-beacon-primary/30',
                )}
              >
                {PROVIDER_META[type].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Nome do provedor</label>
          <input
            {...register('name', { required: true })}
            placeholder={`Ex: ${PROVIDER_META[selectedType].label} Produção`}
            className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Chave de API</label>
          <input
            type="password"
            {...register('apiKey', { required: true })}
            placeholder={PROVIDER_META[selectedType].placeholder}
            className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85 font-mono"
          />
          {errors.apiKey && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
        </div>

        {selectedType === 'OPENAI_COMPATIBLE' && (
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">URL base</label>
            <input
              {...register('baseUrl')}
              placeholder="https://api.seu-provedor.com/v1"
              className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85 font-mono"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Adicionar</Button>
        </div>
      </form>
    </Modal>
  )
}

export function AiProvidersPage() {
  const { data: providers = [], isLoading } = useAiProviders()
  const { mutate: updateProvider } = useUpdateAiProvider()
  const { mutate: deleteProvider, isPending: deleting } = useDeleteAiProvider()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toggleActive = (id: string, current: boolean) => {
    updateProvider({ id, data: { isActive: !current } }, {
      onSuccess: () => toast({ type: 'success', title: `Provedor ${current ? 'desativado' : 'ativado'}` }),
      onError: () => toast({ type: 'error', title: 'Erro ao atualizar provedor' }),
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    deleteProvider(id, {
      onSuccess: () => { toast({ type: 'success', title: 'Provedor removido' }); setDeletingId(null) },
      onError: () => { toast({ type: 'error', title: 'Erro ao remover provedor' }); setDeletingId(null) },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-white/8 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50">
            Configure as chaves de API dos provedores de IA. As chaves são armazenadas com segurança e nunca exibidas completamente.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 border-2 border-dashed border-[rgba(255,255,255,0.07)] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Nenhum provedor configurado</p>
            <p className="text-xs text-white/40 mt-1">Adicione um provedor de IA para usar nos agentes</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Adicionar provedor
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider.type as AiProviderType] ?? { label: provider.type, color: 'bg-gray-100 text-gray-700' }
            return (
              <div
                key={provider.id}
                className={cn(
                  'bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-4 flex items-center gap-4 transition-opacity',
                  !provider.isActive && 'opacity-60',
                )}
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-white/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white truncate">{provider.name}</span>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', meta.color)}>{meta.label}</span>
                    {!provider.isActive && <Badge variant="default" className="text-[10px]">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-white/40 font-mono">{provider.apiKey}</p>
                  {provider.baseUrl && (
                    <p className="text-xs text-white/50 mt-0.5 truncate">{provider.baseUrl}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(provider.id, provider.isActive)}
                    className="text-white/50 hover:text-beacon-primary transition-colors"
                    title={provider.isActive ? 'Desativar' : 'Ativar'}
                  >
                    {provider.isActive
                      ? <ToggleRight className="w-6 h-6 text-beacon-primary" />
                      : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    disabled={deleting && deletingId === provider.id}
                    className="text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateProviderModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
