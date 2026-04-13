/**
 * Agent — Entidade de domínio
 * Clean Architecture: Domain Layer
 */

import {
  AGENT_ARCHETYPES,
  CONTAINMENT_RULES,
  TRAINING_CATEGORY_HEADERS,
  type ContainmentLevel,
} from './agent-archetypes'

export type AgentStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'DELETED'
export type AgentType   = 'ATIVO' | 'PASSIVO'

/**
 * Contexto injetado automaticamente no system prompt de agentes ATIVO.
 * Garante que a IA saiba que ela iniciou o contato proativamente e
 * que o objetivo é avançar para a próxima etapa — não vender de imediato.
 */
export const ATIVO_CONTEXT_BLOCK =
  'Você é um agente de prospecção ativo. Você tomou a iniciativa de entrar em contato com esta pessoa — ' +
  'a primeira mensagem foi enviada por você, e ela respondeu, demonstrando abertura para conversar.\n\n' +
  'Conduza a conversa com naturalidade e genuíno interesse em entender o contexto dela. ' +
  'O objetivo não é vender de imediato: é avançar para a próxima etapa definida no seu objetivo — ' +
  'seja qualificar o interesse, entender a necessidade, apresentar uma solução ou combinar um próximo contato. ' +
  'Construa conexão antes de propor qualquer coisa. Seja direto sem ser invasivo.'

