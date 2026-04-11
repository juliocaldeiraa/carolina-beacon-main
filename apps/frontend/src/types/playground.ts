export interface MessageMetadata {
  latencyMs?:    number
  inputTokens?:  number
  outputTokens?: number
  tools?:        string[]
  model?:        string
}

export interface ChatMessage {
  role:      'user' | 'assistant'
  content:   string
  metadata?: MessageMetadata
  timestamp: string
  // contexto: mensagem pré-semeada (template de disparo/automação), não enviada à IA
  isContext?: boolean
}

export interface ChatResponse {
  messages: string[]
  metadata: MessageMetadata
  session:  ChatMessage[]
  closed?:  boolean
  error?:   boolean
}

export interface PlaygroundBroadcast {
  id: string
  name: string
  template: string
  agentId: string | null
  agentName: string | null
  status: string
}

export interface PlaygroundAutomation {
  id: string
  name: string
  linkedAgentId: string | null
  agentName: string | null
  agentType: string | null
  messageTemplates: string[]
  status: string
}

export type PlaygroundMode = 'agent' | 'broadcast' | 'vendedor'
