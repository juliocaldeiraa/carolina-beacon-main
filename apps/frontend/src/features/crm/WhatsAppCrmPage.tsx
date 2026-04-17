/**
 * WhatsAppCrmPage — Kanban de leads do WhatsApp com drag-and-drop
 *
 * Funil: Contato Feito → Em Conversa → Agendado → Confirmado → Compareceu | Perdido
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  Bot, Calendar, CheckCircle, ChevronLeft, ChevronRight,
  Search, MessageSquare, Loader2, Share2, X, Copy, Check, Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

const STAGES = [
  { key: 'contact_made', label: 'Contato Feito', color: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'in_conversation', label: 'Em Conversa', color: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'scheduled', label: 'Agendado', color: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'confirmed', label: 'Confirmado', color: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'attended', label: 'Compareceu', color: 'bg-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  { key: 'lost', label: 'Perdido', color: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200' },
]

interface WhatsAppLead {
  id: string
  agentId: string
  agent?: { id: string; name: string }
  contactPhone: string
  contactName?: string
  stage: string
  conversationId?: string
  appointmentDate?: string
  lastMessage?: string
  lostReason?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

function timeAgo(date: string) {
  const diff = Math.round((Date.now() - new Date(date).getTime()) / 60_000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `${diff}m`
  if (diff < 1440) return `${Math.round(diff / 60)}h`
  return `${Math.round(diff / 1440)}d`
}

// ─── Draggable Lead Card ──────────────────────────────────────────────────

function DraggableLeadCard({ lead, onMove }: { lead: WhatsAppLead; onMove: (stage: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })

  const stageIdx = STAGES.findIndex((s) => s.key === lead.stage)
  const prevStage = stageIdx > 0 ? STAGES[stageIdx - 1] : null
  const nextStage = stageIdx < STAGES.length - 1 && lead.stage !== 'lost' ? STAGES[stageIdx + 1] : null

  const appointmentStr = lead.appointmentDate
    ? new Date(lead.appointmentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setExpanded(!expanded)}
      className={cn(
        'bg-white rounded-xl border border-gray-100 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#134E4A] truncate">{lead.contactName ?? lead.contactPhone}</p>
          <p className="text-xs text-gray-400 font-mono">{lead.contactPhone}</p>
        </div>
        <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(lead.updatedAt)}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <Bot className="w-3 h-3 text-gray-300" />
        <span className="text-[11px] text-gray-400">{lead.agent?.name ?? 'Agente'}</span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" onClick={(e) => e.stopPropagation()}>
          {lead.lastMessage && (
            <div className="flex items-start gap-1.5">
              <MessageSquare className="w-3 h-3 text-gray-300 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500 line-clamp-2">{lead.lastMessage}</p>
            </div>
          )}
          {appointmentStr && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-gray-600">{appointmentStr}</span>
            </div>
          )}
          {lead.stage === 'confirmed' && (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span className="text-xs text-emerald-600">Confirmado</span>
            </div>
          )}
          {lead.lostReason && <p className="text-xs text-red-400">Motivo: {lead.lostReason}</p>}

          {/* Movement + action buttons */}
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            {prevStage && (
              <button onClick={() => onMove(prevStage.key)}
                className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200">
                <ChevronLeft className="w-3 h-3" /> {prevStage.label}
              </button>
            )}
            {nextStage && (
              <button onClick={() => onMove(nextStage.key)}
                className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md bg-[#0891B2] text-white hover:bg-[#0E7490]">
                {nextStage.label} <ChevronRight className="w-3 h-3" />
              </button>
            )}
            {lead.conversationId && (
              <button onClick={() => navigate('/conversations')}
                className="text-[11px] px-2 py-1 rounded-md bg-[#0891B2]/10 text-[#0891B2] font-medium hover:bg-[#0891B2]/20">
                Ver conversa
              </button>
            )}
            {!['attended', 'lost'].includes(lead.stage) && (
              <button onClick={() => onMove('lost')}
                className="text-[10px] px-2 py-1 rounded-md text-red-400 hover:bg-red-50">
                Perdido
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Droppable Column ─────────────────────────────────────────────────────

function DroppableColumn({ stage, children, count }: { stage: typeof STAGES[0]; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })

  return (
    <div className="w-64 shrink-0 flex flex-col">
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl', stage.bg, stage.border, 'border')}>
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', stage.color)} />
          <span className="text-xs font-semibold text-gray-700">{stage.label}</span>
        </div>
        <span className="text-xs font-bold text-gray-400">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 p-2 rounded-b-xl min-h-[200px] transition-colors',
          stage.bg, stage.border, 'border border-t-0',
          isOver && 'ring-2 ring-[#0891B2] ring-inset bg-[#0891B2]/5',
        )}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Share Modal ──────────────────────────────────────────────────────────

function ShareModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)

  const { data: shares = [] } = useQuery({
    queryKey: ['whatsapp-crm-shares'],
    queryFn: () => api.get('/crm/shares').then((r) => r.data),
  })

  const createShare = useMutation({
    mutationFn: () => api.post('/crm/shares', { label: label || 'CRM WhatsApp' }).then((r) => r.data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-crm-shares'] })
      setCredentials({ username: data.username, password: data.password })
      setLabel('')
    },
  })

  const deleteShare = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/shares/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp-crm-shares'] }),
  })

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#134E4A] flex items-center gap-2"><Share2 className="w-4 h-4" /> Compartilhar CRM</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Create new share */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Novo acesso externo</label>
            <div className="flex gap-2">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome do acesso"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0891B2]" />
              <Button onClick={() => createShare.mutate()} disabled={createShare.isPending}>
                {createShare.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Gerar
              </Button>
            </div>
          </div>

          {/* Credentials display */}
          {credentials && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-700">Credenciais geradas:</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-mono">{credentials.username}</span>
                <button onClick={() => copyToClipboard(credentials.username, 'user')} className="p-1 text-gray-400 hover:text-gray-600">
                  {copied === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-mono">{credentials.password}</span>
                <button onClick={() => copyToClipboard(credentials.password, 'pass')} className="p-1 text-gray-400 hover:text-gray-600">
                  {copied === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Active shares list */}
          {(shares as any[]).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500">Acessos ativos</p>
              {(shares as any[]).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-700">{s.label ?? s.username}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.username}</p>
                  </div>
                  <button onClick={() => deleteShare.mutate(s.id)} className="text-xs text-red-400 hover:text-red-600">Revogar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export function WhatsAppCrmPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['whatsapp-leads', agentFilter, search],
    queryFn: () => api.get('/crm/whatsapp-leads', { params: { agentId: agentFilter || undefined, search: search || undefined } }).then((r) => r.data),
    refetchInterval: 15_000,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  })

  const { data: stats = {} } = useQuery({
    queryKey: ['whatsapp-leads-stats', agentFilter],
    queryFn: () => api.get('/crm/whatsapp-leads/stats', { params: { agentId: agentFilter || undefined } }).then((r) => r.data),
    refetchInterval: 15_000,
  })

  const moveLead = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.patch(`/crm/whatsapp-leads/${id}/stage`, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-leads'] })
      qc.invalidateQueries({ queryKey: ['whatsapp-leads-stats'] })
    },
  })

  const groupedLeads: Record<string, WhatsAppLead[]> = {}
  for (const s of STAGES) groupedLeads[s.key] = []
  for (const lead of leads as WhatsAppLead[]) {
    if (groupedLeads[lead.stage]) groupedLeads[lead.stage].push(lead)
    else groupedLeads['contact_made'].push(lead)
  }

  const activeLead = activeId ? (leads as WhatsAppLead[]).find((l) => l.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const leadId = active.id as string
    const newStage = over.id as string

    const lead = (leads as WhatsAppLead[]).find((l) => l.id === leadId)
    if (!lead || lead.stage === newStage) return

    moveLead.mutate({ id: leadId, stage: newStage })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#134E4A]">CRM WhatsApp</h1>
          <p className="text-sm text-gray-400">Acompanhe leads do atendimento via WhatsApp</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0891B2] w-48" />
          </div>
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0891B2]">
            <option value="">Todos os agentes</option>
            {(agents as any[]).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => setShowShare(true)}>
            <Share2 className="w-4 h-4" /> Compartilhar
          </Button>
        </div>
      </div>

      {/* Kanban with DnD */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#0891B2]" />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const stageLeads = groupedLeads[stage.key] ?? []
              const count = (stats as any)[stage.key] ?? stageLeads.length

              return (
                <DroppableColumn key={stage.key} stage={stage} count={count}>
                  {stageLeads.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-8">Nenhum lead</p>
                  ) : (
                    stageLeads.map((lead) => (
                      <DraggableLeadCard
                        key={lead.id}
                        lead={lead}
                        onMove={(newStage) => moveLead.mutate({ id: lead.id, stage: newStage })}
                      />
                    ))
                  )}
                </DroppableColumn>
              )
            })}
          </div>

          <DragOverlay>
            {activeLead && (
              <div className="bg-white rounded-xl border border-[#0891B2] p-3 shadow-xl w-60 opacity-90">
                <p className="text-sm font-semibold text-[#134E4A] truncate">{activeLead.contactName ?? activeLead.contactPhone}</p>
                <p className="text-xs text-gray-400 font-mono">{activeLead.contactPhone}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Share Modal */}
      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
    </div>
  )
}
