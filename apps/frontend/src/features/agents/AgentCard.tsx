/**
 * AgentCard — Card individual de agente
 *
 * Spec: /Brand/Playbook de Layout e UX - Plataforma Beacon.md §3.3
 * Estrutura:
 *   ┌─────────────────────────────────┐
 *   │ [Avatar]  Nome do Agente   [⋮] │  ← ações no canto superior dir
 *   │           Descrição breve       │
 *   │  Status ● | Modelo | Data       │
 *   └─────────────────────────────────┘
 * Ações: editar | pausar/ativar | excluir (ícones Lucide)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Pencil, Pause, Play, Trash2, MoreVertical, Zap, MessageCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useDeleteAgent, useUpdateAgentStatus } from './hooks/useAgents'
import type { Agent } from '@/types/agent'
import { cn } from '@/lib/utils'

const statusBadge: Record<Agent['status'], { variant: 'active' | 'paused' | 'draft' | 'error'; label: string }> = {
  ACTIVE:  { variant: 'active',  label: 'Ativo' },
  PAUSED:  { variant: 'paused',  label: 'Pausado' },
  DRAFT:   { variant: 'draft',   label: 'Rascunho' },
  DELETED: { variant: 'error',   label: 'Removido' },
}

interface AgentCardProps {
  agent: Agent
}

export function AgentCard({ agent }: AgentCardProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const deleteMutation = useDeleteAgent()
  const statusMutation = useUpdateAgentStatus()

  const badge = statusBadge[agent.status]
  const isActive = agent.status === 'ACTIVE'
  const createdAt = new Date(agent.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  async function handleDelete() {
    await deleteMutation.mutateAsync(agent.id)
    toast({ type: 'success', title: 'Agente removido', message: `"${agent.name}" foi excluído.` })
    setDeleteOpen(false)
  }

  async function handleToggleStatus() {
    const newStatus = isActive ? 'PAUSED' : 'ACTIVE'
    await statusMutation.mutateAsync({ id: agent.id, status: newStatus })
    toast({
      type: 'success',
      title: isActive ? 'Agente pausado' : 'Agente ativado',
      message: `"${agent.name}" está agora ${isActive ? 'pausado' : 'ativo'}.`,
    })
    setStatusOpen(false)
  }

  return (
    <>
      <Card
        hoverable
        className="relative flex flex-col gap-3 group"
        onClick={() => navigate(`/agents/${agent.id}`)}
      >
        {/* Header: avatar + nome + menu */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-beacon-primary" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate text-sm">{agent.name}</h3>
            <p className="text-xs text-white/50 line-clamp-2 mt-0.5">
              {agent.description ?? 'Sem descrição'}
            </p>
          </div>

          {/* Menu de ações contextuais */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              className={cn(
                'p-1.5 rounded-lg text-white/40 transition-colors',
                'hover:bg-white/8 hover:text-white',
                'opacity-0 group-hover:opacity-100 focus:opacity-100',
              )}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Ações do agente"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-20 bg-beacon-surface-2 rounded-lg shadow-surface border border-[rgba(255,255,255,0.08)]
                           py-1 min-w-[160px]"
                role="menu"
              >
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/8 transition-colors"
                  onClick={() => { setMenuOpen(false); navigate(`/agents/${agent.id}/edit`) }}
                >
                  <Pencil className="w-4 h-4" /> Editar
                </button>
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/8 transition-colors"
                  onClick={() => { setMenuOpen(false); setStatusOpen(true) }}
                >
                  {isActive
                    ? <><Pause className="w-4 h-4" /> Pausar</>
                    : <><Play className="w-4 h-4" /> Ativar</>
                  }
                </button>
                <div className="my-1 border-t border-[rgba(255,255,255,0.06)]" />
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer: status + tipo + data */}
        <div className="flex items-center gap-2 flex-wrap mt-auto pt-2 border-t border-[rgba(255,255,255,0.07)]">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {agent.agentType === 'ATIVO' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-beacon-primary/20 text-[#f06529] border border-beacon-primary/30">
              <Zap className="w-3 h-3" /> ATIVO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#00b4d8]/15 text-[#00b4d8] border border-[#00b4d8]/20">
              <MessageCircle className="w-3 h-3" /> PASSIVO
            </span>
          )}
          <span className="text-xs text-white/35 ml-auto">{createdAt}</span>
        </div>
      </Card>

      {/* Confirm: excluir */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Excluir agente"
        description={`Tem certeza que deseja excluir "${agent.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
      />

      {/* Confirm: toggle status */}
      <ConfirmModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={handleToggleStatus}
        title={isActive ? 'Pausar agente' : 'Ativar agente'}
        description={
          isActive
            ? `"${agent.name}" deixará de responder conversas.`
            : `"${agent.name}" voltará a responder conversas.`
        }
        confirmLabel={isActive ? 'Pausar' : 'Ativar'}
        loading={statusMutation.isPending}
      />
    </>
  )
}