export interface Agent {
  id: string
  tenantId: string
  name: string
  description?: string
  model: string
  status: AgentStatus
  agentType: AgentType
  // Legado — substituído por personality + actionPrompt
  systemPrompt?: string
  // Novos campos de prompt estruturado
  personality?: string
  actionPrompt?: string
  // Configurações avançadas
  temperature: number
  maxTokens: number
  limitTurns: boolean
  maxTurns: number
  fallbackEnabled: boolean
  fallbackMessage?: string
  tools?: string[]
  channelId?: string
  historyLimit: number
  // Prompt engineering fields
  purpose: string
  companyName?: string
  companyUrl?: string
  communicationTone: string
  useEmojis: boolean
  splitResponse: boolean
  restrictTopics: boolean
  signName: boolean
  conversationFlow?: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Monta o system prompt final para enviar à API de IA.
 * Para agentes ATIVO: injeta bloco de contexto proativo no início.
 * Combina personalidade + instrução de ação com separador.
 * Fallback para systemPrompt legado se campos novos estiverem vazios.
 *
 * @deprecated Use buildEnrichedSystemPrompt para prompt completo com contexto.
 */
export function buildSystemPrompt(
  agent: Pick<Agent, 'personality' | 'actionPrompt' | 'systemPrompt' | 'agentType'>
): string | undefined {
  const personality = agent.personality?.trim()
  const action      = agent.actionPrompt?.trim()

  let base: string | undefined
  if (personality && action) base = `${personality}\n\n---\n\n${action}`
  else if (personality)      base = personality
  else if (action)           base = action
  else                       base = agent.systemPrompt ?? undefined

  if (!base) return undefined

  if (agent.agentType === 'ATIVO') {
    return `${ATIVO_CONTEXT_BLOCK}\n\n---\n\n${base}`
  }

  return base
}

// ── Enriched System Prompt ──

type EnrichedAgent = Pick<Agent,
  | 'name' | 'description' | 'personality' | 'actionPrompt' | 'systemPrompt'
  | 'agentType' | 'purpose' | 'companyName' | 'companyUrl'
  | 'communicationTone' | 'useEmojis' | 'splitResponse'
  | 'restrictTopics' | 'signName' | 'conversationFlow'
>

export interface EnrichedPromptContext {
  agent: EnrichedAgent
  contactName?: string
  trainingsByCategory?: Record<string, Array<{ title?: string; content: string }>>
  extraSystemCtx?: string
  calendarPrompt?: string
}

/**
 * Monta o system prompt enriquecido com 6 blocos estruturados.
 * Substitui buildSystemPrompt com contexto completo do agente.
 */
export function buildEnrichedSystemPrompt(ctx: EnrichedPromptContext): string {
  const { agent } = ctx
  const blocks: string[] = []

  // ── BLOCO 1: IDENTIDADE ──
  const identityParts: string[] = []
  if (agent.companyName) {
    identityParts.push(`Você é ${agent.name}, assistente virtual da ${agent.companyName}.`)
  } else {
    identityParts.push(`Você é ${agent.name}.`)
  }
  if (agent.description) identityParts.push(agent.description)
  if (agent.companyUrl) identityParts.push(`Site: ${agent.companyUrl}`)

  blocks.push(`── IDENTIDADE ──\n${identityParts.join('\n')}`)

  // ── BLOCO 1.5: CONTEXTO ATIVO ──
  if (agent.agentType === 'ATIVO') {
    blocks.push(ATIVO_CONTEXT_BLOCK)
  }

  // ── BLOCO 2: PERSONALIDADE ──
  const personalityParts: string[] = []
  const personality = agent.personality?.trim()
  if (personality) personalityParts.push(personality)

  const toneMap: Record<string, string> = {
    formal: 'Fale de maneira formal e profissional. Use "senhor(a)" quando apropriado.',
    normal: 'Fale de maneira natural e cordial.',
    casual: 'Fale de maneira descontraída e próxima. Use linguagem informal.',
  }
  personalityParts.push(toneMap[agent.communicationTone] ?? toneMap.normal)

  if (agent.useEmojis) {
    personalityParts.push('Use emojis com naturalidade para tornar a conversa mais acolhedora.')
  } else {
    personalityParts.push('Não use emojis nas respostas.')
  }

  if (agent.signName) {
    personalityParts.push(`Assine como "${agent.name}" ao final das mensagens.`)
  }

  if (agent.splitResponse) {
    personalityParts.push('Divida respostas longas em mensagens curtas de 1-2 frases, como em uma conversa natural de WhatsApp.')
  }

  if (personalityParts.length > 0) {
    blocks.push(`── PERSONALIDADE ──\n${personalityParts.join('\n')}`)
  }

  // ── BLOCO 3: FLUXO CONVERSACIONAL ──
  const archetype = AGENT_ARCHETYPES[agent.purpose]
  const flow = agent.conversationFlow?.trim() || archetype?.conversationFlow
  if (flow) {
    blocks.push(`── FLUXO DA CONVERSA ──\nSiga estas etapas na ordem, adaptando conforme o andamento:\n${flow}`)
  }

  // ── BLOCO 4: OBJETIVO & INSTRUÇÕES ──
  const action = agent.actionPrompt?.trim() || agent.systemPrompt?.trim()
  if (action) {
    blocks.push(`── OBJETIVO ──\n${action}`)
  }

  // ── BLOCO 5: GUARDRAILS ──
  const containmentLevel: ContainmentLevel = agent.restrictTopics
    ? 'restricted'
    : (archetype?.containment ?? 'focused')
  const guardrailParts: string[] = [CONTAINMENT_RULES[containmentLevel]]

  // Feedbacks (prioridade alta) aparecem nos guardrails
  const feedbackTrainings = ctx.trainingsByCategory?.feedback
  if (feedbackTrainings && feedbackTrainings.length > 0) {
    guardrailParts.push('')
    guardrailParts.push(TRAINING_CATEGORY_HEADERS.feedback)
    feedbackTrainings.forEach((t) => {
      guardrailParts.push(t.title ? `- [${t.title}] ${t.content}` : `- ${t.content}`)
    })
  }

  blocks.push(`── REGRAS ──\n${guardrailParts.join('\n')}`)

  // ── BLOCO 6: CONTEXTO DINÂMICO ──
  const dynamicParts: string[] = []

  if (ctx.contactName) {
    dynamicParts.push(`Você está conversando com: ${ctx.contactName}`)
  }

  if (ctx.extraSystemCtx) {
    dynamicParts.push(ctx.extraSystemCtx)
  }

  // Trainings agrupados por categoria (exceto feedback, já nos guardrails)
  if (ctx.trainingsByCategory) {
    const categories = Object.entries(ctx.trainingsByCategory).filter(([cat]) => cat !== 'feedback')
    if (categories.length > 0) {
      dynamicParts.push('── BASE DE CONHECIMENTO ──')
      for (const [category, trainings] of categories) {
        const header = TRAINING_CATEGORY_HEADERS[category] ?? TRAINING_CATEGORY_HEADERS.general
        dynamicParts.push(`\n${header}`)
        trainings.forEach((t) => {
          dynamicParts.push(t.title ? `[${t.title}]\n${t.content}` : t.content)
        })
      }
    }
  }

  if (ctx.calendarPrompt) {
    dynamicParts.push(ctx.calendarPrompt)
  }

  if (dynamicParts.length > 0) {
    blocks.push(dynamicParts.join('\n\n'))
  }

  return blocks.join('\n\n---\n\n')
}
