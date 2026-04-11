import { api } from './api'

export interface InsightsOverview {
  campaigns: {
    totalSent: number; totalReplied: number; totalConverted: number
    replyRate: number; conversionRate: number
    activeCampaigns: number; total: number
    periodSent: number; periodErrors: number; periodSkipped: number
  }
  conversations: {
    total: number; open: number
    humanTakeover: number; humanTakeoverRate: number
  }
  system: {
    totalIngested: number; completed: number; aiErrors: number; noAgent: number
    healthPct: number; avgLatencyMs: number
  }
  leads: {
    total: number; converted: number; optOut: number; conversionRate: number
    exclusionListTotal: number
  }
}

export interface InsightsCampaigns {
  automations: Array<{
    id: string; name: string; status: string
    totalSent: number; totalReplied: number; totalConverted: number
    replyRate: number; conversionRate: number
    lastBatchAt: string | null
  }>
  timeline: Array<{ date: string; sent: number; errors: number; skipped: number }>
  totals: { sent: number; replied: number; converted: number }
}

export interface InsightsChat {
  ingestion: {
    total: number
    breakdown: Record<string, number>
    successRate: number; avgLatencyMs: number; maxLatencyMs: number
  }
  conversations: {
    total: number; humanTakeover: number; humanTakeoverRate: number; avgTurns: number
  }
  timeline: Array<{
    date: string; total: number; completed: number; errors: number; avgLatencyMs: number | null
  }>
}

export interface InsightsVendedor {
  summary: {
    campanhasAtivas:  number
    totalCampanhas:   number
    totalNaFila:      number
    totalEnviados:    number
    totalRespostas:   number
    totalConvertidos: number
    taxaResposta:     number
    taxaConversao:    number
  }
  automations: Array<{
    id:                   string
    name:                 string
    status:               string
    filterStatus:         string
    useExclusionList:     boolean
    exclusionFilterStatus: string | null
    totalSent:            number
    totalReplied:         number
    totalConverted:       number
    replyRate:            number
    conversionRate:       number
    leadsNaFila:          number
    leadsExcluidos:       number
    lastBatchAt:          string | null
  }>
}

export const insightsService = {
  getOverview: async (from: string, to: string): Promise<InsightsOverview> => {
    const { data } = await api.get('/insights/overview', { params: { from, to } })
    return data
  },

  getCampaigns: async (from: string, to: string, automationId?: string): Promise<InsightsCampaigns> => {
    const { data } = await api.get('/insights/campaigns', {
      params: { from, to, ...(automationId ? { automationId } : {}) },
    })
    return data
  },

  getChat: async (from: string, to: string, channelId?: string): Promise<InsightsChat> => {
    const { data } = await api.get('/insights/chat', {
      params: { from, to, ...(channelId ? { channelId } : {}) },
    })
    return data
  },

  getVendedor: async (): Promise<InsightsVendedor> => {
    const { data } = await api.get('/insights/vendedor')
    return data
  },
}
