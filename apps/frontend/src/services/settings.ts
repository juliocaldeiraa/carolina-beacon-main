import { api } from './api'

// ─── Profile ────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
}

export const profileService = {
  get: (): Promise<UserProfile> =>
    api.get('/settings/profile').then((r) => r.data),

  update: (data: { name?: string }): Promise<UserProfile> =>
    api.patch('/settings/profile', data).then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> =>
    api.post('/settings/profile/change-password', data).then((r) => r.data),
}

// ─── AI Providers ────────────────────────────────────────────────────────────

export type AiProviderType = 'ANTHROPIC' | 'OPENAI' | 'GROQ' | 'OPENAI_COMPATIBLE'

export interface AiProvider {
  id: string
  name: string
  type: AiProviderType
  apiKey: string  // mascarada
  baseUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAiProviderPayload {
  name: string
  type: AiProviderType
  apiKey: string
  baseUrl?: string
}

export interface UpdateAiProviderPayload {
  name?: string
  apiKey?: string
  baseUrl?: string
  isActive?: boolean
}

export const aiProvidersService = {
  findAll: (): Promise<AiProvider[]> =>
    api.get('/settings/ai-providers').then((r) => r.data),

  create: (data: CreateAiProviderPayload): Promise<AiProvider> =>
    api.post('/settings/ai-providers', data).then((r) => r.data),

  update: (id: string, data: UpdateAiProviderPayload): Promise<AiProvider> =>
    api.patch(`/settings/ai-providers/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<{ message: string }> =>
    api.delete(`/settings/ai-providers/${id}`).then((r) => r.data),
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  secret: string | null
  isActive: boolean
  lastTriggeredAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateWebhookPayload {
  name: string
  url: string
  events: string[]
  secret?: string
}

export interface UpdateWebhookPayload {
  name?: string
  url?: string
  events?: string[]
  secret?: string
  isActive?: boolean
}

export interface WebhookTestResult {
  status: number
  ok: boolean
  message: string
}

export const webhooksService = {
  findAll: (): Promise<Webhook[]> =>
    api.get('/settings/webhooks').then((r) => r.data),

  create: (data: CreateWebhookPayload): Promise<Webhook> =>
    api.post('/settings/webhooks', data).then((r) => r.data),

  update: (id: string, data: UpdateWebhookPayload): Promise<Webhook> =>
    api.patch(`/settings/webhooks/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<{ message: string }> =>
    api.delete(`/settings/webhooks/${id}`).then((r) => r.data),

  test: (id: string): Promise<WebhookTestResult> =>
    api.post(`/settings/webhooks/${id}/test`).then((r) => r.data),
}

// ─── Central AI Config ────────────────────────────────────────────────────────

export type CentralAiProvider = 'ANTHROPIC' | 'OPENAI' | 'GOOGLE'

export interface CentralAiConfig {
  id: string
  name: string
  provider: CentralAiProvider
  model: string
  apiKey: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCentralAiPayload {
  name: string
  provider: CentralAiProvider
  model: string
  apiKey: string
}

export interface UpdateCentralAiPayload {
  name?: string
  provider?: CentralAiProvider
  model?: string
  apiKey?: string
}

export const centralAiService = {
  findAll: (): Promise<CentralAiConfig[]> =>
    api.get('/settings/central-ai').then((r) => r.data),

  create: (data: CreateCentralAiPayload): Promise<CentralAiConfig> =>
    api.post('/settings/central-ai', data).then((r) => r.data),

  update: (id: string, data: UpdateCentralAiPayload): Promise<CentralAiConfig> =>
    api.patch(`/settings/central-ai/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/settings/central-ai/${id}`).then((r) => r.data),

  activate: (id: string): Promise<CentralAiConfig[]> =>
    api.post(`/settings/central-ai/${id}/activate`).then((r) => r.data),
}

// ─── Database ─────────────────────────────────────────────────────────────────

export interface PhoneHistorySlice {
  automationId:   string
  automationName: string
  turnCount:      number
  lastAt:         string | null
}

export interface PhoneInspectResult {
  found: boolean
  lead?: {
    id:          string
    nome:        string
    whatsapp:    string
    status:      string | null
    createdAt:   string
    history:     PhoneHistorySlice[]
    legacyTurns: number
  }
  ingestionLogs: {
    total:    number
    firstAt:  string | null
    lastAt:   string | null
    byStatus: Record<string, number>
  }
}

export const databaseService = {
  inspect: (phone: string): Promise<PhoneInspectResult> =>
    api.get('/settings/database/inspect', { params: { phone } }).then((r) => r.data),

  clearHistory: (phones: string[], automationId?: string): Promise<{ cleared: number }> =>
    api.delete('/settings/database/history', { data: { phones, automationId } }).then((r) => r.data),

  clearLogs: (phones: string[]): Promise<{ deleted: number }> =>
    api.delete('/settings/database/logs', { data: { phones } }).then((r) => r.data),

  reset: (phones: string[]): Promise<{ resetLeads: number; deletedLogs: number }> =>
    api.post('/settings/database/reset', { phones }).then((r) => r.data),
}

// ─── Available webhook events ─────────────────────────────────────────────────

export const WEBHOOK_EVENTS = [
  { value: 'conversation.created',   label: 'Conversa criada' },
  { value: 'conversation.closed',    label: 'Conversa fechada' },
  { value: 'conversation.resolved',  label: 'Conversa resolvida' },
  { value: 'crm.card.created',       label: 'Card CRM criado' },
  { value: 'crm.card.moved',         label: 'Card CRM movido' },
  { value: 'crm.card.moved_by_ai',   label: 'Card CRM movido pela IA' },
  { value: 'message.received',       label: 'Mensagem recebida' },
  { value: 'channel.status_changed', label: 'Status do canal alterado' },
]
