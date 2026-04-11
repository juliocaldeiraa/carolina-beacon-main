import { api } from './api'

export type ConversationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

export interface Message {
  id:             string
  conversationId: string
  role:           MessageRole
  content:        string
  inputTokens?:   number
  outputTokens?:  number
  latencyMs?:     number
  createdAt:      string
}

export interface ConversationItem {
  id:            string
  agentId:       string
  agent?:        { id: string; name: string; model: string }
  channelId?:    string
  contactPhone?: string
  contactName?:  string
  status:        ConversationStatus
  humanTakeover: boolean
  startedAt:     string
  endedAt?:      string
  turns:         number
  lastMessageAt?: string
  messages?:     Message[]
}

export interface ConversationListResponse {
  items: ConversationItem[]
  total: number
  page:  number
  limit: number
}

export const conversationsService = {
  findAll: (params?: {
    channelId?: string
    status?: string
    search?: string
    page?: number
    limit?: number
  }) =>
    api.get<ConversationListResponse>('/conversations', { params }).then((r) => r.data),

  findById: (id: string) =>
    api.get<ConversationItem>(`/conversations/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: ConversationStatus) =>
    api.patch<ConversationItem>(`/conversations/${id}/status`, { status }).then((r) => r.data),

  setTakeover: (id: string, active: boolean) =>
    api.patch<ConversationItem>(`/conversations/${id}/takeover`, { active }).then((r) => r.data),
}
