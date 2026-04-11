import { api } from './api'
import type { ObservabilitySummary, TimeseriesPoint, TimePeriod } from '@/types/metric'

function periodToDates(period: TimePeriod): { from: string; to: string } {
  const to   = new Date()
  const from = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  from.setDate(from.getDate() - days)
  return { from: from.toISOString(), to: to.toISOString() }
}

function periodToGranularity(period: TimePeriod): 'hour' | 'day' | 'week' {
  if (period === '7d')  return 'day'
  if (period === '30d') return 'day'
  return 'week'
}

export const metricsService = {
  getSummary: (period: TimePeriod, agentId?: string) => {
    const { from, to } = periodToDates(period)
    return api
      .get<ObservabilitySummary>('/metrics/summary', {
        params: { from, to, ...(agentId && { agentId }) },
      })
      .then((r) => r.data)
  },

  getTimeseries: (period: TimePeriod, agentId?: string) => {
    const { from, to } = periodToDates(period)
    const granularity  = periodToGranularity(period)
    return api
      .get<TimeseriesPoint[]>('/metrics/timeseries', {
        params: { from, to, granularity, ...(agentId && { agentId }) },
      })
      .then((r) => r.data)
  },
}
