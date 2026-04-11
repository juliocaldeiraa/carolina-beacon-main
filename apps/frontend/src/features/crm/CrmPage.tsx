/**
 * CrmPage — Kanban Board de CRM
 * IA move os cards automaticamente; humanos visualizam e podem mover manualmente
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Kanban, Plus, Bot, ChevronRight, ChevronLeft, Trash2,
  PhoneCall, User, MessageSquare, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import {
  usePipelines, usePipeline, useCreateCard, useUpdateCard, useDeleteCard,
} from './hooks/useCrm'
import type { CrmCard } from '@/services/crm'
import { cn } from '@/lib/utils'

// ─── Priority config ────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, {
  label: string
  variant: 'active' | 'default' | 'draft' | 'error'
}> = {
  LOW:    { label: 'Baixa',   variant: 'default' },
  NORMAL: { label: 'Normal',  variant: 'draft' },
  HIGH:   { label: 'Alta',    variant: 'active' },
  URGENT: { label: 'Urgente', variant: 'error' },
}

// ─── Card component ─────────────────────────────────────────────────────────────

function KanbanCard({
  card, stages, onMove, onDelete,
}: {
  card: CrmCard
  stages: string[]
  onMove: (stage: string) => void
  onDelete: () => void
}) {
  const [showActions, setShowActions] = useState(false)
  const currentIdx = stages.indexOf(card.stage)
  const priority = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.NORMAL

  return (
    <div
      className="bg-beacon-surface-2 rounded-lg border border-[rgba(255,255,255,0.07)] shadow-surface p-3 space-y-2.5 cursor-pointer hover:border-[rgba(255,255,255,0.15)] transition-all"
      onClick={() => setShowActions((v) => !v)}
    >
      {/* Title + AI badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-white leading-snug">{card.title}</p>
        {card.movedByAi && (
          <span
            title={card.aiNotes ?? 'Movido pela IA'}
            className="shrink-0 flex items-center gap-0.5 text-[10px] text-[#00b4d8] bg-[#00b4d8]/15 px-1.5 py-0.5 rounded-full"
          >
            <Bot className="w-2.5 h-2.5" aria-hidden="true" />
            IA
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs text-white/50">
          <User className="w-3 h-3 shrink-0" aria-hidden="true" />
          {card.contactName}
        </p>
        {card.contactPhone && (
          <p className="flex items-center gap-1.5 text-xs text-white/50">
            <PhoneCall className="w-3 h-3 shrink-0" aria-hidden="true" />
            {card.contactPhone}
          </p>
        )}
        {card.conversationId && (
          <p className="flex items-center gap-1.5 text-xs text-[#00b4d8]">
            <MessageSquare className="w-3 h-3 shrink-0" aria-hidden="true" />
            Ver conversa
          </p>
        )}
      </div>

      {/* Priority + follow-up badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant={priority.variant} className="text-[10px] px-1.5 py-0">
          {priority.label}
        </Badge>
        {card.followupStep != null && card.followupStep > 0 && (
          <span className={cn(
            'text-[10px] px-1.5 py-0 rounded-full font-medium',
            card.followupStep === 1 && 'bg-amber-500/20 text-amber-400',
            card.followupStep === 2 && 'bg-orange-500/20 text-orange-400',
            (card.followupStep ?? 0) >= 3 && 'bg-red-500/20 text-red-400',
          )}>
            Follow-up {card.followupStep}
          </span>
        )}
      </div>

      {/* Actions (on click) */}
      {showActions && (
        <div className="pt-2 border-t border-[rgba(255,255,255,0.07)] flex items-center gap-1.5 flex-wrap">
          {currentIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onMove(stages[currentIdx - 1]) }}
              className="flex items-center gap-0.5 text-[11px] text-white/50 bg-white/8 hover:bg-white/12 px-2 py-1 rounded transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Voltar
            </button>
          )}
          {currentIdx < stages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onMove(stages[currentIdx + 1]) }}
              className="flex items-center gap-0.5 text-[11px] text-beacon-primary bg-beacon-primary/10 hover:bg-beacon-primary/20 px-2 py-1 rounded transition-colors"
            >
              Avançar <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="ml-auto text-red-400 hover:bg-red-500/10 p-1 rounded transition-colors"
            aria-label="Remover card"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* AI notes */}
      {card.movedByAi && card.aiNotes && showActions && (
        <div className="bg-[#00b4d8]/10 rounded-lg px-2 py-1.5 text-[10px] text-[#00b4d8]">
          <Bot className="w-2.5 h-2.5 inline mr-1" />
          {card.aiNotes}
        </div>
      )}
    </div>
  )
}

// ─── Add card form ──────────────────────────────────────────────────────────────

const cardSchema = z.object({
  title:        z.string().min(2, 'Mínimo 2 caracteres'),
  contactName:  z.string().min(2, 'Mínimo 2 caracteres'),
  contactPhone: z.string().optional(),
  stage:        z.string(),
  priority:     z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  notes:        z.string().optional(),
})
type CardFormValues = z.infer<typeof cardSchema>

