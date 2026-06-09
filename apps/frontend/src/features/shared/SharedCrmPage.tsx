/**
 * SharedCrmPage — Kanban externo do CRM (/shared/crm)
 *
 * Sessão isolada (token role SHARED no localStorage), escopada a UMA campanha.
 * Lê GET /crm/shared-leads e move leads via PATCH /crm/shared-leads/:id/column.
 * Colunas idênticas ao Kanban interno (CrmPage).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, Megaphone, Share2, LogOut, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import axios from 'axios'

const COLUMNS = [
  { key: 'MENSAGEM_ENVIADA', label: 'Mensagem Enviada', dot: 'bg-blue-400',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  { key: 'RESPONDEU',        label: 'Respondeu',        dot: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
  { key: 'EM_CONTATO',       label: 'Em Contato',       dot: 'bg-cyan-500',   bg: 'bg-cyan-50',   border: 'border-cyan-100'   },
  { key: 'AGENDADO',         label: 'Agendado',         dot: 'bg-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-100'  },
  { key: 'CONVERTIDO',       label: 'Convertido',       dot: 'bg-green-500',  bg: 'bg-green-50',  border: 'border-green-100'  },
  { key: 'SEM_INTERESSE',    label: 'Sem Interesse',    dot: 'bg-red-400',    bg: 'bg-red-50',    border: 'border-red-100'    },
] as const
type ColKey = typeof COLUMNS[number]['key']

function getSharedApi() {
  const token = localStorage.getItem('sharedToken') ?? ''
  return axios.create({ baseURL: '/api', headers: { Authorization: `Bearer ${token}` } })
}

// ─── LeadCard (extraído pra respeitar Rules of Hooks) ────────────────────────

function LeadCard({
  lead,
  isMoving,
  onMove,
}: {
  lead: any
  isMoving: boolean
  onMove: (id: string, col: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const currentIdx = COLUMNS.findIndex(c => c.key === lead.kanbanColumn)
  const prevCol = currentIdx > 0 ? COLUMNS[currentIdx - 1] : null
  const nextCol = currentIdx < COLUMNS.length - 1 ? COLUMNS[currentIdx + 1] : null

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      className="bg-white rounded-xl border border-gray-100 p-3 space-y-2 cursor-pointer hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 truncate">{lead.var1 ?? lead.phone}</p>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
        <Phone className="w-3 h-3" />{lead.phone}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
        <Megaphone className="w-3 h-3" />{lead.campaign?.name}
      </p>
      {expanded && (
        <div
          className="flex items-center gap-1 pt-1 border-t border-gray-50"
          onClick={e => e.stopPropagation()}
        >
          {prevCol && (
            <button
              onClick={() => onMove(lead.id, prevCol.key)}
              disabled={isMoving}
              className="flex items-center gap-0.5 text-[11px] text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg"
            >
              <ChevronLeft className="w-3 h-3" />{prevCol.label}
            </button>
          )}
          {nextCol && (
            <button
              onClick={() => onMove(lead.id, nextCol.key)}
              disabled={isMoving}
              className="flex items-center gap-0.5 text-[11px] text-white bg-[#10B981] hover:bg-[#059669] px-2 py-1 rounded-lg ml-auto"
            >
              {nextCol.label}{isMoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export function SharedCrmPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [movingId, setMovingId] = useState<string | null>(null)
  const label = localStorage.getItem('sharedLabel') ?? 'CRM'
  const sharedApi = getSharedApi()

  const { data: leads = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ['shared-crm-leads'],
    queryFn: () => sharedApi.get('/crm/shared-leads').then(r => r.data),
    refetchInterval: 15_000,
    retry: false,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, col }: { id: string; col: string }) =>
      sharedApi.patch(`/crm/shared-leads/${id}/column`, { kanbanColumn: col }).then(r => r.data),
    onMutate: ({ id }) => setMovingId(id),
    onSettled: () => { setMovingId(null); qc.invalidateQueries({ queryKey: ['shared-crm-leads'] }) },
  })

  const normalizeCol = (col: string): ColKey => {
    if (COLUMNS.some(c => c.key === col)) return col as ColKey
    return 'MENSAGEM_ENVIADA'
  }

  const leadsByCol = COLUMNS.reduce<Record<ColKey, any[]>>((acc, col) => {
    acc[col.key] = leads.filter(l => normalizeCol(l.kanbanColumn) === col.key)
    return acc
  }, {} as Record<ColKey, any[]>)

  function handleLogout() {
    localStorage.removeItem('sharedToken')
    localStorage.removeItem('sharedCampaignId')
    localStorage.removeItem('sharedLabel')
    navigate('/shared')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#10B981] rounded-lg flex items-center justify-center">
            <Share2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#064E3B]">CRM &mdash; {label}</p>
            <p className="text-xs text-gray-400">Acesso do atendimento</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700">
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </header>

      <div className="p-4">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-sm text-gray-500">Sessão expirada ou acesso inválido.</p>
            <button onClick={handleLogout} className="text-sm text-[#10B981] hover:underline">Entrar novamente</button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Carregando...</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {COLUMNS.map(col => (
              <div key={col.key} className={`flex-shrink-0 w-64 rounded-xl border ${col.border} ${col.bg} p-3 space-y-2`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-xs font-semibold text-gray-700">{col.label}</span>
                  </div>
                  <span className="text-xs text-gray-400 bg-white/60 rounded-full px-2 py-0.5">{leadsByCol[col.key].length}</span>
                </div>
                {leadsByCol[col.key].map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isMoving={movingId === lead.id}
                    onMove={(id, colKey) => moveMutation.mutate({ id, col: colKey })}
                  />
                ))}
                {leadsByCol[col.key].length === 0 && (
                  <p className="text-center text-xs text-gray-300 py-4">Nenhum lead</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
