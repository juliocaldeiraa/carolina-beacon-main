/**
 * AgentBuilder — Wizard multi-step para criação/edição de agente
 *
 * Etapas: Tipo → Informações → Comportamento → Avançado → Publicar
 * Tipo ATIVO: vinculado ao Vendedor (prospecção ativa)
 * Tipo PASSIVO: vinculado ao Chat IA (atendimento inbound)
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft, ChevronRight, Check, Info,
  SlidersHorizontal, Brain, Clock, ShieldAlert,
  Zap, MessageCircle,
} from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { useCreateAgent, useUpdateAgent, useAgent } from './hooks/useAgents'
import type { CreateAgentPayload, AgentType } from '@/types/agent'
import { cn } from '@/lib/utils'

// =============================================
// Schema de validação
// =============================================
const schema = z.object({
  name:            z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  description:     z.string().optional(),
  personality:     z.string().optional(),
  actionPrompt:    z.string().optional(),
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

// =============================================
// Configuração dos passos (sem o step 0 de tipo)
// =============================================
const STEPS = [
  { id: 0, label: 'Tipo',         description: 'Escolha o comportamento do agente' },
  { id: 1, label: 'Informações',  description: 'Nome e descrição do agente' },
  { id: 2, label: 'Comportamento', description: 'Personalidade e instrução de ação' },
  { id: 3, label: 'Avançado',     description: 'Temperatura, tokens, limites e fallback' },
  { id: 4, label: 'Publicar',     description: 'Revise e publique seu agente' },
]

const AVAILABLE_TOOLS = [
  { id: 'web_search',    label: 'Busca na Web',        desc: 'Permite ao agente pesquisar informações atualizadas' },
  { id: 'code_executor', label: 'Executor de Código',   desc: 'Executa snippets de Python/JS para cálculos' },
  { id: 'file_reader',   label: 'Leitor de Arquivos',   desc: 'Lê documentos PDF, Word e planilhas' },
  { id: 'rag',           label: 'Base de Conhecimento', desc: 'Busca semântica na knowledge base do tenant' },
]

// =============================================
// Componente auxiliar: Toggle
// =============================================
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none',
        value ? 'bg-beacon-primary' : 'bg-white/15',
      )}
    >
      <span className={cn(
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
        value ? 'translate-x-4.5' : 'translate-x-0.5',
      )} />
    </button>
  )
}

// =============================================
// Step 0 — Card de seleção de tipo
// =============================================
interface TypeCardProps {
  selected: AgentType
  onSelect: (t: AgentType) => void
}

function TypeSelector({ selected, onSelect }: TypeCardProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Card ATIVO */}
      <button
        type="button"
        onClick={() => onSelect('ATIVO')}
        className={cn(
          'relative flex-1 rounded-2xl p-6 border-2 transition-all duration-300 text-left cursor-pointer',
          'bg-gradient-to-br from-[#1a0a00] to-[#0d0500]',
          selected === 'ATIVO'
            ? 'border-[#f06529] shadow-[0_0_28px_rgba(240,101,41,0.4)]'
            : 'border-white/10 hover:border-[#f06529]/50 hover:shadow-[0_0_14px_rgba(240,101,41,0.15)]',
        )}
      >
        {selected === 'ATIVO' && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#f06529] flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        <div className="w-14 h-14 rounded-2xl bg-[#f06529]/20 flex items-center justify-center mb-4">
          <Zap className="w-7 h-7 text-[#f06529]" />
        </div>
        <p className="text-lg font-bold text-white mb-1">Agente Ativo</p>
        <p className="text-xs text-white/60 mb-4 leading-relaxed">
          Inicia contato proativamente com leads e conduz conversas de vendas
        </p>
        <ul className="space-y-1.5">
          <li className="text-xs text-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f06529] shrink-0" />
            Usado na área Vendedor
          </li>
          <li className="text-xs text-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f06529] shrink-0" />
            Contexto proativo injetado automaticamente
          </li>
          <li className="text-xs text-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f06529] shrink-0" />
            Não disponível no Chat IA
          </li>
        </ul>
      </button>

      {/* Card PASSIVO */}
      <button
        type="button"
        onClick={() => onSelect('PASSIVO')}
        className={cn(
          'relative flex-1 rounded-2xl p-6 border-2 transition-all duration-300 text-left cursor-pointer',
          'bg-gradient-to-br from-[#001a1a] to-[#000d0d]',
          selected === 'PASSIVO'
            ? 'border-[#00b4d8] shadow-[0_0_28px_rgba(0,180,216,0.3)]'
            : 'border-white/10 hover:border-[#00b4d8]/50 hover:shadow-[0_0_14px_rgba(0,180,216,0.12)]',
        )}
      >
        {selected === 'PASSIVO' && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#00b4d8] flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        <div className="w-14 h-14 rounded-2xl bg-[#00b4d8]/20 flex items-center justify-center mb-4">
          <MessageCircle className="w-7 h-7 text-[#00b4d8]" />
        </div>
        <p className="text-lg font-bold text-white mb-1">Agente Passivo</p>
        <p className="text-xs text-white/60 mb-4 leading-relaxed">
          Responde mensagens recebidas automaticamente via Chat IA
        </p>
        <ul className="space-y-1.5">
          <li className="text-xs text-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b4d8] shrink-0" />
            Usado no Chat IA
          </li>
          <li className="text-xs text-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b4d8] shrink-0" />
            Responde conversas inbound
          </li>
          <li className="text-xs text-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b4d8] shrink-0" />
            Disponível em todos os canais conectados
          </li>
        </ul>
      </button>
    </div>
  )
}

