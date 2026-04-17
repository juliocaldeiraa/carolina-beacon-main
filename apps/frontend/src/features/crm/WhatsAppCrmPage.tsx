/**
 * WhatsAppCrmPage — Kanban de leads do WhatsApp
 *
 * Funil: Contato Feito → Em Conversa → Agendado → Confirmado → Compareceu | Perdido
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Calendar, CheckCircle,
  Search, MessageSquare, Loader2,
} from 'lucide-react'
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
  calendarEventId?: string
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

function LeadCard({ lead, onMove }: { lead: WhatsAppLead; onMove: (stage: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const _stage = STAGES.find((s) => s.key === lead.stage)

  const appointmentStr = lead.appointmentDate
    ? new Date(lead.appointmentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:shadow-sm transition-shadow"
    >
      {/* Collapsed */}
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

      {/* Expanded */}
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
          {lead.lostReason && (
            <p className="text-xs text-red-400">Motivo: {lead.lostReason}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {lead.conversationId && (
              <button onClick={() => navigate(`/conversations`)}
                className="text-[11px] px-2 py-1 rounded-md bg-[#0891B2]/10 text-[#0891B2] font-medium hover:bg-[#0891B2]/20">
                Ver conversa
              </button>
            )}
            {lead.stage === 'scheduled' && (
              <button onClick={() => onMove('confirmed')}
                className="text-[11px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 font-medium hover:bg-emerald-100">
                Confirmar
              </button>
            )}
            {lead.stage === 'confirmed' && (
              <button onClick={() => onMove('attended')}
                className="text-[11px] px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium hover:bg-green-100">
                Compareceu
              </button>
            )}
            {!['attended', 'lost'].includes(lead.stage) && (
              <button onClick={() => onMove('lost')}
                className="text-[11px] px-2 py-1 rounded-md bg-red-50 text-red-500 font-medium hover:bg-red-100">
                Perdido
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function WhatsAppCrmPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('')

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
        </div>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#0891B2]" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = groupedLeads[stage.key] ?? []
            const count = (stats as any)[stage.key] ?? stageLeads.length

            return (
              <div key={stage.key} className="w-64 shrink-0 flex flex-col">
                {/* Column header */}
                <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl', stage.bg, stage.border, 'border')}>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', stage.color)} />
                    <span className="text-xs font-semibold text-gray-700">{stage.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-400">{count}</span>
                </div>

                {/* Cards */}
                <div className={cn('flex-1 space-y-2 p-2 rounded-b-xl min-h-[200px]', stage.bg, stage.border, 'border border-t-0')}>
                  {stageLeads.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-8">Nenhum lead</p>
                  ) : (
                    stageLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onMove={(newStage) => moveLead.mutate({ id: lead.id, stage: newStage })}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
