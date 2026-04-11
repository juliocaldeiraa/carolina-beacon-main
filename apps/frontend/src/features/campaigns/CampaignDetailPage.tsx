/**
 * CampaignDetailPage — Detalhes de uma campanha: leads, progresso, follow-ups
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Play, Pause, RotateCcw, Upload, Loader2,
  FileText, CheckCircle, AlertCircle, Clock, Users,
  Download, UserPlus, X, Bell, Trash2, ChevronDown, ChevronUp,
  Pencil, Tag, MessageSquare, Ban, Send, Copy, RefreshCw,
} from 'lucide-react'
import { campaignsApi, type Lead } from '@/services/campaigns-api'
import { api } from '@/services/api'
import { SpintextEditor } from './SpintextEditor'

const LEAD_STATUS_LABELS: Record<Lead['status'], string> = {
  PENDING:   'Pendente',
  QUEUED:    'Na fila',
  SENT:      'Enviado',
  REPLIED:   'Respondeu',
  ERROR:     'Erro',
  OPTED_OUT: 'Optou por sair',
}

const LEAD_STATUS_COLORS: Record<Lead['status'], string> = {
  PENDING:   'bg-gray-100 text-gray-600',
  QUEUED:    'bg-blue-50 text-blue-600',
  SENT:      'bg-green-50 text-green-700',
  REPLIED:   'bg-purple-50 text-purple-700',
  ERROR:     'bg-red-50 text-red-600',
  OPTED_OUT: 'bg-orange-50 text-orange-600',
}

export function CampaignDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn:  () => campaignsApi.get(id!),
    refetchInterval: 5_000,
    enabled: !!id,
  })

  const { data: leadsData } = useQuery({
    queryKey: ['leads', id, page, statusFilter],
    queryFn:  () => campaignsApi.listLeads(id!, { page, limit: 20, status: statusFilter || undefined }),
    enabled: !!id,
  })

  // ─── Edição de campanha ─────────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name:             '',
    channelId:        '',
    delayMinSec:      120,
    delayMaxSec:      180,
    varLabels:        ['', '', '', '', ''] as string[],
    scheduleEnabled:  false,
    scheduleStartHour: 8,
    scheduleEndHour:  18,
    scheduleDays:     [1,2,3,4,5] as number[],
  })

  const { data: instances = [] } = useQuery({
    queryKey: ['channels'],
    queryFn:  () => api.get<any[]>('/channels').then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (dto: typeof editForm) =>
      campaignsApi.update(id!, {
        name:             dto.name,
        channelId:        dto.channelId || undefined,
        delayMinSec:      dto.delayMinSec,
        delayMaxSec:      dto.delayMaxSec,
        varLabels:        dto.varLabels,
        scheduleEnabled:  dto.scheduleEnabled,
        scheduleStartHour: dto.scheduleStartHour,
        scheduleEndHour:  dto.scheduleEndHour,
        scheduleDays:     dto.scheduleDays,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      setShowEdit(false)
    },
  })

  const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const openEdit = () => {
    if (!campaign) return
    setEditForm({
      name:             campaign.name,
      channelId:        campaign.channelId ?? '',
      delayMinSec:      campaign.delayMinSec,
      delayMaxSec:      campaign.delayMaxSec,
      varLabels:        [
        campaign.varLabels?.[0] ?? '',
        campaign.varLabels?.[1] ?? '',
        campaign.varLabels?.[2] ?? '',
        campaign.varLabels?.[3] ?? '',
        campaign.varLabels?.[4] ?? '',
      ],
      scheduleEnabled:   campaign.scheduleEnabled ?? false,
      scheduleStartHour: campaign.scheduleStartHour ?? 8,
      scheduleEndHour:   campaign.scheduleEndHour ?? 18,
      scheduleDays:      campaign.scheduleDays ?? [1,2,3,4,5],
    })
    setShowEdit(true)
  }

  /** Retorna o label de uma variável (1-indexed) ou o fallback padrão */
  const varLabel = (i: number) =>
    (campaign?.varLabels?.[i - 1]?.trim() || `Variável ${i}`)

  // ─── Editor de mensagem inicial ────────────────────────────────────────────
  const [showMsgEditor, setShowMsgEditor] = useState(false)
  const initialTemplate = campaign?.templates?.find?.((t: any) => t.order === 0) ?? null
  const [msgVariations, setMsgVariations] = useState<string[][]>([['']])
  const [msgActiveIdx, setMsgActiveIdx] = useState(0)
  const updateMsgMutation = useMutation({
    mutationFn: () => campaignsApi.updateInitialTemplate(id!, msgVariations),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      setShowMsgEditor(false)
    },
  })

  // ─── Formulário manual / follow-ups ─────────────────────────────────────────
  const [showManualForm, setShowManualForm]   = useState(false)
  const [manualForm, setManualForm]           = useState({ phone: '', var1: '', var2: '', var3: '', var4: '', var5: '' })
  const [showFollowUps, setShowFollowUps]     = useState(false)
  // Estado local dos 3 follow-ups: variations + delay (valor + unidade) + activeIdx do editor
  const [fuForms, setFuForms] = useState<{
    variations: string[][]; delayValue: number; delayUnit: 'min' | 'h'; activeIdx: number
  }[]>([
    { variations: [['']], delayValue: 24,  delayUnit: 'h',   activeIdx: 0 },
    { variations: [['']], delayValue: 48,  delayUnit: 'h',   activeIdx: 0 },
    { variations: [['']], delayValue: 72,  delayUnit: 'h',   activeIdx: 0 },
  ])

  const launchMutation  = useMutation({ mutationFn: () => campaignsApi.launch(id!),  onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }) })
  const pauseMutation   = useMutation({ mutationFn: () => campaignsApi.pause(id!),   onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }) })
  const resumeMutation  = useMutation({ mutationFn: () => campaignsApi.resume(id!),  onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }) })
  const duplicateMutation = useMutation({
    mutationFn: () => campaignsApi.duplicate(id!),
    onSuccess:  (data) => navigate(`/campaigns/${data.id}`),
  })
  const retryErrorsMutation = useMutation({
    mutationFn: () => campaignsApi.retryErrors(id!),
    onSuccess:  (data) => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['leads', id] })
      alert(`${data.retriedCount} leads re-enfileirados para disparo!`)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message ?? 'Erro ao redisparar')
    },
  })

  // ─── Lead actions ───────────────────────────────────────────────────────────
  // Inbox
  const [inboxLead, setInboxLead] = useState<import('@/services/campaigns-api').Lead | null>(null)
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['lead-messages', id, inboxLead?.id],
    queryFn:  () => campaignsApi.getLeadMessages(id!, inboxLead!.id),
    enabled:  !!id && !!inboxLead,
    refetchInterval: inboxLead ? 10_000 : false,
  })

  // Edit lead vars
  const [editLeadData, setEditLeadData] = useState<import('@/services/campaigns-api').Lead | null>(null)
  const [editLeadForm, setEditLeadForm] = useState({ var1: '', var2: '', var3: '', var4: '', var5: '' })
  const openEditLead = (lead: import('@/services/campaigns-api').Lead) => {
    setEditLeadData(lead)
    setEditLeadForm({ var1: lead.var1 ?? '', var2: lead.var2 ?? '', var3: lead.var3 ?? '', var4: lead.var4 ?? '', var5: lead.var5 ?? '' })
  }
  const updateLeadVarsMutation = useMutation({
    mutationFn: () => campaignsApi.updateLead(id!, editLeadData!.id, {
      var1: editLeadForm.var1 || null, var2: editLeadForm.var2 || null,
      var3: editLeadForm.var3 || null, var4: editLeadForm.var4 || null, var5: editLeadForm.var5 || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads', id] }); setEditLeadData(null) },
  })

  // Cancel lead
  const [cancelLeadId, setCancelLeadId] = useState<string | null>(null)
  const cancelLeadMutation = useMutation({
    mutationFn: (leadId: string) => campaignsApi.cancelLead(id!, leadId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['leads', id] }); setCancelLeadId(null) },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => campaignsApi.importLeads(id!, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaign', id] }); qc.invalidateQueries({ queryKey: ['leads', id] }) },
  })

  const createLeadMutation = useMutation({
    mutationFn: () => campaignsApi.createLead(id!, {
      phone: manualForm.phone,
      var1:  manualForm.var1 || undefined,
      var2:  manualForm.var2 || undefined,
      var3:  manualForm.var3 || undefined,
      var4:  manualForm.var4 || undefined,
      var5:  manualForm.var5 || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['leads', id] })
      setManualForm({ phone: '', var1: '', var2: '', var3: '', var4: '', var5: '' })
      setShowManualForm(false)
    },
  })

  // Follow-up rules existentes na campanha
  const { data: followUpRules = [] } = useQuery({
    queryKey: ['follow-ups', id],
    queryFn:  () => campaignsApi.listFollowUpRules(id!),
    enabled:  !!id,
  })

  // Upsert de um follow-up (cria ou substitui)
  const upsertFuMutation = useMutation({
    mutationFn: (idx: number) => {
      const fu = fuForms[idx]
      const minutes = fu.delayUnit === 'h' ? fu.delayValue * 60 : fu.delayValue
      return campaignsApi.upsertFollowUp(id!, {
        order:               idx + 1,
        variations:          fu.variations.map((p) => p.filter(Boolean)).filter((p) => p.length),
        triggerAfterMinutes: minutes,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-ups', id] }),
  })

  const deleteFuMutation = useMutation({
    mutationFn: (order: number) => campaignsApi.deleteFollowUp(id!, order),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['follow-ups', id] }),
  })

  const downloadTemplate = () => {
    api.get(`/campaigns/${id}/leads/template`, { responseType: 'blob' }).then((r) => {
      const url  = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }))
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'modelo-contatos.csv'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  if (isLoading || !campaign) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-beacon-primary" />
      </div>
    )
  }

  const total = campaign._count?.leads ?? campaign.totalLeads
  const pct   = total > 0 ? Math.round((campaign.sentCount / total) * 100) : 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/campaigns')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar às campanhas
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {total} leads
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {campaign.sentCount} enviados
              </span>
              {campaign.errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {campaign.errorCount} erros
                  <button
                    onClick={(e) => { e.stopPropagation(); retryErrorsMutation.mutate() }}
                    disabled={retryErrorsMutation.isPending}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium hover:bg-red-100 transition-colors"
                  >
                    {retryErrorsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Redisparar
                  </button>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {campaign.delayMinSec}–{campaign.delayMaxSec}s
              </span>
              {campaign.scheduleEnabled && (
                <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium">
                  🕐 {String(campaign.scheduleStartHour).padStart(2,'0')}h–{String(campaign.scheduleEndHour).padStart(2,'0')}h
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Duplicar — sempre disponível */}
            <button
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
              title="Duplicar campanha"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600
                         rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {duplicateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Duplicar
            </button>

            {/* Botão editar (disponível em DRAFT e PAUSED) */}
            {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600
                           rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            )}
            {campaign.status === 'DRAFT' && (
              <button
                onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending || total === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white
                           rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {launchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Lançar
              </button>
            )}
            {campaign.status === 'RUNNING' && (
              <button
                onClick={() => pauseMutation.mutate()}
                className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white
                           rounded-lg text-sm font-medium hover:bg-yellow-600"
              >
                <Pause className="w-4 h-4" />
                Pausar
              </button>
            )}
            {campaign.status === 'PAUSED' && (
              <button
                onClick={() => resumeMutation.mutate()}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white
                           rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <RotateCcw className="w-4 h-4" />
                Retomar
              </button>
            )}
          </div>
        </div>

        {/* VarLabels badges — mostra os rótulos configurados */}
        {campaign.varLabels?.some((l) => l?.trim()) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            {([1,2,3,4,5] as const).map((i) => {
              const lbl = campaign.varLabels?.[i - 1]?.trim()
              if (!lbl) return null
              return (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono">
                  {`{{${i}}}`} = {lbl}
                </span>
              )
            })}
          </div>
        )}

        {/* Progress */}
        {(campaign.status === 'RUNNING' || campaign.status === 'COMPLETED' || campaign.status === 'PAUSED') && total > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progresso</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-beacon-primary h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Editar mensagem inicial ─── */}
      {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => {
              if (!showMsgEditor) {
                setMsgVariations((initialTemplate?.variations as unknown as string[][] | undefined) ?? [['']])
              }
              setShowMsgEditor(v => !v)
            }}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-beacon-primary" />
              <h2 className="font-semibold text-gray-800 text-sm">Mensagem inicial</h2>
              {initialTemplate && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {(initialTemplate.variations as unknown as string[][]).length} variação{(initialTemplate.variations as unknown as string[][]).length !== 1 ? 'ões' : ''}
                </span>
              )}
            </div>
            {showMsgEditor
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </button>
          {showMsgEditor && (
            <div className="border-t border-gray-100 p-5 space-y-4">
              <SpintextEditor
                variations={msgVariations}
                onChange={setMsgVariations}
                activeIdx={msgActiveIdx}
                onActiveChange={setMsgActiveIdx}
                label="Variações da mensagem"
              />
              {updateMsgMutation.isError && (
                <p className="text-xs text-red-600">
                  {(updateMsgMutation.error as any)?.response?.data?.message ?? 'Erro ao salvar'}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => updateMsgMutation.mutate()}
                  disabled={updateMsgMutation.isPending || !msgVariations.some(p => p.some(t => t.trim()))}
                  className="flex items-center gap-2 px-4 py-2 bg-beacon-primary text-white rounded-lg
                             text-sm font-medium hover:bg-beacon-hover disabled:opacity-50 transition-colors"
                >
                  {updateMsgMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar mensagem
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import / Add leads (only DRAFT) */}
      {campaign.status === 'DRAFT' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Adicionar contatos</h2>
              <p className="text-xs text-gray-400 mt-0.5">Importe uma planilha ou adicione manualmente</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Download modelo */}
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg
                           text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Modelo CSV
              </button>

              {/* Adicionar manualmente */}
              <button
                onClick={() => setShowManualForm((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg
                           text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Adicionar manual
              </button>

              {/* Upload planilha */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-beacon-primary text-white rounded-lg
                                text-xs font-medium hover:bg-beacon-hover cursor-pointer transition-colors">
                {importMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Upload className="w-3.5 h-3.5" />
                }
                Importar planilha
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) importMutation.mutate(file)
                  }}
                />
              </label>
            </div>
          </div>

          {importMutation.isSuccess && (
            <p className="text-sm text-green-600">
              {(importMutation.data as any).imported} contatos importados,{' '}
              {(importMutation.data as any).skipped} duplicados ignorados.
            </p>
          )}

          {/* Formulário manual */}
          {showManualForm && (
            <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Adicionar contato</p>
                <button onClick={() => setShowManualForm(false)}>
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Telefone * <span className="text-gray-400">(ex: 5511999999999)</span></label>
                  <input
                    type="text"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                    placeholder="5511999999999"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-beacon-primary bg-white"
                  />
                </div>
                {(['var1','var2','var3','var4','var5'] as const).map((v, i) => (
                  <div key={v} className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      {varLabel(i + 1)}
                      <span className="text-gray-400 ml-1 font-normal">{'{{' + (i+1) + '}}'}</span>
                    </label>
                    <input
                      type="text"
                      value={manualForm[v]}
                      onChange={(e) => setManualForm({ ...manualForm, [v]: e.target.value })}
                      placeholder={i === 0 ? 'Ex: João' : ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-beacon-primary bg-white"
                    />
                  </div>
                ))}
              </div>
              {createLeadMutation.isError && (
                <p className="text-xs text-red-600">
                  {(createLeadMutation.error as any)?.response?.data?.message ?? 'Erro ao salvar'}
                </p>
              )}
              <button
                onClick={() => createLeadMutation.mutate()}
                disabled={!manualForm.phone.trim() || createLeadMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-beacon-primary text-white rounded-lg
                           text-sm font-medium hover:bg-beacon-hover disabled:opacity-50 transition-colors"
              >
                {createLeadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar contato
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Follow-up rules ─── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowFollowUps((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-beacon-primary" />
            <h2 className="font-semibold text-gray-800 text-sm">Follow-ups automáticos</h2>
            {followUpRules.length > 0 && (
              <span className="text-xs bg-beacon-primary text-white px-2 py-0.5 rounded-full">
                {followUpRules.length} configurado{followUpRules.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {showFollowUps
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {showFollowUps && (
          <div className="border-t border-gray-100 p-5 space-y-4">
            <p className="text-xs text-gray-400">
              Configure até 3 mensagens de follow-up enviadas automaticamente caso o lead não responda.
              Após o 3º follow-up sem resposta, o lead é movido para <strong>Sem Interesse</strong> no CRM.
            </p>

            {([0, 1, 2] as const).map((idx) => {
              const order    = idx + 1
              const existing = (followUpRules as any[]).find((r: any) => r.template?.order === order)
              const fu       = fuForms[idx]

              const updateFu = (patch: Partial<typeof fu>) => {
                setFuForms((prev) => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
              }

              return (
                <div key={idx} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        existing ? 'bg-beacon-primary' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {order}
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        Follow-up {order}
                        {existing && (
                          <span className="ml-2 text-xs text-green-600 font-normal">✓ Configurado</span>
                        )}
                      </span>
                    </div>
                    {existing && (
                      <button
                        onClick={() => deleteFuMutation.mutate(order)}
                        disabled={deleteFuMutation.isPending}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    )}
                  </div>

                  {/* Delay */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Enviar após</label>
                    <input
                      type="number"
                      min={1}
                      value={fu.delayValue}
                      onChange={(e) => updateFu({ delayValue: Math.max(1, Number(e.target.value)) })}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center
                                 focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                    />
                    <select
                      value={fu.delayUnit}
                      onChange={(e) => updateFu({ delayUnit: e.target.value as 'min' | 'h' })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white
                                 focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                    >
                      <option value="min">minutos</option>
                      <option value="h">horas</option>
                    </select>
                    <span className="text-xs text-gray-400">sem resposta</span>
                  </div>

                  {/* Editor de mensagem */}
                  <SpintextEditor
                    variations={fu.variations}
                    onChange={(v) => updateFu({ variations: v })}
                    activeIdx={fu.activeIdx}
                    onActiveChange={(i) => updateFu({ activeIdx: i })}
                    label={`Mensagem do follow-up ${order}`}
                    maxVariations={3}
                  />

                  <button
                    onClick={() => upsertFuMutation.mutate(idx)}
                    disabled={
                      upsertFuMutation.isPending ||
                      !fu.variations.some((p) => p.some((t) => t.trim()))
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-beacon-primary text-white rounded-lg
                               text-xs font-medium hover:bg-beacon-hover disabled:opacity-50 transition-colors"
                  >
                    {upsertFuMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {existing ? 'Atualizar follow-up' : 'Salvar follow-up'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Leads table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Leads</h2>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white
                       focus:outline-none focus:ring-1 focus:ring-beacon-primary"
          >
            <option value="">Todos os status</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {!leadsData || leadsData.leads.length === 0 ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-sm">Nenhum lead encontrado</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {leadsData.leads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 group">
                  <span className="text-sm text-gray-900 font-mono w-36 shrink-0">{lead.phone}</span>
                  {lead.var1 ? (
                    <span className="text-sm text-gray-600 truncate flex-1" title={`${varLabel(1)}: ${lead.var1}`}>
                      {lead.var1}
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${LEAD_STATUS_COLORS[lead.status]}`}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </span>
                  {lead.lastMessageAt && (
                    <span className="text-xs text-gray-400 shrink-0 w-20 text-right">
                      {new Date(lead.lastMessageAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setInboxLead(lead)}
                      title="Ver conversa"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditLead(lead)}
                      title="Editar dados"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {(lead.status === 'PENDING' || lead.status === 'QUEUED') && (
                      <button
                        onClick={() => setCancelLeadId(lead.id)}
                        title="Cancelar lead"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {leadsData.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Página {leadsData.page} de {leadsData.pages} — {leadsData.total} leads
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= leadsData.pages}
                    className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* ─── Modal Cancelar Lead ─── */}
      {cancelLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Cancelar lead</h3>
                <p className="text-xs text-gray-500 mt-0.5">O lead será removido da fila e marcado como Optou por sair.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCancelLeadId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                onClick={() => cancelLeadMutation.mutate(cancelLeadId)}
                disabled={cancelLeadMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {cancelLeadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Editar Vars do Lead ─── */}
      {editLeadData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Editar dados do lead</h3>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{editLeadData.phone}</p>
              </div>
              <button onClick={() => setEditLeadData(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {(['var1','var2','var3','var4','var5'] as const).map((v, i) => (
                <div key={v} className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    {varLabel(i + 1)}
                    <span className="text-gray-400 ml-1 font-normal font-mono">{`{{${i+1}}}`}</span>
                  </label>
                  <input
                    type="text"
                    value={editLeadForm[v]}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, [v]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                  />
                </div>
              ))}
            </div>
            {updateLeadVarsMutation.isError && (
              <p className="text-xs text-red-600">
                {(updateLeadVarsMutation.error as any)?.response?.data?.message ?? 'Erro ao salvar'}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditLeadData(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => updateLeadVarsMutation.mutate()}
                disabled={updateLeadVarsMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-beacon-primary hover:bg-beacon-hover rounded-lg disabled:opacity-50"
              >
                {updateLeadVarsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Inbox Slide-over ─── */}
      {inboxLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setInboxLead(null)} />
          <div className="relative flex flex-col bg-white w-full max-w-md shadow-2xl h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-full bg-beacon-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-beacon-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 font-mono">{inboxLead.phone}</p>
                {inboxLead.var1 && <p className="text-xs text-gray-500 truncate">{inboxLead.var1}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[inboxLead.status]}`}>
                {LEAD_STATUS_LABELS[inboxLead.status]}
              </span>
              <button onClick={() => setInboxLead(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messagesLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              )}
              {!messagesLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-2">
                  <MessageSquare className="w-8 h-8" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 space-y-1 ${
                    msg.direction === 'out'
                      ? 'bg-beacon-primary text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  }`}>
                    {msg.direction === 'out' && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Send className="w-3 h-3 opacity-60" />
                        <span className="text-[10px] opacity-60 uppercase tracking-wide">Enviado</span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className={`flex items-center justify-between gap-3 ${msg.direction === 'out' ? 'text-white/60' : 'text-gray-400'}`}>
                      <span className="text-[10px]">
                        {new Date(msg.at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </span>
                      {msg.direction === 'out' && msg.status === 'FAILED' && (
                        <span className="text-[10px] text-red-300 flex items-center gap-0.5">
                          <AlertCircle className="w-3 h-3" /> Falhou
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer info */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-[11px] text-gray-400 text-center">
                {messages.length} mensagem{messages.length !== 1 ? 's' : ''} · atualiza a cada 10s
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Editar Campanha ─── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-10">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-base">Editar campanha</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Nome da campanha</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-beacon-primary"
              />
            </div>

            {/* Canal */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Instância WhatsApp</label>
              <select
                value={editForm.channelId}
                onChange={(e) => setEditForm({ ...editForm, channelId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-beacon-primary"
              >
                <option value="">— Nenhuma —</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}{inst.status === 'CONNECTED' ? ' ✓' : ' (desconectado)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Delay */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Delay mínimo (seg)</label>
                <input
                  type="number"
                  min={120}
                  value={editForm.delayMinSec}
                  onChange={(e) => setEditForm({ ...editForm, delayMinSec: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Delay máximo (seg)</label>
                <input
                  type="number"
                  min={editForm.delayMinSec}
                  value={editForm.delayMaxSec}
                  onChange={(e) => setEditForm({ ...editForm, delayMaxSec: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                />
              </div>
            </div>

            {/* Janela de horário */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-700">Horário de disparo</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Mensagens só serão enviadas dentro da janela configurada</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, scheduleEnabled: !f.scheduleEnabled }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${editForm.scheduleEnabled ? 'bg-beacon-primary' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${editForm.scheduleEnabled ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {editForm.scheduleEnabled && (
                <div className="space-y-3 pl-1">
                  {/* Dias da semana */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">Dias permitidos</label>
                    <div className="flex gap-1.5">
                      {DAY_LABELS.map((label, idx) => {
                        const active = editForm.scheduleDays.includes(idx)
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? editForm.scheduleDays.filter(d => d !== idx)
                                : [...editForm.scheduleDays, idx].sort()
                              setEditForm(f => ({ ...f, scheduleDays: next }))
                            }}
                            className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                              active ? 'bg-beacon-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Horários */}
                  <div className="flex items-center gap-3">
                    <div className="space-y-1 flex-1">
                      <label className="text-xs font-medium text-gray-600">De</label>
                      <select
                        value={editForm.scheduleStartHour}
                        onChange={e => setEditForm(f => ({ ...f, scheduleStartHour: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                      >
                        {Array.from({length: 24}, (_, h) => (
                          <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 flex-1">
                      <label className="text-xs font-medium text-gray-600">Até</label>
                      <select
                        value={editForm.scheduleEndHour}
                        onChange={e => setEditForm(f => ({ ...f, scheduleEndHour: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                      >
                        {Array.from({length: 24}, (_, h) => (
                          <option key={h+1} value={h+1}>{String(h+1).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rótulos das variáveis */}
            <div className="space-y-2.5">
              <div>
                <p className="text-xs font-medium text-gray-700">Rótulos das variáveis</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Defina o nome de cada coluna antes de importar a lista. Ex: "Nome", "Empresa", "Cargo".
                </p>
              </div>
              <div className="space-y-2">
                {([1,2,3,4,5] as const).map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 w-8 shrink-0">{`{{${i}}}`}</span>
                    <input
                      type="text"
                      value={editForm.varLabels[i - 1]}
                      onChange={(e) => {
                        const next = [...editForm.varLabels]
                        next[i - 1] = e.target.value
                        setEditForm({ ...editForm, varLabels: next })
                      }}
                      placeholder={i === 1 ? 'Ex: Nome' : i === 2 ? 'Ex: Empresa' : `Variável ${i}`}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                    />
                  </div>
                ))}
              </div>
            </div>

            {updateMutation.isError && (
              <p className="text-xs text-red-600">
                {(updateMutation.error as any)?.response?.data?.message ?? 'Erro ao salvar'}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowEdit(false)}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => updateMutation.mutate(editForm)}
                disabled={updateMutation.isPending || !editForm.name.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                           bg-beacon-primary hover:bg-beacon-hover rounded-lg disabled:opacity-50"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
