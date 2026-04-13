/**
 * AgentBuilder — Wizard multi-step para criação/edição de agente
 *
 * Etapas: Nome → Objetivo → Personalidade & Modelo → Configurações → Revisão
 * Inspirado no GPT Maker (app.gptmaker.ai)
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft, ChevronRight, Check,
  Zap, MessageCircle, Headphones, ShoppingCart, User,
  Bot, Sparkles, CalendarCheck, Phone, RefreshCw, ClipboardList,
} from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { useCreateAgent, useUpdateAgent, useAgent } from './hooks/useAgents'
import type { AgentType } from '@/types/agent'
import { cn } from '@/lib/utils'

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  name:            z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  description:     z.string().optional(),
  personality:     z.string().optional(),
  actionPrompt:    z.string().optional(),
  model:           z.string().min(1, 'Selecione um modelo'),
  temperature:     z.number().min(0).max(1),
  maxTokens:       z.number().min(50).max(2000),
  historyLimit:    z.number().min(5).max(100),
  limitTurns:      z.boolean(),
  maxTurns:        z.number().min(2).max(50),
  fallbackEnabled: z.boolean(),
  fallbackMessage: z.string().optional(),
  tools:           z.array(z.string()).optional(),
})

type FormData = z.infer<typeof schema>

const STEPS = [
  { id: 0, label: 'Nome',            description: 'Identifique seu agente' },
  { id: 1, label: 'Objetivo',        description: 'Defina o propósito do agente' },
  { id: 2, label: 'Personalidade',   description: 'Comportamento e modelo de IA' },
  { id: 3, label: 'Configurações',   description: 'Ajustes finos de conversa' },
  { id: 4, label: 'Publicar',        description: 'Revise e publique' },
]

const MODELS = {
  OpenAI: [
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', tier: 'econômico' },
    { id: 'gpt-4.1',      label: 'GPT-4.1',      tier: 'avançado' },
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',   tier: 'econômico' },
    { id: 'gpt-4o',       label: 'GPT-4o',        tier: 'avançado' },
    { id: 'o4-mini',      label: 'o4-Mini',        tier: 'raciocínio' },
    { id: 'o3-mini',      label: 'o3-Mini',        tier: 'raciocínio' },
  ],
  Anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'econômico' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', tier: 'avançado' },
  ],
}

const PURPOSE_OPTIONS = [
  { id: 'qualification',                    label: 'Qualificação',           desc: 'Qualifica leads e encaminha',                         icon: Phone },
  { id: 'qualification_scheduling',         label: 'Qualificação + Agenda', desc: 'Qualifica e agenda se qualificado',                   icon: CalendarCheck },
  { id: 'qualification_scheduling_reminder', label: 'Qualif. + Agenda + Lembrete', desc: 'Qualifica, agenda e envia lembrete',           icon: CalendarCheck },
  { id: 'sales',                            label: 'Vendas',                desc: 'Rapport, apresentação e fechamento',                  icon: ShoppingCart },
  { id: 'support',                          label: 'Suporte / SAC',         desc: 'Resolve dúvidas com base no conhecimento',            icon: Headphones },
  { id: 'reception',                        label: 'Recepção',              desc: 'Triagem geral — direciona, agenda, informa',          icon: User },
  { id: 'reactivation',                     label: 'Reativação',            desc: 'Reengaja leads ou clientes inativos',                 icon: RefreshCw },
  { id: 'survey',                           label: 'Pesquisa / NPS',        desc: 'Coleta feedback estruturado',                         icon: ClipboardList },
]

const TONE_OPTIONS = [
  { id: 'formal',  label: 'FORMAL' },
  { id: 'normal',  label: 'NORMAL' },
  { id: 'casual',  label: 'DESCONTRAÍDA' },
]

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label, desc }: {
  value: boolean; onChange: (v: boolean) => void; label: string; desc?: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {desc && <p className="text-xs text-white/40 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          value ? 'bg-beacon-primary' : 'bg-white/15',
        )}
      >
        <span className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-4.5' : 'translate-x-0.5',
        )} />
      </button>
    </div>
  )
}

// ─── Componente Principal ───────────────────────────────────────────────────

interface AgentBuilderProps {
  mode?: 'create' | 'edit'
}

export function AgentBuilder({ mode = 'create' }: AgentBuilderProps) {
  const navigate  = useNavigate()
  const { id }    = useParams<{ id: string }>()
  const { toast } = useToast()
  const [step, setStep]           = useState(0)
  const [agentType, setAgentType] = useState<AgentType>('PASSIVO')
  const [purpose, setPurpose]     = useState('support')
  const [tone, setTone]           = useState('normal')
  const [companyName, setCompanyName] = useState('')
  const [companyUrl, setCompanyUrl]   = useState('')
  const [conversationFlow, setConversationFlow] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('OpenAI')

  // Configurações avançadas
  const [useEmojis, setUseEmojis]           = useState(true)
  const [splitResponse, setSplitResponse]   = useState(true)
  const [restrictTopics, setRestrictTopics] = useState(false)
  const [signName, setSignName]             = useState(false)
  const [inactivityMinutes, setInactivityMinutes] = useState(10)
  const [inactivityAction, setInactivityAction]   = useState('close')

  const { data: existingAgent } = useAgent(id ?? '')
  const createMutation = useCreateAgent()
  const updateMutation = useUpdateAgent(id ?? '')

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', description: '', personality: '', actionPrompt: '',
      model: 'gpt-4.1-mini', temperature: 0.6, maxTokens: 300,
      historyLimit: 20, limitTurns: false, maxTurns: 8,
      fallbackEnabled: true, fallbackMessage: '', tools: [],
    },
  })

  // Preencher form no edit mode
  useEffect(() => {
    if (mode === 'edit' && existingAgent) {
      form.reset({
        name:            existingAgent.name,
        description:     existingAgent.description ?? '',
        personality:     existingAgent.personality ?? '',
        actionPrompt:    existingAgent.actionPrompt ?? '',
        model:           existingAgent.model ?? 'gpt-4.1-mini',
        temperature:     existingAgent.temperature,
        maxTokens:       existingAgent.maxTokens,
        historyLimit:    existingAgent.historyLimit,
        limitTurns:      existingAgent.limitTurns,
        maxTurns:        existingAgent.maxTurns,
        fallbackEnabled: existingAgent.fallbackEnabled,
        fallbackMessage: existingAgent.fallbackMessage ?? '',
        tools:           existingAgent.tools ?? [],
      })
      setAgentType(existingAgent.agentType ?? 'PASSIVO')
      setPurpose(existingAgent.purpose ?? 'support')
      setTone(existingAgent.communicationTone ?? 'normal')
      setCompanyName(existingAgent.companyName ?? '')
      setCompanyUrl(existingAgent.companyUrl ?? '')
      setConversationFlow(existingAgent.conversationFlow ?? '')
      setUseEmojis(existingAgent.useEmojis ?? true)
      setSplitResponse(existingAgent.splitResponse ?? true)
      setRestrictTopics(existingAgent.restrictTopics ?? false)
      setSignName(existingAgent.signName ?? false)
      setInactivityMinutes(existingAgent.inactivityMinutes ?? 10)
      setInactivityAction(existingAgent.inactivityAction ?? 'close')
    }
  }, [existingAgent, mode, form])

  const { watch } = form
  const name = watch('name')
  const model = watch('model')

  const canNext = () => {
    if (step === 0) return name.trim().length >= 2
    if (step === 2) return model.length > 0
    return true
  }

  const onSubmit = async (data: FormData) => {
    const payload: any = {
      ...data,
      agentType,
      purpose,
      communicationTone: tone,
      companyName: companyName || undefined,
      companyUrl: companyUrl || undefined,
      conversationFlow: conversationFlow || undefined,
      useEmojis,
      splitResponse,
      restrictTopics,
      signName,
      inactivityMinutes,
      inactivityAction,
    }

    try {
      if (mode === 'edit' && id) {
        await updateMutation.mutateAsync(payload)
        toast({ title: 'Agente atualizado', type: 'success' })
      } else {
        await createMutation.mutateAsync(payload)
        toast({ title: 'Agente criado com sucesso!', type: 'success' })
      }
      navigate('/agents')
    } catch (err: any) {
      toast({ title: err?.response?.data?.message ?? 'Erro ao salvar agente', type: 'error' })
    }
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/agents')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              i < step ? 'bg-green-600 text-white' :
              i === step ? 'bg-beacon-primary text-white' :
              'bg-white/10 text-white/40',
            )}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* ─── Step 0: Nome ─── */}
        {step === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-beacon-primary/20 rounded-2xl flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-beacon-primary" />
              </div>
              <h2 className="text-xl font-bold text-beacon-primary">Criar um novo agente</h2>
              <p className="text-sm text-white/50">Escolha o nome que seu agente vai usar.</p>
            </div>

            <Input {...form.register('name')} placeholder="Qual nome do seu agente?" className="text-center text-lg" />
            {form.formState.errors.name && (
              <p className="text-xs text-red-400 text-center">{form.formState.errors.name.message}</p>
            )}

            {/* Tipo do agente */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-white/70 text-center">Tipo do agente</p>
              <div className="flex gap-3">
                {([['PASSIVO', 'Passivo (Chat IA)', MessageCircle, '#00b4d8'], ['ATIVO', 'Ativo (Vendas)', Zap, '#f06529']] as const).map(([type, label, Icon, color]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAgentType(type as AgentType)}
                    className={cn(
                      'flex-1 rounded-xl p-4 border-2 transition-all text-left',
                      agentType === type
                        ? `border-[${color}] bg-[${color}]/10`
                        : 'border-white/10 hover:border-white/20',
                    )}
                    style={agentType === type ? { borderColor: color, backgroundColor: `${color}15` } : {}}
                  >
                    <Icon className="w-5 h-5 mb-2" style={{ color }} />
                    <p className="text-sm font-semibold text-white">{label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 1: Objetivo ─── */}
        {step === 1 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-beacon-primary">Qual objetivo do agente?</h2>
              <p className="text-sm text-white/50">Escolha o que melhor define o objetivo.</p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PURPOSE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPurpose(opt.id)}
                    className={cn(
                      'rounded-xl p-4 border-2 transition-all text-center',
                      purpose === opt.id
                        ? 'border-beacon-primary bg-beacon-primary/10'
                        : 'border-white/10 hover:border-white/20',
                    )}
                  >
                    <Icon className={cn('w-5 h-5 mx-auto mb-1.5', purpose === opt.id ? 'text-beacon-primary' : 'text-white/40')} />
                    <p className="text-xs font-semibold text-white">{opt.label}</p>
                    <p className="text-[10px] text-white/40 mt-0.5 leading-tight">{opt.desc}</p>
                  </button>
                )
              })}
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">
                  {purpose === 'support' ? 'Presta suporte para' : purpose === 'sales' ? 'Empresa' : 'Nome'}
                </label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome da empresa ou serviço" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">Site oficial (opcional)</label>
                <Input value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://minhaempresa.com.br" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">Descrição breve</label>
                <Textarea {...form.register('description')} placeholder="Descreva brevemente o que o agente faz..." rows={3} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">Fluxo conversacional (opcional)</label>
                <p className="text-xs text-white/30">Sobrescreve o fluxo padrão do arquétipo. Deixe vazio para usar o padrão.</p>
                <Textarea
                  value={conversationFlow}
                  onChange={(e) => setConversationFlow(e.target.value)}
                  placeholder="1. Cumprimentar&#10;2. Entender necessidade&#10;3. Qualificar&#10;4. Agendar&#10;5. Transferir"
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 2: Personalidade & Modelo ─── */}
        {step === 2 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
            <h2 className="text-lg font-bold text-beacon-primary">Personalidade e Modelo</h2>

            {/* Tom de comunicação */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Comunicação</label>
              <div className="flex gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                      tone === t.id
                        ? 'bg-beacon-primary text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comportamento */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">Comportamento</label>
              <p className="text-xs text-white/30">Descreva como o agente deve se comportar durante a conversa.</p>
              <Textarea
                {...form.register('personality')}
                placeholder="Ex. Seja extrovertido, na primeira interação procure saber o nome do usuário."
                rows={5}
                className="font-mono text-sm"
              />
              <p className="text-xs text-white/30 text-right">{(watch('personality') ?? '').length}/3000</p>
            </div>

            {/* Instrução de ação */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">Instrução de ação (opcional)</label>
              <Textarea
                {...form.register('actionPrompt')}
                placeholder="O que o agente deve fazer nesta conversa especificamente..."
                rows={3}
              />
            </div>

            {/* Seletor de modelo */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-beacon-primary" />
                Modelo de IA
              </label>

              {/* Tabs de provedor */}
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {Object.keys(MODELS).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setSelectedProvider(provider)}
                    className={cn(
                      'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                      selectedProvider === provider
                        ? 'bg-beacon-primary text-white'
                        : 'text-white/50 hover:text-white/80',
                    )}
                  >
                    {provider}
                  </button>
                ))}
              </div>

              {/* Lista de modelos */}
              <div className="space-y-1.5">
                {MODELS[selectedProvider as keyof typeof MODELS]?.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => form.setValue('model', m.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left',
                      model === m.id
                        ? 'border-beacon-primary bg-beacon-primary/10'
                        : 'border-white/10 hover:border-white/20',
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{m.label}</p>
                      <p className="text-xs text-white/40">{m.tier}</p>
                    </div>
                    {model === m.id && <Check className="w-4 h-4 text-beacon-primary" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Configurações ─── */}
        {step === 3 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-1">
            <h2 className="text-lg font-bold text-beacon-primary mb-4">Configurações de Conversa</h2>

            <Toggle value={form.watch('fallbackEnabled')} onChange={(v) => form.setValue('fallbackEnabled', v)}
              label="Transferir para humano" desc="O agente transfere o atendimento quando não consegue responder" />

            <Toggle value={useEmojis} onChange={setUseEmojis}
              label="Usar Emojis nas Respostas" desc="Define se o agente pode utilizar emojis" />

            <Toggle value={restrictTopics} onChange={setRestrictTopics}
              label="Restringir Temas Permitidos" desc="O agente não fala sobre assuntos fora do treinamento" />

            <Toggle value={splitResponse} onChange={setSplitResponse}
              label="Dividir resposta em partes" desc="Mensagens longas são separadas em várias mensagens" />

            <Toggle value={signName} onChange={setSignName}
              label="Assinar nome do agente" desc="Adiciona assinatura em cada resposta" />

            <Toggle value={form.watch('limitTurns')} onChange={(v) => form.setValue('limitTurns', v)}
              label="Limite de interações" desc="Define quantidade máxima de trocas por atendimento" />

            {form.watch('limitTurns') && (
              <div className="pl-4 pb-3">
                <input
                  type="range" min={2} max={50} value={form.watch('maxTurns')}
                  onChange={(e) => form.setValue('maxTurns', Number(e.target.value))}
                  className="w-full accent-beacon-primary"
                />
                <p className="text-xs text-white/40">{form.watch('maxTurns')} interações</p>
              </div>
            )}

            {/* Inatividade */}
            <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
              <p className="text-sm font-medium text-white/70">Ações de Inatividade</p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/50">Se não responder em</span>
                <select
                  value={inactivityMinutes}
                  onChange={(e) => setInactivityMinutes(Number(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                >
                  {[5, 10, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
                <span className="text-sm text-white/50">→</span>
                <select
                  value={inactivityAction}
                  onChange={(e) => setInactivityAction(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                >
                  <option value="close">Finalizar</option>
                  <option value="message">Enviar mensagem</option>
                  <option value="transfer">Transferir</option>
                </select>
              </div>
            </div>

            {/* Avançado */}
            <div className="border-t border-white/10 pt-4 mt-4 space-y-4">
              <p className="text-sm font-medium text-white/70">Avançado</p>

              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Temperatura ({form.watch('temperature').toFixed(1)})</label>
                <input
                  type="range" min={0} max={1} step={0.1} value={form.watch('temperature')}
                  onChange={(e) => form.setValue('temperature', Number(e.target.value))}
                  className="w-full accent-beacon-primary"
                />
                <div className="flex justify-between text-[10px] text-white/30">
                  <span>Preciso</span><span>Criativo</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50">Max Tokens</label>
                  <Input type="number" {...form.register('maxTokens', { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50">Memória (mensagens)</label>
                  <Input type="number" {...form.register('historyLimit', { valueAsNumber: true })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 4: Revisão ─── */}
        {step === 4 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-green-600/20 rounded-2xl flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Revisão Final</h2>
            </div>

            <div className="space-y-3">
              {[
                ['Nome', name],
                ['Tipo', agentType === 'ATIVO' ? 'Ativo (Vendas)' : 'Passivo (Chat IA)'],
                ['Objetivo', PURPOSE_OPTIONS.find((p) => p.id === purpose)?.label ?? purpose],
                ['Empresa', companyName || '—'],
                ['Tom', TONE_OPTIONS.find((t) => t.id === tone)?.label ?? tone],
                ['Modelo', model],
                ['Temperatura', form.watch('temperature').toFixed(1)],
                ['Max Tokens', String(form.watch('maxTokens'))],
                ['Memória', `${form.watch('historyLimit')} mensagens`],
                ['Emojis', useEmojis ? 'Sim' : 'Não'],
                ['Restringir temas', restrictTopics ? 'Sim' : 'Não'],
                ['Dividir resposta', splitResponse ? 'Sim' : 'Não'],
                ['Inatividade', `${inactivityMinutes}min → ${inactivityAction}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-white/50">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Navegação ─── */}
        <div className="flex justify-between mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => step > 0 ? setStep(step - 1) : navigate('/agents')}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>

          {isLast ? (
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : mode === 'edit' ? 'Salvar' : 'Publicar'}
              <Check className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
