/**
 * AgentDetail — Visão detalhada do agente com tabs (estilo GPT Maker)
 *
 * Tabs: Perfil | Treinamentos | Configurações | Testar
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Pencil, ArrowLeft, Bot, Brain, Settings2, BookOpen, Play,
  Trash2, Plus, FileText, Globe, Loader2, Send, Calendar, Link2, Unlink,
  Upload, Sparkles, Tag, X, Phone, Zap, ChevronRight, ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAgent, useUpdateAgent } from './hooks/useAgents'
import { api } from '@/services/api'

const statusVariant = { ACTIVE: 'active', PAUSED: 'paused', DRAFT: 'draft', DELETED: 'error' } as const
const statusLabel   = { ACTIVE: 'Ativo', PAUSED: 'Pausado', DRAFT: 'Rascunho', DELETED: 'Removido' }

const PURPOSE_LABELS: Record<string, string> = {
  qualification: 'Qualificação',
  qualification_scheduling: 'Qualificação + Agendamento',
  qualification_scheduling_reminder: 'Qualif. + Agenda + Lembrete',
  sales: 'Vendas',
  support: 'Suporte / SAC',
  reception: 'Recepção',
  reactivation: 'Reativação',
  survey: 'Pesquisa / NPS',
}

type Tab = 'profile' | 'trainings' | 'integrations' | 'settings' | 'test'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile',      label: 'Perfil',         icon: Bot },
  { id: 'trainings',    label: 'Treinamentos',   icon: BookOpen },
  { id: 'integrations', label: 'Integrações',    icon: Calendar },
  { id: 'settings',     label: 'Configurações',  icon: Settings2 },
  { id: 'test',         label: 'Testar',         icon: Play },
]

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: agent, isLoading } = useAgent(id ?? '')
  const [tab, setTab] = useState<Tab>('profile')

  // Treinamentos
  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings', id],
    queryFn: () => api.get(`/agents/${id}/trainings`).then((r) => r.data),
    enabled: !!id,
  })
  const [trainingType, setTrainingType] = useState<'text' | 'url' | 'upload'>('text')
  const [trainingTitle, setTrainingTitle] = useState('')
  const [trainingContent, setTrainingContent] = useState('')
  const [crawlEnabled, setCrawlEnabled] = useState(false)
  const [useAiProcessing, setUseAiProcessing] = useState(true)
  const createTraining = useMutation({
    mutationFn: () => api.post(`/agents/${id}/trainings`, {
      type: trainingType === 'upload' ? 'document' : trainingType,
      title: trainingTitle || undefined,
      content: trainingContent,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainings', id] })
      setTrainingTitle(''); setTrainingContent('')
    },
  })
  const processText = useMutation({
    mutationFn: () => api.post(`/agents/${id}/trainings/process-text`, {
      content: trainingContent, title: trainingTitle || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainings', id] })
      setTrainingTitle(''); setTrainingContent('')
    },
  })
  const processUrl = useMutation({
    mutationFn: () => api.post(`/agents/${id}/trainings/process-url`, {
      url: trainingContent, crawl: crawlEnabled, maxPages: 5,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainings', id] })
      setTrainingTitle(''); setTrainingContent('')
    },
  })
  const uploadFile = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post(`/agents/${id}/trainings/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainings', id] }),
  })
  const deleteTraining = useMutation({
    mutationFn: (tid: string) => api.delete(`/agents/${id}/trainings/${tid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainings', id] }),
  })

  // Google Calendar Integration
  const { data: calendarConfig } = useQuery({
    queryKey: ['calendar-config', id],
    queryFn: () => api.get(`/integrations/google/config/${id}`).then((r) => r.data).catch(() => null),
    enabled: !!id,
  })
  const { data: calendars = [] } = useQuery({
    queryKey: ['google-calendars', id],
    queryFn: () => api.get(`/integrations/google/calendars/${id}`).then((r) => r.data).catch(() => []),
    enabled: !!id && !!calendarConfig,
  })
  const disconnectCalendar = useMutation({
    mutationFn: () => api.delete(`/integrations/google/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-config', id] }); qc.invalidateQueries({ queryKey: ['google-calendars', id] }) },
  })
  const updateCalendarConfig = useMutation({
    mutationFn: (dto: any) => api.patch(`/integrations/google/config/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-config', id] }),
  })

  // Agent update (inline settings)
  const updateAgent = useUpdateAgent(id ?? '')

  // Settings
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Integration modals
  const [openModal, setOpenModal] = useState<'calendar' | 'leadDispatch' | null>(null)

  // Lead Dispatch
  const [dispatchPhone, setDispatchPhone] = useState(agent?.leadDispatchPhone ?? '')
  const updateLeadDispatch = useMutation({
    mutationFn: (dto: { leadDispatchEnabled?: boolean; leadDispatchPhone?: string }) =>
      api.patch(`/agents/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })

  // Testar
  const [testMsg, setTestMsg] = useState('')
  const [testReply, setTestReply] = useState<string | null>(null)
  const testMutation = useMutation({
    mutationFn: () => api.post(`/agents/${id}/test`, { message: testMsg }).then((r) => r.data),
    onSuccess: (data: any) => setTestReply(data.reply),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-beacon-primary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-white/50">Agente não encontrado.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/agents')}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/agents')} className="p-2 rounded-lg text-white/50 hover:bg-white/8">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-beacon-primary/20 flex items-center justify-center">
            <Bot className="w-6 h-6 text-beacon-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <Badge variant={statusVariant[agent.status]}>{statusLabel[agent.status]}</Badge>
            </div>
            <p className="text-sm text-white/50">{agent.description ?? 'Sem descrição'}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/agents/${agent.id}/edit`)}>
          <Pencil className="w-4 h-4" /> Editar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-beacon-primary text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ─── Tab: Perfil ─── */}
      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white/70">Informações</h3>
            {[
              ['Tipo', agent.agentType === 'ATIVO' ? 'Ativo (Vendas)' : 'Passivo (Chat IA)'],
              ['Objetivo', PURPOSE_LABELS[agent.purpose] ?? agent.purpose],
              ['Empresa', agent.companyName ?? '—'],
              ['Tom', agent.communicationTone ?? 'normal'],
              ['Criado', new Date(agent.createdAt).toLocaleString('pt-BR')],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-white/40">{label}</span>
                <span className="text-white">{value}</span>
              </div>
            ))}
          </div>

          {(agent.personality || agent.systemPrompt) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-beacon-primary" /> Personalidade
              </h3>
              <pre className="text-xs text-white/85 bg-white/6 p-3 rounded-lg whitespace-pre-wrap font-mono">
                {agent.personality ?? agent.systemPrompt}
              </pre>
            </div>
          )}

          {agent.actionPrompt && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Instrução de Ação</h3>
              <pre className="text-xs text-white/85 bg-white/6 p-3 rounded-lg whitespace-pre-wrap font-mono">
                {agent.actionPrompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Treinamentos ─── */}
      {tab === 'trainings' && (
        <div className="space-y-4">
          {/* Tabs tipo */}
          <div className="flex gap-2">
            {[
              { id: 'text' as const, label: 'Texto', icon: FileText },
              { id: 'url' as const, label: 'Website', icon: Globe },
              { id: 'upload' as const, label: 'Documento', icon: Upload },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTrainingType(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  trainingType === t.id ? 'bg-beacon-primary text-white' : 'bg-white/5 text-white/50 hover:text-white/80'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Form: Texto */}
          {trainingType === 'text' && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/70">Novo treinamento via texto</h3>
              <input
                value={trainingTitle}
                onChange={(e) => setTrainingTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
              <textarea
                value={trainingContent}
                onChange={(e) => setTrainingContent(e.target.value)}
                placeholder="Cole ou escreva o conteúdo para treinar a IA..."
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-y"
              />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/30">{trainingContent.length} caracteres</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={useAiProcessing} onChange={(e) => setUseAiProcessing(e.target.checked)}
                      className="w-3.5 h-3.5 accent-beacon-primary rounded" />
                    <span className="text-xs text-white/50 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Processar com IA
                    </span>
                  </label>
                </div>
                <Button
                  onClick={() => useAiProcessing ? processText.mutate() : createTraining.mutate()}
                  disabled={!trainingContent.trim() || processText.isPending || createTraining.isPending}
                  className="bg-beacon-primary"
                >
                  {(processText.isPending || createTraining.isPending)
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : useAiProcessing ? <Sparkles className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {useAiProcessing ? 'Processar' : 'Cadastrar'}
                </Button>
              </div>
              {useAiProcessing && (
                <p className="text-xs text-white/25">A IA vai extrair, categorizar e otimizar o conteúdo automaticamente.</p>
              )}
            </div>
          )}

          {/* Form: URL */}
          {trainingType === 'url' && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/70">Importar conteúdo de website</h3>
              <input
                value={trainingContent}
                onChange={(e) => setTrainingContent(e.target.value)}
                placeholder="https://exemplo.com.br"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={crawlEnabled} onChange={(e) => setCrawlEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 accent-beacon-primary rounded" />
                  <span className="text-xs text-white/50">Navegar links internos (até 5 páginas)</span>
                </label>
                <Button
                  onClick={() => processUrl.mutate()}
                  disabled={!trainingContent.trim() || processUrl.isPending}
                  className="bg-beacon-primary"
                >
                  {processUrl.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  Importar
                </Button>
              </div>
              <p className="text-xs text-white/25">O sistema vai extrair o texto do site, processar com IA e criar treinamentos categorizados.</p>
            </div>
          )}

          {/* Form: Upload */}
          {trainingType === 'upload' && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/70">Upload de documento</h3>
              <p className="text-xs text-white/40">Suporta .md, .pdf, .docx — até 10MB</p>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 py-8 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:border-beacon-primary/40 transition-colors">
                  <Upload className="w-5 h-5 text-white/30" />
                  <span className="text-sm text-white/40">Clique para selecionar arquivo</span>
                  <input
                    type="file"
                    accept=".md,.pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadFile.mutate(file)
                    }}
                  />
                </label>
              </div>
              {uploadFile.isPending && (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando documento...
                </div>
              )}
              <p className="text-xs text-white/25">O documento será extraído e processado com IA automaticamente.</p>
            </div>
          )}

          {/* Lista de treinamentos */}
          <div className="space-y-2">
            {trainings.length === 0 ? (
              <p className="text-center text-sm text-white/30 py-8">Nenhum treinamento cadastrado ainda.</p>
            ) : (
              trainings.map((t: any) => (
                <div key={t.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {t.type === 'text' && <FileText className="w-3.5 h-3.5 text-white/40" />}
                      {t.type === 'url' && <Globe className="w-3.5 h-3.5 text-white/40" />}
                      {t.type === 'document' && <Upload className="w-3.5 h-3.5 text-white/40" />}
                      {t.type === 'feedback' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                      <span className="text-xs font-semibold text-white/60 uppercase">{t.type}</span>
                      {t.category && t.category !== 'general' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-beacon-primary/15 text-beacon-primary border border-beacon-primary/20">
                          <Tag className="w-2.5 h-2.5" /> {t.category}
                        </span>
                      )}
                      {t.title && <span className="text-xs text-white/40">· {t.title}</span>}
                      {t.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                      {t.status === 'error' && <span className="text-[10px] text-red-400 font-semibold">ERRO</span>}
                    </div>
                    <p className="text-xs text-white/70 line-clamp-2">{t.content}</p>
                  </div>
                  <button
                    onClick={() => deleteTraining.mutate(t.id)}
                    className="p-1.5 text-white/30 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Integrações ─── */}
      {tab === 'integrations' && (
        <div className="space-y-3">
          {/* Card: Google Calendar */}
          <button
            onClick={() => setOpenModal('calendar')}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between hover:bg-white/8 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-beacon-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-white">Google Calendar</h3>
                <p className="text-xs text-white/40">
                  {calendarConfig ? `Conectado: ${calendarConfig.calendarName}` : 'Não conectado'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30" />
          </button>

          {/* Card: Disparo de Lead */}
          <button
            onClick={() => setOpenModal('leadDispatch')}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between hover:bg-white/8 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-white">Disparo de Lead</h3>
                <p className="text-xs text-white/40">
                  {agent.leadDispatchEnabled ? `Ativo: ${agent.leadDispatchPhone}` : 'Não configurado'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30" />
          </button>

          {/* ─── Modal: Google Calendar ─── */}
          {openModal === 'calendar' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpenModal(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-beacon-primary" />
                    <h2 className="text-base font-semibold text-gray-900">Google Calendar</h2>
                  </div>
                  <button onClick={() => setOpenModal(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-5">
                  {/* Conexão */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {calendarConfig ? `Conectado: ${calendarConfig.calendarName}` : 'Não conectado'}
                    </p>
                    {calendarConfig ? (
                      <button onClick={() => disconnectCalendar.mutate()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                        <Unlink className="w-3.5 h-3.5" /> Desconectar
                      </button>
                    ) : (
                      <a href={`/api/integrations/google/auth/${id}?tenantId=t1`}
                        className="flex items-center gap-1.5 px-4 py-2 bg-beacon-primary text-white rounded-lg text-sm font-medium hover:opacity-90">
                        <Link2 className="w-4 h-4" /> Conectar
                      </a>
                    )}
                  </div>

                  {calendarConfig && (<>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Agenda</label>
                      <select
                        value={calendarConfig.calendarId}
                        onChange={(e) => {
                          const cal = calendars.find((c: any) => c.id === e.target.value)
                          updateCalendarConfig.mutate({ calendarId: e.target.value, calendarName: cal?.summary ?? e.target.value })
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-beacon-primary"
                      >
                        {calendars.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.summary} {c.primary ? '(principal)' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Duração</label>
                      <div className="flex gap-2">
                        {[15, 30, 45, 60].map((min) => (
                          <button key={min} onClick={() => updateCalendarConfig.mutate({ slotDuration: min })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                              calendarConfig.slotDuration === min ? 'bg-beacon-primary text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}>
                            {min}min
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Título do evento</label>
                      <input
                        defaultValue={calendarConfig.eventTitle}
                        onBlur={(e) => updateCalendarConfig.mutate({ eventTitle: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-beacon-primary"
                        placeholder="Consulta - {userName}"
                      />
                    </div>

                    <div className="space-y-1 border-t border-gray-100 pt-4">
                      {[
                        { key: 'googleMeet', label: 'Google Meet', desc: 'Gerar link do Meet' },
                        { key: 'consultHours', label: 'Consulta de horários', desc: 'Agente consulta horários' },
                        { key: 'collectName', label: 'Coletar nome', desc: 'Solicitar nome do cliente' },
                        { key: 'collectEmail', label: 'Coletar email', desc: 'Solicitar email' },
                        { key: 'collectPhone', label: 'Coletar telefone', desc: 'Solicitar telefone' },
                        { key: 'sendSummary', label: 'Enviar resumo', desc: 'Resumo da conversa no evento' },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-2.5">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{item.label}</p>
                            <p className="text-xs text-gray-400">{item.desc}</p>
                          </div>
                          <button
                            onClick={() => updateCalendarConfig.mutate({ [item.key]: !(calendarConfig as any)[item.key] })}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              (calendarConfig as any)[item.key] ? 'bg-beacon-primary' : 'bg-gray-200'
                            }`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                              (calendarConfig as any)[item.key] ? 'left-[18px]' : 'left-0.5'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>)}

                  {!calendarConfig && (
                    <p className="text-xs text-gray-400">
                      Conecte o Google Calendar para que o agente consulte horários e agende consultas automaticamente.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── Modal: Disparo de Lead ─── */}
          {openModal === 'leadDispatch' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpenModal(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <h2 className="text-base font-semibold text-gray-900">Disparo de Lead</h2>
                  </div>
                  <button onClick={() => setOpenModal(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-5">
                  <p className="text-sm text-gray-500">
                    Quando o agente qualificar ou agendar um lead, envia um resumo automaticamente para o número configurado.
                  </p>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Ativar disparo</p>
                      <p className="text-xs text-gray-400">Envia resumo ao transferir para humano</p>
                    </div>
                    <button
                      onClick={() => updateLeadDispatch.mutate({ leadDispatchEnabled: !agent.leadDispatchEnabled })}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        agent.leadDispatchEnabled ? 'bg-beacon-primary' : 'bg-gray-200'
                      }`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                        agent.leadDispatchEnabled ? 'left-[18px]' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Número de destino</label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                          value={dispatchPhone}
                          onChange={(e) => setDispatchPhone(e.target.value)}
                          placeholder="5567999999999"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-beacon-primary"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => updateLeadDispatch.mutate({ leadDispatchPhone: dispatchPhone })}
                        disabled={!dispatchPhone.trim() || updateLeadDispatch.isPending}
                      >
                        {updateLeadDispatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400">Formato: código do país + DDD + número (ex: 5567999999999)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Configurações ─── */}
      {tab === 'settings' && (
        <div className="space-y-4">
          {/* Comportamento */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-1">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Comportamento</h3>
            {[
              { key: 'useEmojis', label: 'Usar emojis', desc: 'Permite que o agente use emojis nas respostas', value: agent.useEmojis },
              { key: 'splitResponse', label: 'Dividir resposta', desc: 'Separa mensagens longas em várias mensagens curtas', value: agent.splitResponse },
              { key: 'restrictTopics', label: 'Restringir temas', desc: 'O agente só fala sobre assuntos da base de conhecimento', value: agent.restrictTopics },
              { key: 'signName', label: 'Assinar nome', desc: 'Adiciona o nome do agente ao final de cada mensagem', value: agent.signName },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-white/80">{item.label}</p>
                  <p className="text-xs text-white/30">{item.desc}</p>
                </div>
                <button
                  onClick={() => updateAgent.mutateAsync({ [item.key]: !item.value })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    item.value ? 'bg-beacon-primary' : 'bg-white/15'
                  }`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    item.value ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          {/* Limites */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white/70 mb-1">Limites</h3>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white/80">Limite de trocas</p>
                <p className="text-xs text-white/30">Encerra a conversa após um número máximo de interações</p>
              </div>
              <div className="flex items-center gap-2">
                {agent.limitTurns && (
                  <span className="text-xs text-white/50 bg-white/8 px-2 py-1 rounded">{agent.maxTurns} trocas</span>
                )}
                <button
                  onClick={() => updateAgent.mutateAsync({ limitTurns: !agent.limitTurns })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    agent.limitTurns ? 'bg-beacon-primary' : 'bg-white/15'
                  }`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    agent.limitTurns ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white/80">Fallback</p>
                <p className="text-xs text-white/30">Envia mensagem de segurança se a IA falhar</p>
              </div>
              <button
                onClick={() => updateAgent.mutateAsync({ fallbackEnabled: !agent.fallbackEnabled })}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  agent.fallbackEnabled ? 'bg-beacon-primary' : 'bg-white/15'
                }`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  agent.fallbackEnabled ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white/80">Inatividade</p>
                <p className="text-xs text-white/30">O que fazer se o cliente parar de responder</p>
              </div>
              <span className="text-xs text-white/50 bg-white/8 px-2 py-1 rounded">
                {agent.inactivityMinutes ?? 10}min → {
                  (agent.inactivityAction ?? 'close') === 'close' ? 'Finalizar' :
                  agent.inactivityAction === 'transfer' ? 'Transferir' : 'Mensagem'
                }
              </span>
            </div>
          </div>

          {/* Avançado (colapsável) */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
            >
              <div>
                <h3 className="text-sm font-semibold text-white/70">Avançado</h3>
                <p className="text-xs text-white/30">Parâmetros técnicos do modelo de IA</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            {showAdvanced && (
              <div className="px-5 pb-5 space-y-3 border-t border-white/10">
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="text-sm font-medium text-white/80">Temperatura</p>
                    <p className="text-xs text-white/30">Controla a criatividade. Menor = mais previsível, maior = mais criativo</p>
                  </div>
                  <span className="text-sm text-white font-medium">{agent.temperature.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="text-sm font-medium text-white/80">Max Tokens</p>
                    <p className="text-xs text-white/30">Tamanho máximo da resposta da IA em tokens (~palavras)</p>
                  </div>
                  <span className="text-sm text-white font-medium">{agent.maxTokens}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="text-sm font-medium text-white/80">Memória</p>
                    <p className="text-xs text-white/30">Quantas mensagens anteriores a IA considera ao responder</p>
                  </div>
                  <span className="text-sm text-white font-medium">{agent.historyLimit} msgs</span>
                </div>
                <div className="pt-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent.id}/edit`)}>
                    <Settings2 className="w-3.5 h-3.5" /> Editar no wizard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Testar ─── */}
      {tab === 'test' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Play className="w-4 h-4 text-beacon-primary" /> Teste sua IA
          </h3>

          {testReply && (
            <div className="bg-beacon-primary/10 border border-beacon-primary/20 rounded-lg p-4">
              <p className="text-xs text-white/40 mb-1">Resposta do agente:</p>
              <p className="text-sm text-white whitespace-pre-wrap">{testReply}</p>
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              placeholder="Envie uma mensagem para testar..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30"
              onKeyDown={(e) => { if (e.key === 'Enter' && testMsg.trim()) testMutation.mutate() }}
            />
            <Button
              onClick={() => testMutation.mutate()}
              disabled={!testMsg.trim() || testMutation.isPending}
              className="bg-beacon-primary"
            >
              {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
