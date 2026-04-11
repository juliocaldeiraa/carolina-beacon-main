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
  createdAt: string
  updatedAt: string
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
}

export interface UpdateAgentPayload extends Partial<CreateAgentPayload> {}