function AddCardForm({
  pipelineId, stages, defaultStage, onClose,
}: {
  pipelineId: string
  stages: string[]
  defaultStage: string
  onClose: () => void
}) {
  const { mutate: create, isPending } = useCreateCard()

  const { register, handleSubmit, formState: { errors } } = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: { stage: defaultStage, priority: 'NORMAL' },
  })

  function onSubmit(values: CardFormValues) {
    create(
      { pipelineId, ...values, contactPhone: values.contactPhone || undefined },
      { onSuccess: onClose },
    )
  }

  const labelClass = 'block text-xs font-medium text-white/70 mb-1'
  const inputClass = cn(
    'w-full text-sm text-white/85 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2',
    'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25',
  )
  const errorClass = 'text-xs text-red-500 mt-1'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="card-title" className={labelClass}>Título *</label>
        <input id="card-title" {...register('title')} className={inputClass} placeholder="Ex: Felipe Santos - Interesse Plano Pro" />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="card-contact" className={labelClass}>Nome do Contato *</label>
          <input id="card-contact" {...register('contactName')} className={inputClass} placeholder="Felipe Santos" />
          {errors.contactName && <p className={errorClass}>{errors.contactName.message}</p>}
        </div>
        <div>
          <label htmlFor="card-phone" className={labelClass}>Telefone</label>
          <input id="card-phone" {...register('contactPhone')} className={inputClass} placeholder="+55 11 99999-9999" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="card-stage" className={labelClass}>Stage inicial *</label>
          <select id="card-stage" {...register('stage')} className={inputClass}>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="card-priority" className={labelClass}>Prioridade *</label>
          <select id="card-priority" {...register('priority')} className={inputClass}>
            <option value="LOW">Baixa</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="card-notes" className={labelClass}>Observações</label>
        <textarea id="card-notes" {...register('notes')} rows={2} className={inputClass} placeholder="Informações adicionais..." />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={isPending}>Criar Card</Button>
      </div>
    </form>
  )
}

// ─── Kanban column ──────────────────────────────────────────────────────────────

function KanbanColumn({
  stage, cards, stages,
}: {
  stage: string
  cards: CrmCard[]
  stages: string[]
}) {
  const { mutate: updateCard } = useUpdateCard()
  const { mutate: deleteCard } = useDeleteCard()

  const isFinal = stage.toLowerCase().includes('fechado') || stage.toLowerCase().includes('closed')

  return (
    <div className={cn(
      'flex flex-col rounded-xl border min-w-[260px] max-w-[280px] bg-white/5',
      isFinal ? 'border-dashed border-[rgba(255,255,255,0.1)]' : 'border-[rgba(255,255,255,0.07)]',
    )}>
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-[rgba(255,255,255,0.07)]">
        <span className="text-xs font-semibold text-white truncate">{stage}</span>
        <span className="text-xs text-white/60 bg-white/8 border border-[rgba(255,255,255,0.1)] rounded-full px-2 py-0.5 shrink-0 ml-2">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs text-white/30">
            Sem cards
          </div>
        ) : (
          cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              stages={stages}
              onMove={(newStage) => updateCard({ id: card.id, data: { stage: newStage, movedByAi: false } })}
              onDelete={() => deleteCard(card.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function CrmPage() {
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [addCardStage, setAddCardStage] = useState('')

  const activePipelineId = selectedPipelineId ?? pipelines?.[0]?.id ?? null
  const { data: pipeline, isLoading: loadingPipeline } = usePipeline(activePipelineId)

  const stages: string[] = (pipeline?.stages as unknown as string[]) ?? []
  const allCards = pipeline?.cards ?? []

  const cardsByStage = stages.reduce<Record<string, CrmCard[]>>((acc, stage) => {
    acc[stage] = allCards.filter((c) => c.stage === stage)
    return acc
  }, {})

  if (loadingPipelines) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-pulse text-sm text-white/40">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Kanban className="w-5 h-5 text-beacon-primary" aria-hidden="true" />
          {pipelines && pipelines.length > 1 && (
            <select
              value={activePipelineId ?? ''}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-1.5 bg-beacon-surface text-white/85 focus:outline-none focus:border-[#00b4d8]/60"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {pipeline && <span className="text-sm font-semibold text-white">{pipeline.name}</span>}
          <span className="text-xs text-white/40">{allCards.length} cards</span>
          {allCards.some((c) => c.movedByAi) && (
            <span className="flex items-center gap-1 text-xs text-[#00b4d8] bg-[#00b4d8]/15 px-2 py-0.5 rounded-full">
              <Bot className="w-3 h-3" />
              {allCards.filter((c) => c.movedByAi).length} movidos pela IA
            </span>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => { setAddCardStage(stages[0] ?? ''); setShowAddCard(true) }}
          disabled={stages.length === 0}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Novo Card
        </Button>
      </div>

      {/* Empty state */}
      {!loadingPipeline && stages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-white/8 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-white/35" />
          </div>
          <p className="text-sm text-white/50">Nenhum pipeline configurado ainda</p>
        </div>
      )}

      {/* Kanban board */}
      {stages.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              cards={cardsByStage[stage] ?? []}
              stages={stages}
            />
          ))}
        </div>
      )}

      {/* Add card modal */}
      {pipeline && (
        <Modal
          open={showAddCard}
          onClose={() => setShowAddCard(false)}
          title="Novo Card"
          description="Adicione um lead ou oportunidade ao pipeline"
          size="lg"
        >
          <AddCardForm
            pipelineId={pipeline.id}
            stages={stages}
            defaultStage={addCardStage}
            onClose={() => setShowAddCard(false)}
          />
        </Modal>
      )}
    </div>
  )
}
