export type AgentStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'DELETED'
export type AgentType   = 'ATIVO' | 'PASSIVO'

export interface Agent {
  id: string
  tenantId: string
  name: string
  description?: string
  model: string
  status: AgentStatus
  agentType: AgentType
  // Legado
  systemPrompt?: string
  // Campos estruturados
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
  // Prompt engineering
  purpose: string
  companyName?: string
  companyUrl?: string
  communicationTone: string
  useEmojis: boolean
  splitResponse: boolean
  restrictTopics: boolean
  signName: boolean
  conversationFlow?: string
  inactivityMinutes: number
  inactivityAction: string
  createdAt: string
  updatedAt: string
}

export interface AgentTraining {
  id: string
  agentId: string
  type: string
  title?: string
  content: string
  status: string
  category: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface CreateAgentPayload {
  name: string
  description?: string
  model?: string
  agentType?: AgentType
  systemPrompt?: string
  personality?: string
  actionPrompt?: string
  temperature?: number
  maxTokens?: number
  limitTurns?: boolean
  maxTurns?: number
  fallbackEnabled?: boolean
  fallbackMessage?: string
  tools?: string[]
  channelId?: string
  historyLimit?: number
  purpose?: string
  companyName?: string
  companyUrl?: string
  communicationTone?: string
  useEmojis?: boolean
  splitResponse?: boolean
  restrictTopics?: boolean
  signName?: boolean
  conversationFlow?: string
  inactivityMinutes?: number
  inactivityAction?: string
}

export interface UpdateAgentPayload extends Partial<CreateAgentPayload> {}
