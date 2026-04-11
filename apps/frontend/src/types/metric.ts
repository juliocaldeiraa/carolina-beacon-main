export interface ObservabilitySummary {
  performance: {
    avgLatencyMs: number
    successRate:  number
    fallbackRate: number
  }
  financial: {
    totalInputTokens:       number
    totalOutputTokens:      number
    totalCostUsd:           number
    avgCostPerConversation: number
  }
  quality: {
    avgSentimentScore:     number
    avgHallucinationScore: number
    avgUserRating:         number
    avgRelevanceScore:     number
  }
  engagement: {
    totalConversations:      number
    avgTurnsPerConversation: number
  }
}

export interface TimeseriesPoint {
  [key: string]: unknown
  date:          string
  avgLatencyMs:  number
  totalCostUsd:  number
  totalTokens:   number
  conversations: number
}

export type TimePeriod = '7d' | '30d' | '90d'

export interface MetricFilters {
  agentId?:    string
  period:      TimePeriod
  granularity: 'hour' | 'day' | 'week'
}
