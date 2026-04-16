/**
 * AgentDetail — Layout GPT Maker-style com sidebar + conteúdo
 *
 * Sidebar: avatar, nome, status, menu lateral, botão "Teste sua IA"
 * Seções: Perfil | Trabalho | Treinamentos | Integrações | Canais | Configurações
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bot, Settings2, BookOpen, Briefcase, Link2, Unlink,
  Trash2, FileText, Globe, Loader2, Send, Calendar,
  Upload, Sparkles, X, Zap, ChevronDown,
  MessageSquare, ArrowLeft, Pencil, Play, Radio,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAgent, useUpdateAgent } from './hooks/useAgents'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

// ─── Constants ──────────────────────────────────────────────────────────────

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

const PURPOSE_OPTIONS = [
  { id: 'qualification', label: 'Qualificação' },
  { id: 'qualification_scheduling', label: 'Qualif. + Agenda' },
  { id: 'qualification_scheduling_reminder', label: 'Qualif. + Agenda + Lembrete' },
  { id: 'sales', label: 'Vendas' },
  { id: 'support', label: 'Suporte / SAC' },
  { id: 'reception', label: 'Recepção' },
  { id: 'reactivation', label: 'Reativação' },
  { id: 'survey', label: 'Pesquisa / NPS' },
]

const TONE_OPTIONS = [
  { id: 'formal', label: 'FORMAL' },
  { id: 'normal', label: 'NORMAL' },
  { id: 'casual', label: 'DESCONTRAÍDA' },
]

type Section = 'profile' | 'work' | 'trainings' | 'integrations' | 'channels' | 'settings'

const MENU_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'profile',      label: 'Perfil',         icon: Bot },
  { id: 'work',         label: 'Trabalho',       icon: Briefcase },
  { id: 'trainings',    label: 'Treinamentos',   icon: BookOpen },
  { id: 'integrations', label: 'Integrações',    icon: Link2 },
  { id: 'channels',     label: 'Canais',         icon: Radio },
  { id: 'settings',     label: 'Configurações',  icon: Settings2 },
]

// ─── Main Component ─────────────────────────────────────────────────────────

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: agent, isLoading } = useAgent(id ?? '')
  const [section, setSection] = useState<Section>('profile')
  const updateAgent = useUpdateAgent(id ?? '')

  // AI Refine
  const [, setRefining] = useState<string | null>(null)
  const generateDna = useMutation({
    mutationFn: () => api.post(`/agents/${id}/generate-dna`).then((r) => r.data),
    onSuccess: async (data: any) => {
      await updateAgent.mutateAsync({ personality: data.personality, actionPrompt: data.actionPrompt, conversationFlow: data.conversationFlow })
      toast({ title: 'DNA gerado com sucesso', type: 'success' })
      setRefining(null)
    },
  })
  const refinePersonality = useMutation({
    mutationFn: () => api.post(`/agents/${id}/refine-personality`).then((r) => r.data),
    onSuccess: async (data: any) => {
      await updateAgent.mutateAsync({ personality: data.personality })
      toast({ title: 'Personalidade refinada', type: 'success' })
      setRefining(null)
    },
  })
  const refineAction = useMutation({
    mutationFn: () => api.post(`/agents/${id}/refine-action`).then((r) => r.data),
    onSuccess: async (data: any) => {
      await updateAgent.mutateAsync({ actionPrompt: data.actionPrompt })
      toast({ title: 'Instrução refinada', type: 'success' })
      setRefining(null)
    },
  })

  // Trainings
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
      title: trainingTitle || undefined, content: trainingContent,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trainings', id] }); setTrainingTitle(''); setTrainingContent('') },
  })
  const processText = useMutation({
    mutationFn: () => api.post(`/agents/${id}/trainings/process-text`, { content: trainingContent, title: trainingTitle || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trainings', id] }); setTrainingTitle(''); setTrainingContent('') },
  })
  const processUrl = useMutation({
    mutationFn: () => api.post(`/agents/${id}/trainings/process-url`, { url: trainingContent, crawl: crawlEnabled, maxPages: 5 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trainings', id] }); setTrainingTitle(''); setTrainingContent('') },
  })
  const uploadFile = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData(); form.append('file', file)
      return api.post(`/agents/${id}/trainings/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainings', id] }),
  })
  const deleteTraining = useMutation({
    mutationFn: (tid: string) => api.delete(`/agents/${id}/trainings/${tid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainings', id] }),
  })

  // Google Calendar
  const { data: calendarConfig } = useQuery({
    queryKey: ['calendar-config', id],
    queryFn: () => api.get(`/integrations/google/config/${id}`).then((r) => r.data).catch(() => null),
    enabled: !!id,
  })
  const disconnectCalendar = useMutation({
    mutationFn: () => api.delete(`/integrations/google/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-config', id] }) },
  })
  const { data: calendars = [] } = useQuery({
    queryKey: ['google-calendars', id],
    queryFn: () => api.get(`/integrations/google/calendars/${id}`).then((r) => r.data).catch(() => []),
    enabled: !!id && !!calendarConfig,
  })
  const updateCalendarConfig = useMutation({
    mutationFn: (dto: any) => api.patch(`/integrations/google/config/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-config', id] }),
  })

  // Integration modals
  const [integrationModal, setIntegrationModal] = useState<'calendar' | 'webhook' | null>(null)

  // Lead Dispatch
  const [dispatchPhone, setDispatchPhone] = useState('')
  const updateLeadDispatch = useMutation({
    mutationFn: (dto: any) => api.patch(`/agents/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })

  // Channels
  const { data: channelAgents = [] } = useQuery({
    queryKey: ['channel-agents', id],
    queryFn: () => api.get(`/chat-ia`).then((r) => (r.data as any[]).filter((ca: any) => ca.agentId === id)),
    enabled: !!id,
  })

  // Test
  const [testMsg, setTestMsg] = useState('')
  const [testReply, setTestReply] = useState<string | null>(null)
  const [showTest, setShowTest] = useState(false)
  const testMutation = useMutation({
    mutationFn: () => api.post(`/agents/${id}/test`, { message: testMsg }).then((r) => r.data),
    onSuccess: (data: any) => setTestReply(data.reply),
  })

  // Settings
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [configSubTab, setConfigSubTab] = useState<'conversa' | 'inatividade' | 'lembretes'>('conversa')

  // Init dispatch phone from agent
  useEffect(() => {
    if (agent?.leadDispatchPhone && !dispatchPhone) setDispatchPhone(agent.leadDispatchPhone)
  }, [agent?.leadDispatchPhone])

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#0891B2]" /></div>
  }
  if (!agent) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-400">Agente não encontrado.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/agents')}><ArrowLeft className="w-4 h-4" /> Voltar</Button>
      </div>
    )
  }

  const save = async (data: any) => {
    await updateAgent.mutateAsync(data)
    toast({ title: 'Salvo', type: 'success' })
  }

  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-88px)]">
      {/* ═══ SIDEBAR ═══ */}
      <div className="w-64 shrink-0 border-r border-gray-100 bg-white flex flex-col">
        {/* Back */}
        <button onClick={() => navigate('/agents')} className="flex items-center gap-2 px-5 py-3 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Agent info */}
        <div className="px-5 pb-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0891B2]/10 flex items-center justify-center mx-auto mb-3">
            <Bot className="w-8 h-8 text-[#0891B2]" />
          </div>
          <h2 className="text-sm font-bold text-[#134E4A]">{agent.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{PURPOSE_LABELS[agent.purpose] ?? agent.purpose} em {agent.companyName ?? '—'}</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className={cn('w-2 h-2 rounded-full', agent.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300')} />
            <span className="text-xs text-gray-500">{agent.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 space-y-0.5">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const active = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active ? 'bg-[#0891B2]/10 text-[#0891B2]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Test button */}
        <div className="p-4">
          <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490]" onClick={() => setShowTest(true)}>
            <Play className="w-4 h-4" /> Teste sua IA
          </Button>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto bg-[#F5FAFA] p-8">
        {/* ─── Perfil ─── */}
        {section === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-lg font-bold text-[#134E4A]">Informações pessoais</h2>

            <div className="grid grid-cols-[1fr_auto] gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600">Nome do agente</label>
                <Input defaultValue={agent.name} onBlur={(e) => save({ name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600">Comunicação</label>
                <div className="flex gap-1">
                  {TONE_OPTIONS.map((t) => (
                    <button key={t.id} onClick={() => save({ communicationTone: t.id })}
                      className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                        agent.communicationTone === t.id ? 'bg-[#0891B2] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      )}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">Comportamento</label>
              <p className="text-xs text-gray-400">Descreva como o agente deve se comportar durante a conversa.</p>
              <div className="flex gap-2 py-1">
                <button
                  onClick={() => { setRefining('personality'); refinePersonality.mutate() }}
                  disabled={refinePersonality.isPending || !agent.personality}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#0891B2] bg-[#0891B2]/10 rounded-lg hover:bg-[#0891B2]/20 disabled:opacity-40 transition-colors"
                >
                  {refinePersonality.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Refinar com IA
                </button>
                <button
                  onClick={() => { setRefining('dna'); generateDna.mutate() }}
                  disabled={generateDna.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-40 transition-colors"
                >
                  {generateDna.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Gerar DNA
                </button>
              </div>
              <textarea
                key={agent.personality ?? 'empty'}
                defaultValue={agent.personality ?? ''}
                onBlur={(e) => save({ personality: e.target.value })}
                rows={10}
                className="w-full px-4 py-3 text-sm text-[#134E4A] bg-white rounded-xl border border-gray-200 resize-y focus:outline-none focus:border-[#0891B2] focus:ring-2 focus:ring-[#0891B2]/10"
              />
            </div>
          </div>
        )}

        {/* ─── Trabalho ─── */}
        {section === 'work' && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-lg font-bold text-[#134E4A]">Informações sobre trabalho</h2>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">Finalidade</label>
              <div className="grid grid-cols-4 gap-2">
                {PURPOSE_OPTIONS.map((opt) => (
                  <button key={opt.id} onClick={() => save({ purpose: opt.id })}
                    className={cn('px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors border-2',
                      agent.purpose === opt.id ? 'border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600">Empresa</label>
                <Input defaultValue={agent.companyName ?? ''} onBlur={(e) => save({ companyName: e.target.value })} placeholder="Nome da empresa" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600">Site oficial (opcional)</label>
                <Input defaultValue={agent.companyUrl ?? ''} onBlur={(e) => save({ companyUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">Descrição da empresa</label>
              <textarea
                defaultValue={agent.description ?? ''}
                onBlur={(e) => save({ description: e.target.value })}
                rows={4}
                placeholder="Descreva brevemente o que a empresa faz..."
                className="w-full px-4 py-3 text-sm text-[#134E4A] bg-white rounded-xl border border-gray-200 resize-y focus:outline-none focus:border-[#0891B2] focus:ring-2 focus:ring-[#0891B2]/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">Instrução de ação</label>
              <p className="text-xs text-gray-400">O que o agente deve fazer nesta conversa especificamente.</p>
              <div className="flex gap-2 py-1">
                <button
                  onClick={() => { setRefining('action'); refineAction.mutate() }}
                  disabled={refineAction.isPending || !agent.actionPrompt}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#0891B2] bg-[#0891B2]/10 rounded-lg hover:bg-[#0891B2]/20 disabled:opacity-40 transition-colors"
                >
                  {refineAction.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Refinar com IA
                </button>
              </div>
              <textarea
                key={agent.actionPrompt ?? 'empty'}
                defaultValue={agent.actionPrompt ?? ''}
                onBlur={(e) => save({ actionPrompt: e.target.value })}
                rows={8}
                className="w-full px-4 py-3 text-sm text-[#134E4A] bg-white rounded-xl border border-gray-200 resize-y font-mono focus:outline-none focus:border-[#0891B2] focus:ring-2 focus:ring-[#0891B2]/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-600">Fluxo conversacional (opcional)</label>
              <p className="text-xs text-gray-400">Sobrescreve o fluxo padrão do arquétipo.</p>
              <textarea
                defaultValue={agent.conversationFlow ?? ''}
                onBlur={(e) => save({ conversationFlow: e.target.value })}
                rows={5}
                placeholder="1. Cumprimentar&#10;2. Entender necessidade&#10;3. Qualificar&#10;4. Agendar"
                className="w-full px-4 py-3 text-sm text-[#134E4A] bg-white rounded-xl border border-gray-200 resize-y font-mono focus:outline-none focus:border-[#0891B2] focus:ring-2 focus:ring-[#0891B2]/10"
              />
            </div>
          </div>
        )}

        {/* ─── Treinamentos ─── */}
        {section === 'trainings' && (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-lg font-bold text-[#134E4A]">Treinamentos</h2>

            <div className="flex gap-2">
              {[
                { id: 'text' as const, label: 'Texto', icon: FileText },
                { id: 'url' as const, label: 'Website', icon: Globe },
                { id: 'upload' as const, label: 'Documento', icon: Upload },
              ].map((t) => (
                <button key={t.id} onClick={() => setTrainingType(t.id)}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    trainingType === t.id ? 'bg-[#0891B2] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  )}>
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </div>

            {trainingType === 'text' && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <input value={trainingTitle} onChange={(e) => setTrainingTitle(e.target.value)} placeholder="Título (opcional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0891B2]" />
                <textarea value={trainingContent} onChange={(e) => setTrainingContent(e.target.value)} placeholder="Cole ou escreva o conteúdo..."
                  rows={5} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-[#0891B2]" />
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={useAiProcessing} onChange={(e) => setUseAiProcessing(e.target.checked)} className="accent-[#0891B2]" />
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Processar com IA</span>
                  </label>
                  <Button onClick={() => useAiProcessing ? processText.mutate() : createTraining.mutate()}
                    disabled={!trainingContent.trim() || processText.isPending || createTraining.isPending}>
                    {(processText.isPending || createTraining.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {useAiProcessing ? 'Processar' : 'Cadastrar'}
                  </Button>
                </div>
              </div>
            )}

            {trainingType === 'url' && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <input value={trainingContent} onChange={(e) => setTrainingContent(e.target.value)} placeholder="https://exemplo.com.br"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0891B2]" />
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={crawlEnabled} onChange={(e) => setCrawlEnabled(e.target.checked)} className="accent-[#0891B2]" />
                    <span className="text-xs text-gray-500">Navegar links internos (até 5 páginas)</span>
                  </label>
                  <Button onClick={() => processUrl.mutate()} disabled={!trainingContent.trim() || processUrl.isPending}>
                    {processUrl.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} Importar
                  </Button>
                </div>
              </div>
            )}

            {trainingType === 'upload' && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <label className="flex items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#0891B2]/40 transition-colors">
                  <Upload className="w-5 h-5 text-gray-300" />
                  <span className="text-sm text-gray-400">Clique para selecionar (.md, .pdf, .docx)</span>
                  <input type="file" accept=".md,.pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile.mutate(f) }} />
                </label>
                {uploadFile.isPending && <p className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processando...</p>}
              </div>
            )}

            <div className="space-y-2">
              {trainings.length === 0 ? (
                <p className="text-center text-sm text-gray-300 py-8">Nenhum treinamento cadastrado.</p>
              ) : trainings.map((t: any) => (
                <div key={t.id} className="bg-white border border-gray-100 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-gray-400 uppercase">{t.type}</span>
                      {t.category && t.category !== 'general' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#0891B2]/10 text-[#0891B2]">{t.category}</span>
                      )}
                      {t.title && <span className="text-xs text-gray-400">· {t.title}</span>}
                      {t.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-amber-500" />}
                      {t.status === 'error' && <span className="text-[10px] text-red-500 font-semibold">ERRO</span>}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                  </div>
                  <button onClick={() => deleteTraining.mutate(t.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Integrações ─── */}
        {section === 'integrations' && (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-lg font-bold text-[#134E4A]">Integrações</h2>
            <p className="text-sm text-gray-400">Conecte seu agente a outros aplicativos para obter informações mais precisas ou acionar ações.</p>

            <div className="grid grid-cols-3 gap-4">
              {/* Google Calendar */}
              <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                <Calendar className="w-10 h-10 text-[#0891B2]" />
                <div>
                  <h3 className="text-sm font-bold text-[#134E4A]">Google Calendar</h3>
                  <p className="text-xs text-gray-400 mt-1">Agende consultas e reuniões automaticamente durante a conversa.</p>
                </div>
                {calendarConfig ? (
                  <button onClick={() => setIntegrationModal('calendar')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0891B2] text-white rounded-lg text-sm font-medium hover:bg-[#0E7490]">
                    Configurar
                  </button>
                ) : (
                  <a href={`/api/integrations/google/auth/${id}?tenantId=t1`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0891B2] text-white rounded-lg text-sm font-medium hover:bg-[#0E7490]">
                    Conectar
                  </a>
                )}
              </div>

              {/* Disparo de Lead */}
              <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                <Zap className="w-10 h-10 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-[#134E4A]">Disparo de Lead</h3>
                  <p className="text-xs text-gray-400 mt-1">Envie resumo do lead qualificado para a equipe de agendamento.</p>
                </div>
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Ativar</span>
                    <button onClick={() => updateLeadDispatch.mutate({ leadDispatchEnabled: !agent.leadDispatchEnabled })}
                      className={cn('relative w-9 h-5 rounded-full transition-colors', agent.leadDispatchEnabled ? 'bg-[#0891B2]' : 'bg-gray-200')}>
                      <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', agent.leadDispatchEnabled ? 'left-[18px]' : 'left-0.5')} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <input value={dispatchPhone} onChange={(e) => setDispatchPhone(e.target.value)} placeholder="5567..."
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#0891B2]" />
                    <Button size="sm" onClick={() => updateLeadDispatch.mutate({ leadDispatchPhone: dispatchPhone })} disabled={!dispatchPhone.trim()}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Webhook */}
              <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                <Globe className="w-10 h-10 text-violet-500" />
                <div>
                  <h3 className="text-sm font-bold text-[#134E4A]">Webhook</h3>
                  <p className="text-xs text-gray-400 mt-1">Dispare eventos para sistemas externos quando o agente qualificar ou transferir.</p>
                </div>
                <button onClick={() => setIntegrationModal('webhook')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600">
                  Configurar
                </button>
              </div>
            </div>

            {/* ═══ Modal: Calendar Config ═══ */}
            {integrationModal === 'calendar' && calendarConfig && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIntegrationModal(null)}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-[#134E4A] flex items-center gap-2"><Calendar className="w-5 h-5 text-[#0891B2]" /> Google Calendar</h2>
                    <button onClick={() => setIntegrationModal(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="px-6 py-5 space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">Conectado: {calendarConfig.calendarName}</p>
                      <button onClick={() => { disconnectCalendar.mutate(); setIntegrationModal(null) }}
                        className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
                        <Unlink className="w-3.5 h-3.5" /> Desconectar
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Agenda</label>
                      <select value={calendarConfig.calendarId}
                        onChange={(e) => {
                          const cal = calendars.find((c: any) => c.id === e.target.value)
                          updateCalendarConfig.mutate({ calendarId: e.target.value, calendarName: cal?.summary ?? e.target.value })
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#0891B2]">
                        {calendars.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.summary} {c.primary ? '(principal)' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Duração do agendamento</label>
                      <div className="flex gap-2">
                        {[15, 30, 45, 60].map((min) => (
                          <button key={min} onClick={() => updateCalendarConfig.mutate({ slotDuration: min })}
                            className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                              calendarConfig.slotDuration === min ? 'bg-[#0891B2] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            )}>
                            {min}min
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Título do evento</label>
                      <input defaultValue={calendarConfig.eventTitle}
                        onBlur={(e) => updateCalendarConfig.mutate({ eventTitle: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0891B2]"
                        placeholder="Consulta - {userName}" />
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
                          <button onClick={() => updateCalendarConfig.mutate({ [item.key]: !(calendarConfig as any)[item.key] })}
                            className={cn('relative w-9 h-5 rounded-full transition-colors',
                              (calendarConfig as any)[item.key] ? 'bg-[#0891B2]' : 'bg-gray-200'
                            )}>
                            <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                              (calendarConfig as any)[item.key] ? 'left-[18px]' : 'left-0.5'
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Modal: Webhook Config ═══ */}
            {integrationModal === 'webhook' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIntegrationModal(null)}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-[#134E4A] flex items-center gap-2"><Globe className="w-5 h-5 text-violet-500" /> Webhook de Eventos</h2>
                    <button onClick={() => setIntegrationModal(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="px-6 py-5 space-y-5">
                    <p className="text-sm text-gray-500">Dispare eventos para sistemas externos (CRM, N8N, Make, Zapier) quando ações acontecerem na conversa.</p>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Eventos disponíveis</p>
                      {[
                        { event: 'lead.qualified', label: 'Lead qualificado', desc: 'Quando o agente qualifica um lead com nome + interesse' },
                        { event: 'lead.transferred', label: 'Lead transferido', desc: 'Quando o agente transfere para atendente humano' },
                        { event: 'appointment.created', label: 'Agendamento criado', desc: 'Quando um evento é criado no Google Calendar' },
                        { event: 'conversation.closed', label: 'Conversa encerrada', desc: 'Quando a conversa é fechada' },
                      ].map((item) => (
                        <div key={item.event} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{item.label}</p>
                            <p className="text-xs text-gray-400">{item.desc}</p>
                          </div>
                          <code className="text-[10px] text-violet-500 bg-violet-50 px-2 py-1 rounded">{item.event}</code>
                        </div>
                      ))}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-xs text-amber-700">Em breve — esta integração será implementada na próxima atualização. Você poderá configurar URLs de destino e selecionar quais eventos disparar.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Canais ─── */}
        {section === 'channels' && (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-lg font-bold text-[#134E4A]">Canais vinculados</h2>
            <p className="text-sm text-gray-400">Canais de WhatsApp conectados a este agente.</p>

            {channelAgents.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
                <Radio className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Nenhum canal vinculado.</p>
                <p className="text-xs text-gray-300 mt-1">Vincule um canal em Chat IA no menu principal.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {channelAgents.map((ca: any) => (
                  <div key={ca.id} className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#134E4A]">{ca.name}</h3>
                        <p className="text-xs text-gray-400">Modelo: {ca.llmModel} · {ca.isActive ? 'Ativo' : 'Inativo'}</p>
                      </div>
                    </div>
                    <Badge variant={ca.isActive ? 'active' : 'draft'}>{ca.isActive ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Configurações ─── */}
        {section === 'settings' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-lg font-bold text-[#134E4A]">Preferências da conversa</h2>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { id: 'conversa' as const, label: 'Conversa' },
                { id: 'inatividade' as const, label: 'Inatividade' },
                { id: 'lembretes' as const, label: 'Lembretes' },
              ].map((t) => (
                <button key={t.id} onClick={() => setConfigSubTab(t.id)}
                  className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                    configSubTab === t.id ? 'bg-white text-[#134E4A] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  )}>
                  {t.label}
                </button>
              ))}
            </div>

            {configSubTab === 'conversa' && (
              <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-1">
                {[
                  { key: 'fallbackEnabled', label: 'Transferir para humano', desc: 'O agente transfere quando não consegue responder', value: agent.fallbackEnabled },
                  { key: 'useEmojis', label: 'Usar emojis nas respostas', desc: 'Define se o agente pode utilizar emojis', value: agent.useEmojis },
                  { key: 'signName', label: 'Assinar nome do agente', desc: 'Adiciona assinatura em cada resposta', value: agent.signName },
                  { key: 'restrictTopics', label: 'Restringir temas permitidos', desc: 'O agente não fala sobre outros assuntos', value: agent.restrictTopics },
                  { key: 'splitResponse', label: 'Dividir resposta em partes', desc: 'Mensagens longas são separadas em várias', value: agent.splitResponse },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-[#134E4A]">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <button onClick={() => save({ [item.key]: !item.value })}
                      className={cn('relative w-9 h-5 rounded-full transition-colors', item.value ? 'bg-[#0891B2]' : 'bg-gray-200')}>
                      <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', item.value ? 'left-[18px]' : 'left-0.5')} />
                    </button>
                  </div>
                ))}

                {/* Advanced */}
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full pt-3 mt-2 border-t border-gray-100">
                  <span className="text-sm font-medium text-gray-400">Avançado</span>
                  <ChevronDown className={cn('w-4 h-4 text-gray-300 transition-transform', showAdvanced && 'rotate-180')} />
                </button>
                {showAdvanced && (
                  <div className="space-y-3 pt-2">
                    {[
                      { label: 'Temperatura', desc: 'Menor = previsível, maior = criativo', value: agent.temperature.toFixed(1) },
                      { label: 'Max Tokens', desc: 'Tamanho máximo da resposta', value: String(agent.maxTokens) },
                      { label: 'Memória', desc: 'Mensagens anteriores consideradas', value: `${agent.historyLimit} msgs` },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-1">
                        <div>
                          <p className="text-sm text-gray-500">{item.label}</p>
                          <p className="text-xs text-gray-300">{item.desc}</p>
                        </div>
                        <span className="text-sm font-medium text-[#134E4A]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {configSubTab === 'inatividade' && (
              <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
                <p className="text-xs text-gray-400">Configure ações quando o cliente parar de responder.</p>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Se não responder em</span>
                  <span className="text-sm font-semibold text-[#134E4A] bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                    {agent.inactivityMinutes ?? 10} min
                  </span>
                  <span className="text-sm text-gray-500">o agente deve</span>
                  <span className="text-sm font-semibold text-[#134E4A] bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                    {(agent.inactivityAction ?? 'close') === 'close' ? 'Finalizar' : agent.inactivityAction === 'transfer' ? 'Transferir' : 'Enviar mensagem'}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent.id}/edit`)}>
                  <Pencil className="w-3.5 h-3.5" /> Editar no wizard
                </Button>
              </div>
            )}

            {configSubTab === 'lembretes' && (
              <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
                <p className="text-xs text-gray-400">Envie lembretes automáticos antes dos agendamentos via WhatsApp.</p>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-[#134E4A]">Ativar lembretes</p>
                    <p className="text-xs text-gray-400">Envia mensagem antes do agendamento</p>
                  </div>
                  <button onClick={() => save({ reminderEnabled: !agent.reminderEnabled })}
                    className={cn('relative w-9 h-5 rounded-full transition-colors', agent.reminderEnabled ? 'bg-[#0891B2]' : 'bg-gray-200')}>
                    <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', agent.reminderEnabled ? 'left-[18px]' : 'left-0.5')} />
                  </button>
                </div>

                {agent.reminderEnabled && (<>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Quanto tempo antes?</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Enviar lembrete</span>
                      <input
                        type="number"
                        min={0}
                        max={72}
                        defaultValue={Math.floor((agent.reminderMinutes ?? 120) / 60)}
                        onBlur={(e) => {
                          const hours = Number(e.target.value) || 0
                          const currentMin = (agent.reminderMinutes ?? 120) % 60
                          save({ reminderMinutes: hours * 60 + currentMin })
                        }}
                        className="w-16 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-[#134E4A] focus:outline-none focus:border-[#0891B2]"
                      />
                      <span className="text-sm text-gray-500">horas e</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        defaultValue={(agent.reminderMinutes ?? 120) % 60}
                        onBlur={(e) => {
                          const minutes = Number(e.target.value) || 0
                          const currentHours = Math.floor((agent.reminderMinutes ?? 120) / 60)
                          save({ reminderMinutes: currentHours * 60 + minutes })
                        }}
                        className="w-16 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-[#134E4A] focus:outline-none focus:border-[#0891B2]"
                      />
                      <span className="text-sm text-gray-500">minutos antes</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Mensagem do lembrete</label>
                    <p className="text-xs text-gray-400">Use {'{nome}'}, {'{data}'} e {'{horario}'} para personalizar.</p>
                    <textarea
                      defaultValue={agent.reminderMessage ?? 'Oi {nome}! Lembrando do seu agendamento dia {data} as {horario}. Pode confirmar sua presenca?'}
                      onBlur={(e) => save({ reminderMessage: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 text-sm text-[#134E4A] bg-white rounded-xl border border-gray-200 resize-y focus:outline-none focus:border-[#0891B2] focus:ring-2 focus:ring-[#0891B2]/10"
                    />
                  </div>
                </>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ TEST DRAWER ═══ */}
      {showTest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowTest(false)}>
          <div className="w-96 bg-white h-full flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-[#134E4A] flex items-center gap-2"><Play className="w-4 h-4 text-[#0891B2]" /> Teste sua IA</h3>
              <button onClick={() => setShowTest(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {testReply && (
                <div className="bg-[#0891B2]/10 border border-[#0891B2]/20 rounded-xl p-4 mb-4">
                  <p className="text-xs text-gray-400 mb-1">Resposta:</p>
                  <p className="text-sm text-[#134E4A] whitespace-pre-wrap">{testReply}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Envie uma mensagem..."
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0891B2]"
                onKeyDown={(e) => { if (e.key === 'Enter' && testMsg.trim()) testMutation.mutate() }} />
              <Button onClick={() => testMutation.mutate()} disabled={!testMsg.trim() || testMutation.isPending}>
                {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
