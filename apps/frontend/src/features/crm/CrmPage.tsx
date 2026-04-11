/**
 * CrmPage — Kanban de leads com movimentação automática e manual
 *
 * Auto (sistema):
 *   - MENSAGEM_ENVIADA: quando o disparo é feito
 *   - RESPONDEU:        quando o lead responde via WhatsApp (webhook)
 *   - SEM_INTERESSE:    após 3 follow-ups sem resposta
 *
 * Manual (humano):
 *   - EM_CONTATO: move após abordar o lead
 *   - AGENDADO:   move quando agenda uma reunião/ligação
 *   - CONVERTIDO: move quando fecha + registra valor de conversão
 *   - SEM_INTERESSE: pode mover manualmente também
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Phone, ChevronLeft, ChevronRight, Loader2, Search,
  Megaphone, Bot, TrendingUp, X, Share2, Trash2, Copy, Check,
} from 'lucide-react'
import { api } from '@/services/api'
import { campaignsApi, type Lead } from '@/services/campaigns-api'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface LeadWithCampaign extends Lead {
  campaign: { id: string; name: string }
}

// ─── Configuração das colunas ─────────────────────────────────────────────────

const COLUMNS = [
  {
    key:        'MENSAGEM_ENVIADA',
    label:      'Mensagem Enviada',
    dot:        'bg-blue-400',
    bg:         'bg-blue-50',
    border:     'border-blue-100',
    auto:       true,
    description: 'Sistema move automaticamente ao enviar',
  },
  {
    key:        'RESPONDEU',
    label:      'Respondeu',
    dot:        'bg-purple-500',
    bg:         'bg-purple-50',
    border:     'border-purple-100',
    auto:       true,
    description: 'Sistema move quando o lead responde',
  },
  {
    key:        'EM_CONTATO',
    label:      'Em Contato',
    dot:        'bg-cyan-500',
    bg:         'bg-cyan-50',
    border:     'border-cyan-100',
    auto:       false,
    description: 'Mova quando iniciar o contato ativo',
  },
  {
    key:        'AGENDADO',
    label:      'Agendado',
    dot:        'bg-amber-500',
    bg:         'bg-amber-50',
    border:     'border-amber-100',
    auto:       false,
    description: 'Mova quando agendar reunião/ligação',
  },
  {
    key:        'CONVERTIDO',
    label:      'Convertido',
    dot:        'bg-green-500',
    bg:         'bg-green-50',
    border:     'border-green-100',
    auto:       false,
    requiresValue: true,
    description: 'Mova quando fechar — informe o valor',
  },
  {
    key:        'SEM_INTERESSE',
    label:      'Sem Interesse',
    dot:        'bg-red-400',
    bg:         'bg-red-50',
    border:     'border-red-100',
    auto:       true,
    description: 'Auto após 3 FUs sem resposta, ou manual',
  },
] as const

type ColKey = typeof COLUMNS[number]['key']

const LEAD_STATUS_COLORS: Record<Lead['status'], string> = {
  PENDING:   'bg-gray-100 text-gray-500',
  QUEUED:    'bg-blue-50 text-blue-600',
  SENT:      'bg-green-50 text-green-700',
  REPLIED:   'bg-purple-50 text-purple-700',
  ERROR:     'bg-red-50 text-red-600',
  OPTED_OUT: 'bg-orange-50 text-orange-600',
}

const LEAD_STATUS_LABELS: Record<Lead['status'], string> = {
  PENDING:   'Pendente',
  QUEUED:    'Na fila',
  SENT:      'Enviado',
  REPLIED:   'Respondeu',
  ERROR:     'Erro',
  OPTED_OUT: 'Saiu',
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const crmApi = {
  listLeads: (params?: { campaignId?: string; search?: string }) =>
    api.get<LeadWithCampaign[]>('/crm/leads', { params }).then((r) => r.data),

  moveToColumn: (id: string, kanbanColumn: string, conversionValue?: string) =>
    api.patch<LeadWithCampaign>(`/crm/leads/${id}/column`, {
      kanbanColumn,
      ...(conversionValue ? { conversionValue } : {}),
    }).then((r) => r.data),
}

// ─── Modal de conversão ───────────────────────────────────────────────────────

function ConversionModal({
  lead,
  onConfirm,
  onClose,
  isPending,
}: {
  lead:      LeadWithCampaign
  onConfirm: (value: string) => void
  onClose:   () => void
  isPending: boolean
}) {
  const [raw, setRaw] = useState('')

  // Mascara: apenas dígitos → formata como moeda
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    setRaw(digits)
  }

  const displayValue = raw
    ? (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    : ''

  const numericValue = raw ? (parseInt(raw, 10) / 100).toFixed(2).replace('.', ',') : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header verde */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg leading-tight">Registrar conversão</h2>
              <p className="text-green-100 text-sm mt-0.5">Mover lead para Convertido</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Lead info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-green-700 font-bold text-sm">
                {(lead.var1 ?? lead.phone).slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{lead.var1 ?? lead.phone}</p>
              <p className="text-xs text-gray-400 truncate">{lead.campaign.name}</p>
            </div>
          </div>

          {/* Input de valor */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Valor da venda
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">
                R$
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={handleChange}
                placeholder="0,00"
                autoFocus
                className="w-full pl-10 pr-4 py-3.5 text-lg font-bold text-gray-900 bg-gray-50
                           border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-green-400
                           focus:bg-white transition-all tabular-nums"
              />
            </div>
            <p className="text-[11px] text-gray-400">Opcional — deixe vazio se não quiser registrar valor</p>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100
                         hover:bg-gray-200 rounded-2xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(numericValue)}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white
                         bg-gradient-to-r from-green-500 to-emerald-600
                         hover:from-green-600 hover:to-emerald-700
                         rounded-2xl shadow-lg shadow-green-200 transition-all disabled:opacity-50"
            >
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <TrendingUp className="w-4 h-4" />
              }
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onMoveRequest,
  isMoving,
}: {
  lead:          LeadWithCampaign
  onMoveRequest: (lead: LeadWithCampaign, colKey: ColKey) => void
  isMoving:      boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const currentIdx = COLUMNS.findIndex((c) => c.key === lead.kanbanColumn)

  const displayName = lead.var1 ?? lead.phone
  const prevCol     = currentIdx > 0 ? COLUMNS[currentIdx - 1] : null
  const nextCol     = currentIdx < COLUMNS.length - 1 ? COLUMNS[currentIdx + 1] : null

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      className="bg-white border border-gray-100 rounded-xl p-3 space-y-2 cursor-pointer
                 hover:border-gray-300 hover:shadow-sm transition-all select-none"
    >
      {/* Nome + status */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{displayName}</p>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[lead.status]}`}>
          {LEAD_STATUS_LABELS[lead.status]}
        </span>
      </div>

      {/* Telefone */}
      <p className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
        <Phone className="w-3 h-3 shrink-0" />
        {lead.phone}
      </p>

      {/* Campanha */}
      <p className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
        <Megaphone className="w-3 h-3 shrink-0" />
        {lead.campaign.name}
      </p>

      {/* Badges: follow-ups + conversão */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.followUpCount > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            lead.followUpCount >= 3
              ? 'bg-red-50 text-red-500'
              : lead.followUpCount === 2
              ? 'bg-orange-50 text-orange-500'
              : 'bg-amber-50 text-amber-600'
          }`}>
            {lead.followUpCount === 1 ? '1 FU' : `${lead.followUpCount} FUs`}
          </span>
        )}
        {lead.conversionValue && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-50 text-green-700">
            R$ {Number(lead.conversionValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* Última mensagem */}
      {lead.lastMessageAt && (
        <p className="text-[10px] text-gray-300">
          {new Date(lead.lastMessageAt).toLocaleDateString('pt-BR')}
        </p>
      )}

      {/* Ações (expandido) */}
      {expanded && (
        <div
          className="pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {prevCol && (
            <button
              onClick={() => onMoveRequest(lead, prevCol.key as ColKey)}
              disabled={isMoving}
              className="flex items-center gap-0.5 text-[11px] text-gray-500 bg-gray-100 hover:bg-gray-200
                         px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {isMoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronLeft className="w-3 h-3" />}
              {prevCol.label}
            </button>
          )}
          {nextCol && (
            <button
              onClick={() => onMoveRequest(lead, nextCol.key as ColKey)}
              disabled={isMoving}
              className="flex items-center gap-0.5 text-[11px] text-white bg-beacon-primary hover:bg-beacon-hover
                         px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ml-auto"
            >
              {nextCol.label}
              {isMoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
          {/* Mover para Sem Interesse diretamente (exceto se já estiver lá) */}
          {lead.kanbanColumn !== 'SEM_INTERESSE' && lead.kanbanColumn !== 'CONVERTIDO' && (
            <button
              onClick={() => onMoveRequest(lead, 'SEM_INTERESSE')}
              disabled={isMoving}
              className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1 rounded-lg
                         hover:bg-red-50 transition-colors"
            >
              Sem interesse
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Coluna ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  leads,
  onMoveRequest,
  movingId,
}: {
  col:           typeof COLUMNS[number]
  leads:         LeadWithCampaign[]
  onMoveRequest: (lead: LeadWithCampaign, colKey: ColKey) => void
  movingId:      string | null
}) {
  return (
    <div className={`flex flex-col rounded-xl border min-w-[260px] max-w-[280px] ${col.bg} ${col.border}`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-inherit">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
            <span className="text-xs font-semibold text-gray-700">{col.label}</span>
            {col.auto && (
              <span title="Movido automaticamente pelo sistema">
                <Bot className="w-3 h-3 text-gray-400" />
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
            {leads.length}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">{col.description}</p>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        {leads.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs text-gray-300">
            Nenhum lead
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onMoveRequest={onMoveRequest}
              isMoving={movingId === lead.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

interface ShareItem {
  id: string
  username: string
  label: string
  campaignId: string
  createdAt: string
  campaign: { id: string; name: string }
}

interface CreatedCredentials {
  username: string
  password: string
  label: string
}

function ShareModal({
  campaigns,
  onClose,
}: {
  campaigns: Array<{ id: string; name: string }>
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id ?? '')
  const [labelInput, setLabelInput] = useState('')
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const { data: shares = [], isLoading } = useQuery<ShareItem[]>({
    queryKey: ['crm-shares'],
    queryFn: () => api.get('/crm/shares').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { campaignId: string; label?: string }) =>
      api.post('/crm/shares', data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['crm-shares'] })
      setCredentials({ username: data.username, password: data.password, label: data.label })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/shares/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-shares'] }),
  })

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const sharedUrl = 'https://disparador.juliocaldeira.com.br/shared'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg space-y-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#f06529]" />
            <h2 className="font-semibold text-gray-900">Acessos Compartilhados</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Credentials dialog after creation */}
        {credentials && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-800">Acesso criado! Compartilhe as credenciais:</p>
            {[
              { label: 'URL', value: sharedUrl, key: 'url' },
              { label: 'Usuário', value: credentials.username, key: 'user' },
              { label: 'Senha', value: credentials.password, key: 'pass' },
            ].map(({ label, value, key }) => (
              <div key={key} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-green-100">
                <div>
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="text-xs font-mono text-gray-800">{value}</p>
                </div>
                <button
                  onClick={() => handleCopy(value, key)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  {copied === key ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
            <button
              onClick={() => setCredentials(null)}
              className="text-xs text-green-700 hover:underline"
            >
              Fechar aviso
            </button>
          </div>
        )}

        {/* New share form */}
        {!credentials && (
          <div className="border border-gray-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Novo acesso</p>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Campanha</label>
              <select
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#f06529]"
              >
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Etiqueta (opcional)</label>
              <input
                type="text"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="Ex: Equipe Vendas"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#f06529]"
              />
            </div>
            <button
              onClick={() => createMutation.mutate({ campaignId: selectedCampaignId, label: labelInput || undefined })}
              disabled={createMutation.isPending || !selectedCampaignId}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#f06529] hover:bg-[#d4521e] rounded-lg disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Gerar acesso
            </button>
          </div>
        )}

        {/* Existing shares list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Acessos ativos</p>
          {isLoading ? (
            <div className="text-xs text-gray-400 py-2">Carregando...</div>
          ) : shares.length === 0 ? (
            <div className="text-xs text-gray-300 py-4 text-center">Nenhum acesso criado ainda</div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {shares.map(share => (
                <div key={share.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-700 truncate">{share.username}</p>
                    <p className="text-[10px] text-gray-400 truncate">{share.campaign.name} {share.label !== share.campaign.name ? `· ${share.label}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-gray-400">
                      {new Date(share.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <button
                      onClick={() => deleteMutation.mutate(share.id)}
                      disabled={deleteMutation.isPending}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function CrmPage() {
  const qc = useQueryClient()
  const [search, setSearch]             = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [movingId, setMovingId]         = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  // Modal de conversão
  const [conversionTarget, setConversionTarget] = useState<{
    lead: LeadWithCampaign; targetCol: ColKey
  } | null>(null)

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  campaignsApi.list,
  })

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['crm-leads', campaignFilter, search],
    queryFn:  () => crmApi.listLeads({
      campaignId: campaignFilter || undefined,
      search:     search || undefined,
    }),
    refetchInterval: 15_000,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, col, value }: { id: string; col: string; value?: string }) =>
      crmApi.moveToColumn(id, col, value),
    onMutate:   ({ id }) => setMovingId(id),
    onSettled:  () => {
      setMovingId(null)
      setConversionTarget(null)
      qc.invalidateQueries({ queryKey: ['crm-leads'] })
    },
  })

  // Solicitação de movimento — verifica se precisa de modal de conversão
  const handleMoveRequest = (lead: LeadWithCampaign, targetCol: ColKey) => {
    if (targetCol === 'CONVERTIDO') {
      setConversionTarget({ lead, targetCol })
    } else {
      moveMutation.mutate({ id: lead.id, col: targetCol })
    }
  }

  // Normaliza coluna desconhecida (leads antigos com "AGUARDANDO") → MENSAGEM_ENVIADA
  const normalizeCol = (col: string): ColKey => {
    if (COLUMNS.some((c) => c.key === col)) return col as ColKey
    return 'MENSAGEM_ENVIADA'
  }

  const leadsByCol = COLUMNS.reduce<Record<ColKey, LeadWithCampaign[]>>((acc, col) => {
    acc[col.key] = leads.filter((l) => normalizeCol(l.kanbanColumn) === col.key)
    return acc
  }, {} as Record<ColKey, LeadWithCampaign[]>)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-beacon-primary bg-white"
          />
        </div>

        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white
                     focus:outline-none focus:ring-2 focus:ring-beacon-primary"
        >
          <option value="">Todas as campanhas</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
          <Bot className="w-3.5 h-3.5" />
          <span>= movido automaticamente</span>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
        </div>

        <button
          onClick={() => setShowShareModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Compartilhar
        </button>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            leads={leadsByCol[col.key] ?? []}
            onMoveRequest={handleMoveRequest}
            movingId={movingId}
          />
        ))}
      </div>

      {/* Modal de conversão */}
      {conversionTarget && (
        <ConversionModal
          lead={conversionTarget.lead}
          isPending={moveMutation.isPending}
          onClose={() => setConversionTarget(null)}
          onConfirm={(value) =>
            moveMutation.mutate({
              id:    conversionTarget.lead.id,
              col:   conversionTarget.targetCol,
              value: value || undefined,
            })
          }
        />
      )}

      {/* Modal de compartilhamento */}
      {showShareModal && (
        <ShareModal
          campaigns={campaigns}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}
