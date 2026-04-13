import { Agent, AgentType } from '../entities/Agent'

export interface CreateAgentDto {
  name: string
  description?: string
  model: string
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
  // Prompt engineering fields
  purpose?: string
  companyName?: string
  companyUrl?: string
  communicationTone?: string
  useEmojis?: boolean
  splitResponse?: boolean
  restrictTopics?: boolean
  signName?: boolean
  conversationFlow?: string
}

export interface UpdateAgentDto {
  name?: string
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
  channelId?: string | null
  historyLimit?: number
  // Prompt engineering fields
  purpose?: string
  companyName?: string
  companyUrl?: string
  communicationTone?: string
  useEmojis?: boolean
  splitResponse?: boolean
  restrictTopics?: boolean
  signName?: boolean
  conversationFlow?: string
}

export interface IAgentRepository {
  findAll(type?: AgentType): Promise<Agent[]>
  findById(id: string): Promise<Agent | null>
  create(data: CreateAgentDto): Promise<Agent>
  update(id: string, data: UpdateAgentDto): Promise<Agent>
  updateStatus(id: string, status: Agent['status']): Promise<Agent>
  softDelete(id: string): Promise<void>
}

export const AGENT_REPOSITORY = Symbol('IAgentRepository')
