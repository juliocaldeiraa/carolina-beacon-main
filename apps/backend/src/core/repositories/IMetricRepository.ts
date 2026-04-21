import { Metric } from '../entities/Metric'

export interface MetricFilters {
  tenantId: string
  agentId?: string
  from?: Date
  to?: Date
}

export interface ObservabilitySummary {
  performance: {
    avgLatencyMs: number
    successRate: number
    fallbackRate: number
  }
  financial: {
    totalInputTokens: number
    totalOutputTokens: number
    totalCostUsd: number
    avgCostPerConversation: number
  }
  quality: {
    avgSentimentScore: number
    avgHallucinationScore: number
    avgUserRating: number
    avgRelevanceScore: number
  }
  engagement: {
    totalConversations: number
    avgTurnsPerConversation: number
  }
}

export interface IMetricRepository {
  create(data: Omit<Metric, 'id' | 'recordedAt'>): Promise<Metric>
  findByAgent(agentId: string, tenantId: string): Promise<Metric[]>
  getSummary(filters: MetricFilters): Promise<ObservabilitySummary>
  getTimeseries(filters: MetricFilters, granularity: 'hour' | 'day' | 'week'): Promise<unknown[]>
}

export const METRIC_REPOSITORY = Symbol('IMetricRepository')
