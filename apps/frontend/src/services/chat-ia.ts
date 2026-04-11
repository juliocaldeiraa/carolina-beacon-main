import { api } from './api'
import type { ChannelAgent, CreateChannelAgentPayload, UpdateChannelAgentPayload } from '@/types/chat-ia'

export interface ConnectionTestResult {
  ok:            boolean
  channelName:   string
  channelStatus: string
  webhookMatch:  boolean
  registeredUrl: string | null
  expectedUrl:   string | null
  error?:        string
}

export interface IngestionLog {
  id:             string
  tenantId:       string
  channelId:      string | null
  channelName:    string | null
  contactPhone:   string | null
  contactName:    string | null
  messagePreview: string | null
  status:         string
  step:           string | null
  errorMsg:       string | null
  model:          string | null
  latencyMs:      number | null
  rawPayload:     unknown | null
  createdAt:      string
}

export const chatIaService = {
  list: (): Promise<ChannelAgent[]> =>
    api.get('/chat-ia').then((r) => r.data),

  create: (data: CreateChannelAgentPayload): Promise<ChannelAgent> =>
    api.post('/chat-ia', data).then((r) => r.data),

  update: (id: string, data: UpdateChannelAgentPayload): Promise<ChannelAgent> =>
    api.patch(`/chat-ia/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/chat-ia/${id}`).then((r) => r.data),

  testConnection: (id: string): Promise<ConnectionTestResult> =>
    api.post(`/chat-ia/${id}/test`).then((r) => r.data),

  getLogs: (params?: { channelId?: string; status?: string; search?: string; limit?: number }): Promise<IngestionLog[]> =>
    api.get('/inbound-logs', { params }).then((r) => r.data),

  explainLog: (id: string): Promise<{ explanation: string }> =>
    api.post(`/inbound-logs/${id}/explain`).then((r) => r.data),
}
