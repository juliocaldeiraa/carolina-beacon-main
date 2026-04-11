/**
 * Agent — Entidade de domínio
 * Clean Architecture: Domain Layer
 */

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
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Monta o system prompt final para enviar à API de IA.
 * Para agentes ATIVO: injeta bloco de contexto proativo no início.
 * Combina personalidade + instrução de ação com separador.
 * Fallback para systemPrompt legado se campos novos estiverem vazios.
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
