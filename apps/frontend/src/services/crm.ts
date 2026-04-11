import { api } from './api'

export interface CrmPipeline {
  id:        string
  name:      string
  stages:    string[]
  createdAt: string
  updatedAt: string
  cards?:    CrmCard[]
}

export interface CrmCard {
  id:             string
  pipelineId:     string
  title:          string
  contactName:    string
  contactPhone?:  string
  stage:          string
  priority:       string  // LOW | NORMAL | HIGH | URGENT
  conversationId?: string
  notes?:         string
  movedByAi:      boolean
  aiNotes?:       string
  followupStep?:  number | null
  createdAt:      string
  updatedAt:      string
}

export interface CreateCardPayload {
  pipelineId:    string
  title:         string
  contactName:   string
  contactPhone?: string
  stage:         string
  priority?:     string
  conversationId?: string
  notes?:        string
}

export interface UpdateCardPayload {
  title?:         string
  contactName?:   string
  contactPhone?:  string
  stage?:         string
  priority?:      string
  conversationId?: string
  notes?:         string
  movedByAi?:     boolean
  aiNotes?:       string
}

export const crmService = {
  findAllPipelines: () =>
    api.get<CrmPipeline[]>('/crm/pipelines').then((r) => r.data),

  findPipeline: (id: string) =>
    api.get<CrmPipeline>(`/crm/pipelines/${id}`).then((r) => r.data),

  createPipeline: (data: { name: string; stages: string[] }) =>
    api.post<CrmPipeline>('/crm/pipelines', data).then((r) => r.data),

  findAllCards: (params?: { pipelineId?: string; stage?: string; search?: string }) =>
    api.get<CrmCard[]>('/crm/cards', { params }).then((r) => r.data),

  createCard: (data: CreateCardPayload) =>
    api.post<CrmCard>('/crm/cards', data).then((r) => r.data),

  updateCard: (id: string, data: UpdateCardPayload) =>
    api.patch<CrmCard>(`/crm/cards/${id}`, data).then((r) => r.data),

  removeCard: (id: string) =>
    api.delete(`/crm/cards/${id}`),
}
