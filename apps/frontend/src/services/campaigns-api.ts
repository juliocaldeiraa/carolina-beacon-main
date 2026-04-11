import { api } from './api'

export interface Campaign {
  id:           string
  name:         string
  status:       'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
  channelId:    string | null
  agentId:      string | null
  delayMinSec:  number
  delayMaxSec:  number
  rotationMode: 'RANDOM' | 'SEQUENTIAL'
  varLabels:    string[]
  totalLeads:   number
  sentCount:    number
  errorCount:   number
  scheduledAt:  string | null
  completedAt:  string | null
  createdAt:    string
  templates:    MessageTemplate[]
  _count?:      { leads: number }
  // Janela de horário comercial
  scheduleEnabled:   boolean
  scheduleStartHour: number
  scheduleEndHour:   number
  scheduleDays:      number[]
  scheduleTimezone:  string
}

export interface MessageTemplate {
  id:          string
  campaignId:  string
  type:        'INITIAL' | 'FOLLOW_UP'
  variations:  string[]
  order:       number
  followUpRule?: FollowUpRule | null
}

export interface FollowUpRule {
  id:                string
  triggerAfterHours: number
  triggerOnStatus:   string
  isActive:          boolean
}

export interface Lead {
  id:              string
  phone:           string
  var1:            string | null
  var2:            string | null
  var3:            string | null
  var4:            string | null
  var5:            string | null
  status:          'PENDING' | 'QUEUED' | 'SENT' | 'REPLIED' | 'ERROR' | 'OPTED_OUT'
  kanbanColumn:    string
  followUpCount:   number
  conversionValue: string | null
  notes:           string | null
  lastMessageAt:   string | null
  nextActionAt:    string | null
  createdAt:       string
}

export interface ImportResult {
  total:    number
  imported: number
  skipped:  number
  errors:   string[]
}

export const campaignsApi = {
  list: () =>
    api.get<Campaign[]>('/campaigns').then((r) => r.data),

  get: (id: string) =>
    api.get<Campaign>(`/campaigns/${id}`).then((r) => r.data),

  create: (dto: {
    name:               string
    channelId?:         string
    agentId?:           string
    delayMinSec?:       number
    delayMaxSec?:       number
    rotationMode?:      'RANDOM' | 'SEQUENTIAL'
    varLabels?:         string[]
    initialVariations:  string[][]
    scheduleEnabled?:   boolean
    scheduleStartHour?: number
    scheduleEndHour?:   number
    scheduleDays?:      number[]
    scheduleTimezone?:  string
  }) => api.post<Campaign>('/campaigns', dto).then((r) => r.data),

  update: (id: string, dto: Partial<{
    name: string; channelId: string; delayMinSec: number; delayMaxSec: number
    varLabels: string[]
    scheduleEnabled: boolean; scheduleStartHour: number; scheduleEndHour: number
    scheduleDays: number[]; scheduleTimezone: string
  }>) => api.patch<Campaign>(`/campaigns/${id}`, dto).then((r) => r.data),

  duplicate: (id: string) =>
    api.post<Campaign>(`/campaigns/${id}/duplicate`).then((r) => r.data),

  retryErrors: (id: string) =>
    api.post<{ retriedCount: number }>(`/campaigns/${id}/retry-errors`).then((r) => r.data),

  updateInitialTemplate: (id: string, variations: string[][]) =>
    api.patch(`/campaigns/${id}/template/initial`, { variations }).then((r) => r.data),

  launch:  (id: string) => api.post<Campaign>(`/campaigns/${id}/launch`).then((r) => r.data),
  pause:   (id: string) => api.post<Campaign>(`/campaigns/${id}/pause`).then((r) => r.data),
  resume:  (id: string) => api.post<Campaign>(`/campaigns/${id}/resume`).then((r) => r.data),
  remove:  (id: string) => api.delete(`/campaigns/${id}`),

  // Leads
  listLeads: (campaignId: string, params?: {
    status?: string; page?: number; limit?: number
  }) => api.get<{
    leads: Lead[]; total: number; page: number; pages: number
  }>(`/campaigns/${campaignId}/leads`, { params }).then((r) => r.data),

  createLead: (campaignId: string, dto: {
    phone: string; var1?: string; var2?: string; var3?: string; var4?: string; var5?: string
  }) => api.post(`/campaigns/${campaignId}/leads`, dto).then((r) => r.data),

  importLeads: (campaignId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ImportResult>(
      `/campaigns/${campaignId}/leads/import`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data)
  },

  updateLead: (campaignId: string, leadId: string, dto: {
    status?: string; kanbanColumn?: string; notes?: string
    var1?: string | null; var2?: string | null; var3?: string | null
    var4?: string | null; var5?: string | null
  }) => api.patch(`/campaigns/${campaignId}/leads/${leadId}`, dto).then((r) => r.data),

  cancelLead: (campaignId: string, leadId: string) =>
    api.delete(`/campaigns/${campaignId}/leads/${leadId}`),

  getLeadMessages: (campaignId: string, leadId: string) =>
    api.get<Array<{
      id: string
      direction: 'in' | 'out'
      content: string
      status: string
      errorMsg: string | null
      at: string
    }>>(`/campaigns/${campaignId}/leads/${leadId}/messages`).then((r) => r.data),

  // Follow-up rules
  listFollowUpRules: (campaignId: string) =>
    api.get(`/campaigns/${campaignId}/follow-up-rules`).then((r) => r.data),

  /** Cria ou substitui um follow-up completo (template + regra) */
  upsertFollowUp: (campaignId: string, dto: {
    order:               number
    variations:          string[][]
    triggerAfterMinutes: number
    triggerOnStatus?:    string
  }) => api.post(`/campaigns/${campaignId}/follow-up-rules/with-template`, dto).then((r) => r.data),

  /** Remove follow-up pela order (1, 2 ou 3) */
  deleteFollowUp: (campaignId: string, order: number) =>
    api.delete(`/campaigns/${campaignId}/follow-up-rules/order/${order}`),

  // CRM — move coluna + registra conversão
  moveLeadColumn: (leadId: string, kanbanColumn: string, conversionValue?: string) =>
    api.patch(`/crm/leads/${leadId}/column`, { kanbanColumn, conversionValue }).then((r) => r.data),
}