// =============================================
// Componente principal
// =============================================
interface AgentBuilderProps {
  mode?: 'create' | 'edit'
}

export function AgentBuilder({ mode = 'create' }: AgentBuilderProps) {
  const navigate  = useNavigate()
  const { id }    = useParams<{ id: string }>()
  const { toast } = useToast()
  const [step, setStep]           = useState(0)
  const [agentType, setAgentType] = useState<AgentType>('PASSIVO')

  const { data: existingAgent } = useAgent(id ?? '')
  const createMutation = useCreateAgent()
  const updateMutation = useUpdateAgent(id ?? '')

  // Inicializa agentType do agente existente (edit mode)
  if (mode === 'edit' && existingAgent && agentType === 'PASSIVO' && existingAgent.agentType === 'ATIVO') {
    setAgentType('ATIVO')
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:            existingAgent?.name            ?? '',
      description:     existingAgent?.description     ?? '',
      personality:     existingAgent?.personality     ?? '',
      actionPrompt:    existingAgent?.actionPrompt    ?? '',
      temperature:     existingAgent?.temperature     ?? 0.6,
      maxTokens:       existingAgent?.maxTokens       ?? 300,
      historyLimit:    existingAgent?.historyLimit    ?? 20,
      limitTurns:      existingAgent?.limitTurns      ?? false,
      maxTurns:        existingAgent?.maxTurns        ?? 8,
      fallbackEnabled: existingAgent?.fallbackEnabled ?? true,
      fallbackMessage: existingAgent?.fallbackMessage ?? 'Oi! Tive um probleminha técnico, já volto! 😊',
      tools:           existingAgent?.tools           ?? [],
    },
  })

  const watchedTools           = watch('tools') ?? []
  const watchedLimitTurns      = watch('limitTurns')
  const watchedFallbackEnabled = watch('fallbackEnabled')
  const watchedTemperature     = watch('temperature')

  async function onSubmit(data: FormData) {
    const payload: CreateAgentPayload = {
      name:            data.name,
      description:     data.description,
      personality:     data.personality,
      actionPrompt:    data.actionPrompt,
      temperature:     data.temperature,
      maxTokens:       data.maxTokens,
      historyLimit:    data.historyLimit,
      limitTurns:      data.limitTurns,
      maxTurns:        data.maxTurns,
      fallbackEnabled: data.fallbackEnabled,
      fallbackMessage: data.fallbackMessage,
      tools:           data.tools,
      agentType,
    }

    if (mode === 'edit' && id) {
      await updateMutation.mutateAsync(payload)
      toast({ type: 'success', title: 'Agente atualizado', message: `"${data.name}" foi salvo.` })
    } else {
      await createMutation.mutateAsync(payload)
      toast({ type: 'success', title: 'Agente criado!', message: `"${data.name}" está ativo.` })
    }
    navigate('/agents')
  }

  const canGoBack = step > 0
  const isLastStep = step === STEPS.length - 1

  // Container do step 0 tem fundo escuro
  const isDarkStep = step === 0

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress steps */}
      <nav aria-label="Etapas do wizard" className="mb-8">
        <ol className="flex items-center gap-0">
          {STEPS.map((s, idx) => (
            <li key={s.id} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => s.id < step && setStep(s.id)}
                className={cn(
                  'flex flex-col items-center gap-1 group focus-visible:outline-none',
                  s.id < step && 'cursor-pointer',
                  s.id > step && 'cursor-default',
                )}
                disabled={s.id > step}
                aria-current={s.id === step ? 'step' : undefined}
              >
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  s.id === step && 'bg-beacon-primary text-white',
                  s.id < step  && 'bg-beacon-primary text-white',
                  s.id > step  && 'bg-white/10 text-white/35',
                )}>
                  {s.id < step ? <Check className="w-4 h-4" /> : s.id + 1}
                </div>
                <span className={cn(
                  'text-xs hidden sm:block',
                  s.id === step ? 'text-white font-medium' : 'text-white/40',
                )}>
                  {s.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-2 transition-colors',
                  s.id < step ? 'bg-beacon-primary' : 'bg-white/10',
                )} />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step content */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div
          className={cn(
            'rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface p-6 min-h-[340px]',
            isDarkStep ? 'bg-[#0f0f0f]' : 'bg-beacon-surface',
          )}
          {...(isDarkStep ? { 'data-dark-surface': '' } : {})}
        >
          {!isDarkStep && (
            <>
              <h2 className="text-base font-semibold text-white mb-1">
                {STEPS[step].label}
              </h2>
              <p className="text-xs text-white/50 mb-6">{STEPS[step].description}</p>
            </>
          )}

          {/* STEP 0 — Tipo */}
          {step === 0 && (
            <div>
              <p className="text-white/80 text-sm font-semibold mb-1">Qual tipo de agente você está criando?</p>
              <p className="text-white/40 text-xs mb-6">O tipo define onde o agente pode ser usado e como ele se comporta.</p>
              <TypeSelector selected={agentType} onSelect={setAgentType} />
              {mode === 'edit' && (
                <p className="text-amber-400 text-[10px] mt-4 text-center">
                  Alterar o tipo pode afetar vinculações existentes no Chat IA ou Vendedor.
                </p>
              )}
            </div>
          )}

          {/* STEP 1 — Informações */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Input
                label="Nome do agente *"
                placeholder="Ex: Lumi — Follow-up Evento X"
                hint="Nome interno para identificar o agente"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Descrição"
                placeholder="Ex: Follow-up WhatsApp para leads que baixaram ebook"
                hint="Breve contexto do que o agente faz"
                {...register('description')}
              />
            </div>
          )}

          {/* STEP 2 — Comportamento */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <Textarea
                  label="Personalidade e Regras de Comportamento"
                  placeholder="Defina quem a IA é, como se comporta, tom de voz, regras universais de conduta..."
                  hint="A identidade fixa da IA. Define QUEM ela é e COMO se comporta. Raramente muda entre campanhas."
                  className="min-h-[160px]"
                  {...register('personality')}
                />
              </div>
              <div>
                <Textarea
                  label="Instrução de Ação / Objetivo"
                  placeholder="Defina o contexto do lead, o objetivo da conversa, as fases, as regras de encerramento..."
                  hint="O que a IA deve FAZER nessa conversa específica. Muda a cada campanha."
                  className="min-h-[200px]"
                  {...register('actionPrompt')}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-beacon-primary/8 rounded-lg border border-beacon-primary/15">
                <Info className="w-3.5 h-3.5 text-beacon-primary mt-0.5 shrink-0" />
                <p className="text-xs text-white/60">
                  O sistema combina automaticamente os dois campos ao enviar para a IA:
                  <span className="font-mono text-white/85"> Personalidade + &#x2014;&#x2014;&#x2014; + Instrução</span>
                  {agentType === 'ATIVO' && (
                    <span className="block mt-1 text-[#f06529]">
                      ⚡ Agente ATIVO: contexto proativo é injetado automaticamente antes do prompt.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3 — Avançado */}
          {step === 3 && (
            <div className="flex flex-col gap-1">

              {/* ── Qualidade da Resposta ─────────────────────────────── */}
              <section className="rounded-xl border border-[rgba(255,255,255,0.07)] p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-beacon-primary/12 flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-beacon-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Qualidade da Resposta</p>
                    <p className="text-[10px] text-white/40">Controla criatividade e tamanho das respostas</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white mb-2">
                    Temperatura — <span className="text-beacon-primary font-semibold">{watchedTemperature.toFixed(1)}</span>
                  </label>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[10px] text-white/40 shrink-0 w-10">Focada</span>
                    <input
                      type="range" min={0} max={1} step={0.1}
                      className="flex-1 accent-beacon-primary h-1.5"
                      {...register('temperature', { valueAsNumber: true })}
                    />
                    <span className="text-[10px] text-white/40 shrink-0 w-10 text-right">Criativa</span>
                  </div>
                  <p className="text-[10px] text-white/40">
                    {watchedTemperature <= 0.3 && '⚡ Muito previsível — ideal para FAQ e suporte técnico'}
                    {watchedTemperature > 0.3 && watchedTemperature <= 0.6 && '⚖️ Equilibrado — ideal para vendas e follow-up'}
                    {watchedTemperature > 0.6 && '🎨 Criativo — ideal para conteúdo e brainstorm'}
                  </p>
                </div>

                <Input
                  label="Máx. tokens por resposta"
                  type="number"
                  hint="300 = mensagens curtas de WhatsApp. Aumente para respostas mais longas."
                  {...register('maxTokens', { valueAsNumber: true })}
                  error={errors.maxTokens?.message}
                />
              </section>

              {/* ── Memória da Conversa ───────────────────────────────── */}
              <section className="rounded-xl border border-[rgba(255,255,255,0.07)] p-4 flex flex-col gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/12 flex items-center justify-center shrink-0">
                    <Brain className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Memória da Conversa</p>
                    <p className="text-[10px] text-white/40">Quantas mensagens anteriores a IA lembra</p>
                  </div>
                </div>

                <div>
                  <div className="flex gap-1.5 mb-2">
                    {([5, 10, 20, 50] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setValue('historyLimit', v)}
                        className={cn(
                          'flex-1 py-1 rounded-lg text-xs font-medium border transition-colors',
                          watch('historyLimit') === v
                            ? 'bg-beacon-primary text-white border-beacon-primary'
                            : 'bg-white/6 text-white/50 border-[rgba(255,255,255,0.08)] hover:border-beacon-primary/50',
                        )}
                      >
                        {v === 5 ? '5 · Leve' : v === 10 ? '10 · Rápido' : v === 20 ? '20 · Padrão' : '50 · Rico'}
                      </button>
                    ))}
                  </div>
                  <Input
                    label="Ou insira um valor personalizado (5–100)"
                    type="number"
                    hint="Mais mensagens = IA lembra mais o contexto, mas consome mais tokens e é mais lento."
                    {...register('historyLimit', { valueAsNumber: true })}
                    error={errors.historyLimit?.message}
                  />
                </div>
              </section>

              {/* ── Encerramento Automático ───────────────────────────── */}
              <section className="rounded-xl border border-[rgba(255,255,255,0.07)] p-4 flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-500/12 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Encerramento Automático</p>
                      <p className="text-[10px] text-white/40">Fecha a conversa após X trocas de mensagem</p>
                    </div>
                  </div>
                  <Toggle value={watchedLimitTurns} onChange={(v) => setValue('limitTurns', v)} />
                </div>
                {watchedLimitTurns && (
                  <div className="pl-8">
                    <Input
                      label="Máximo de trocas"
                      type="number"
                      hint="1 troca = 1 mensagem do lead + 1 resposta da IA. Mín. 2, Máx. 50."
                      {...register('maxTurns', { valueAsNumber: true })}
                      error={errors.maxTurns?.message}
                    />
                  </div>
                )}
              </section>

              {/* ── Fallback ──────────────────────────────────────────── */}
              <section className="rounded-xl border border-[rgba(255,255,255,0.07)] p-4 flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-red-500/12 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Mensagem de Fallback</p>
                      <p className="text-[10px] text-white/40">Enviada se a IA falhar. Suporta {'{{nome}}'}</p>
                    </div>
                  </div>
                  <Toggle value={watchedFallbackEnabled} onChange={(v) => setValue('fallbackEnabled', v)} />
                </div>
                {watchedFallbackEnabled && (
                  <div className="pl-8">
                    <Textarea
                      label="Mensagem de fallback"
                      placeholder="Oi! Tive um probleminha técnico, já volto! 😊"
                      {...register('fallbackMessage')}
                    />
                  </div>
                )}
              </section>

            </div>
          )}

          {/* STEP 4 — Revisão */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-4 bg-white/6 rounded-lg">
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  agentType === 'ATIVO' ? 'bg-[#f06529]/20' : 'bg-[#00b4d8]/20',
                )}>
                  {agentType === 'ATIVO'
                    ? <Zap className="w-6 h-6 text-[#f06529]" />
                    : <MessageCircle className="w-6 h-6 text-[#00b4d8]" />
                  }
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-white">{watch('name') || '—'}</p>
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded',
                      agentType === 'ATIVO'
                        ? 'bg-[#f06529]/15 text-[#f06529]'
                        : 'bg-[#00b4d8]/15 text-[#00b4d8]',
                    )}>
                      {agentType}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">{watch('description') || 'Sem descrição'}</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Tipo</dt>
                  <dd className="text-white mt-0.5 text-xs">{agentType === 'ATIVO' ? 'Agente Ativo (Vendedor)' : 'Agente Passivo (Chat IA)'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Temperatura</dt>
                  <dd className="text-white mt-0.5 text-xs">{watch('temperature').toFixed(1)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Max Tokens</dt>
                  <dd className="text-white mt-0.5 text-xs">{watch('maxTokens')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Limite de Trocas</dt>
                  <dd className="text-white mt-0.5 text-xs">
                    {watch('limitTurns') ? `Sim (${watch('maxTurns')} trocas)` : 'Não'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Fallback</dt>
                  <dd className="text-white mt-0.5 text-xs">
                    {watch('fallbackEnabled') ? 'Ativado' : 'Desativado'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Ferramentas</dt>
                  <dd className="text-white mt-0.5 text-xs">
                    {watchedTools.length > 0
                      ? watchedTools.map((t) => AVAILABLE_TOOLS.find((tool) => tool.id === t)?.label ?? t).join(', ')
                      : 'Nenhuma'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Personalidade</dt>
                  <dd className="text-white mt-0.5 text-xs line-clamp-3 bg-white/6 p-2 rounded">
                    {watch('personality') || 'Não definida'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Instrução de Ação</dt>
                  <dd className="text-white mt-0.5 text-xs line-clamp-3 bg-white/6 p-2 rounded">
                    {watch('actionPrompt') || 'Não definida'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate('/agents')}>
              Cancelar
            </Button>
            {canGoBack && (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
            )}
          </div>

          {!isLastStep ? (
            <Button type="button" variant="primary" onClick={() => setStep((s) => s + 1)}>
              Próximo <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={isSubmitting}>
              <Check className="w-4 h-4" />
              {mode === 'edit' ? 'Salvar alterações' : 'Criar agente'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
