import { api } from './api'

export interface Lead {
  id:               string
  nome:             string | null
  whatsapp:         string | null
  whatsappLimpo?:   string | null
  status:           string | null
  campanha:         string | null
  origem?:          string | null
  lista?:           string | null
  instagramUsername?: string | null
  dataCaptura?:     string | null
  dataCapturaRaw?:  string | null
  tentativas?:      number
  tentativasFollowup?: number
  converteu:        boolean
  tags?:            string[] | null
  notas?:           string | null
  metadata?:        Record<string, unknown> | null
  createdAt?:       string
}

export interface LeadsResponse {
  data:        Lead[]
  total:       number
  page:        number
  totalPages:  number
}

export interface LeadFilters {
  page?:     number
  limit?:    number
  search?:   string
  status?:   string
  campanha?: string
  lista?:    string
}

export interface LeadFilterOptions {
  statuses:  string[]
  campanhas: string[]
  listas:    string[]
}

export interface ConversationTurn {
  role:      string
  content:   string
  timestamp: string
}

export interface LeadFieldDef {
  id:        string
  key:       string
  label:     string
  fieldType: string
  createdAt: string
}

export interface LeadImportRow {
  nome:      string
  whatsapp:  string
  status?:   string
  campanha?: string
  origem?:   string
  lista?:    string
  [key: string]: string | undefined
}

export const leadsService = {
  async list(params: LeadFilters = {}): Promise<LeadsResponse> {
    const q = new URLSearchParams()
    if (params.page)     q.set('page',     String(params.page))
    if (params.limit)    q.set('limit',    String(params.limit))
    if (params.search)   q.set('search',   params.search)
    if (params.status)   q.set('status',   params.status)
    if (params.campanha) q.set('campanha', params.campanha)
    if (params.lista)    q.set('lista',    params.lista)
    const res = await api.get<LeadsResponse>(`/leads?${q}`)
    return res.data
  },

  async exportAll(params: Omit<LeadFilters, 'page' | 'limit'> = {}): Promise<Lead[]> {
    const q = new URLSearchParams()
    if (params.search)   q.set('search',   params.search)
    if (params.status)   q.set('status',   params.status)
    if (params.campanha) q.set('campanha', params.campanha)
    if (params.lista)    q.set('lista',    params.lista)
    const res = await api.get<Lead[]>(`/leads/export?${q}`)
    return res.data
  },

  async import(rows: LeadImportRow[], lista?: string): Promise<{ imported: number; updated: number }> {
    const res = await api.post<{ imported: number; updated: number }>('/leads/import', { rows, lista })
    return res.data
  },

  async filters(): Promise<LeadFilterOptions> {
    const res = await api.get<LeadFilterOptions>('/leads/filters')
    return res.data
  },

  async conversation(phone: string): Promise<{ turns: ConversationTurn[] }> {
    const res = await api.get<{ turns: ConversationTurn[] }>(`/leads/conversation?phone=${encodeURIComponent(phone)}`)
    return res.data
  },

  async listFieldDefs(): Promise<LeadFieldDef[]> {
    const res = await api.get<LeadFieldDef[]>('/leads/field-defs')
    return res.data
  },

  async createFieldDef(data: { key: string; label: string; fieldType?: string }): Promise<LeadFieldDef> {
    const res = await api.post<LeadFieldDef>('/leads/field-defs', data)
    return res.data
  },

  async deleteFieldDef(id: string): Promise<void> {
    await api.delete(`/leads/field-defs/${id}`)
  },

  async patchLead(id: string, data: { status?: string; lista?: string; notas?: string; metadata?: Record<string, unknown> }): Promise<void> {
    await api.patch(`/leads/${id}`, data)
  },
}
