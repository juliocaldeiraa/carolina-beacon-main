/**
 * CentralAiPage — Lista de configurações de IA Central
 *
 * Múltiplas configurações salvas; apenas uma ativa por vez.
 * Cada config vincula: nome, provedor, modelo e chave de API.
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Brain, Plus, Pencil, Trash2, CheckCircle, Circle,
  KeyRound, Cpu,
} from 'lucide-react'
import { Button }      from '@/components/ui/Button'
import { Badge }       from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { useToast }    from '@/components/ui/Toast'
import {
  useCentralAiList, useCreateCentralAi, useUpdateCentralAi,
  useDeleteCentralAi, useActivateCentralAi,
} from '../hooks/useSettings'
import { cn } from '@/lib/utils'
import type { CentralAiConfig, CentralAiProvider } from '@/services/settings'

// ─── Modelos por provedor ─────────────────────────────────────────────────────

const MODELS_BY_PROVIDER: Record<CentralAiProvider, { value: string; label: string }[]> = {
  ANTHROPIC: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Rápido)' },
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Equilibrado)' },
  ],
  OPENAI: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Rápido)' },
    { value: 'gpt-4o',      label: 'GPT-4o (Avançado)' },
  ],
  GOOGLE: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Rápido)' },
    { value: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro (Avançado)' },
  ],
}

const PROVIDER_LABELS: Record<CentralAiProvider, string> = {
  ANTHROPIC: 'Anthropic',
  OPENAI:    'OpenAI',
  GOOGLE:    'Google',
}

const ALL_PROVIDERS: CentralAiProvider[] = ['ANTHROPIC', 'OPENAI', 'GOOGLE']

// ─── Form ────────────────────────────────────────────────────────────────────

type FormValues = { name: string; provider: CentralAiProvider; model: string; apiKey: string }

function CentralAiForm({
  defaultValues,
  isEdit,
  onClose,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<FormValues>
  isEdit?: boolean
  onClose:   () => void
  onSubmit:  (v: FormValues) => void
  isPending: boolean
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name:     defaultValues?.name     ?? '',
      provider: defaultValues?.provider ?? 'ANTHROPIC',
      model:    defaultValues?.model    ?? MODELS_BY_PROVIDER.ANTHROPIC[0].value,
      apiKey:   defaultValues?.apiKey   ?? '',
    },
  })

  const provider = watch('provider')

  const handleProviderChange = (p: CentralAiProvider) => {
    setValue('provider', p)
    setValue('model', MODELS_BY_PROVIDER[p][0].value)
  }

  const inputCls = 'w-full text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nome */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">
          Nome da configuração *
        </label>
        <input
          {...register('name', { required: 'Nome obrigatório' })}
          className={inputCls}
          placeholder="Ex: OpenAI Principal"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* Provedor */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1.5">Provedor *</label>
        <div className="grid grid-cols-3 gap-2">
          {ALL_PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              className={cn(
                'py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all',
                provider === p
                  ? 'border-beacon-primary bg-beacon-primary/10 text-beacon-primary'
                  : 'border-[rgba(255,255,255,0.07)] bg-beacon-surface text-white/50 hover:border-[rgba(255,255,255,0.15)]',
              )}
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Modelo */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">
          <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Modelo *</span>
        </label>
        <select {...register('model')} className={inputCls}>
          {MODELS_BY_PROVIDER[provider].map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Chave de API */}
      <div>
        <label className="block text-xs font-medium text-white/70 mb-1">
          <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Chave de API {!isEdit && '*'}</span>
        </label>
        <input
          type="password"
          {...register('apiKey', { required: isEdit ? false : 'Chave obrigatória' })}
          className={cn(inputCls, errors.apiKey && 'border-red-400')}
          placeholder={isEdit ? 'Deixe em branco para manter a atual' : 'sk-...'}
        />
        {errors.apiKey && <p className="text-xs text-red-500 mt-1">{errors.apiKey.message}</p>}
      </div>

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

// ─── Card ────────────────────────────────────────────────────────────────────

function CentralAiCard({ item }: { item: CentralAiConfig }) {
  const { toast }  = useToast()
  const updateMut  = useUpdateCentralAi()
  const deleteMut  = useDeleteCentralAi()
  const activateMut = useActivateCentralAi()
  const [editOpen, setEditOpen]     = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const modelLabel = [
    ...MODELS_BY_PROVIDER.ANTHROPIC,
    ...MODELS_BY_PROVIDER.OPENAI,
    ...MODELS_BY_PROVIDER.GOOGLE,
  ].find((m) => m.value === item.model)?.label ?? item.model

  const handleActivate = () => {
    activateMut.mutate(item.id, {
      onSuccess: () => toast({ type: 'success', title: `"${item.name}" definida como ativa` }),
      onError:   () => toast({ type: 'error',   title: 'Erro ao ativar configuração' }),
    })
  }

  const handleEdit = (values: FormValues) => {
    updateMut.mutate(
      { id: item.id, data: { ...values, apiKey: values.apiKey || undefined } },
      {
        onSuccess: () => { toast({ type: 'success', title: 'Configuração atualizada' }); setEditOpen(false) },
        onError:   () => toast({ type: 'error', title: 'Erro ao atualizar' }),
      },
    )
  }

  const handleDelete = () => {
    deleteMut.mutate(item.id, {
      onSuccess: () => { toast({ type: 'success', title: 'Configuração removida' }); setDeleteOpen(false) },
      onError:   () => toast({ type: 'error', title: 'Erro ao remover' }),
    })
  }

  return (
    <>
      <div className={cn(
        'bg-beacon-surface rounded-xl border shadow-card p-4 transition-all',
        item.isActive ? 'border-beacon-primary ring-1 ring-beacon-primary/20' : 'border-[rgba(255,255,255,0.07)]',
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">{item.name}</h3>
              {item.isActive && (
                <Badge variant="active" className="text-[10px] shrink-0">Ativa</Badge>
              )}
            </div>
            <p className="text-xs text-white/40 mt-0.5">{PROVIDER_LABELS[item.provider as CentralAiProvider]}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!item.isActive && (
              <button
                onClick={handleActivate}
                disabled={activateMut.isPending}
                className="p-1.5 rounded-lg text-white/40 hover:bg-green-50 hover:text-green-600 transition-colors"
                title="Definir como ativa"
              >
                <Circle className="w-4 h-4" />
              </button>
            )}
            {item.isActive && (
              <div className="p-1.5 text-beacon-primary" title="Configuração ativa">
                <CheckCircle className="w-4 h-4" />
              </div>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="p-1.5 rounded-lg text-white/40 hover:bg-white/8 hover:text-white transition-colors"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="p-1.5 rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Detalhe */}
        <dl className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <dt className="text-white/40 w-14 shrink-0">Modelo</dt>
            <dd className="text-white font-medium truncate">{modelLabel}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-white/40 w-14 shrink-0">API Key</dt>
            <dd className="text-white/40 font-mono">••••••••••••</dd>
          </div>
        </dl>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Configuração" size="md">
        <CentralAiForm
          defaultValues={{ name: item.name, provider: item.provider as CentralAiProvider, model: item.model }}
          isEdit
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CentralAiPage() {
  const { data: items = [], isLoading } = useCentralAiList()
  const createMut  = useCreateCentralAi()
  const { toast }  = useToast()
  const [showCreate, setShowCreate] = useState(false)

  const handleCreate = (values: FormValues) => {
    createMut.mutate(
      { name: values.name, provider: values.provider, model: values.model, apiKey: values.apiKey },
      {
        onSuccess: () => { toast({ type: 'success', title: 'Configuração criada' }); setShowCreate(false) },
        onError:   () => toast({ type: 'error', title: 'Erro ao criar configuração' }),
      },
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-beacon-primary" />
            IA Central
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Configure as IAs auxiliares para transcrição, processamento e humanização.
            Apenas uma configuração fica ativa por vez.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Nova Config
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white/8 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border-2 border-dashed border-[rgba(255,255,255,0.07)] rounded-xl">
          <div className="w-14 h-14 rounded-full bg-white/8 flex items-center justify-center">
            <Brain className="w-7 h-7 text-white/40" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nenhuma configuração ainda</p>
            <p className="text-xs text-white/50 mt-1">Crie uma configuração de IA Central para começar</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Nova Config
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <CentralAiCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nova Configuração IA Central"
        description="Adicione uma IA auxiliar para tarefas de background"
        size="md"
      >
        <CentralAiForm
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={createMut.isPending}
        />
      </Modal>
    </div>
  )
}
