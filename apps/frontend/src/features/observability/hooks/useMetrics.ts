import { useQuery } from '@tanstack/react-query'
import { metricsService } from '@/services/metrics'
import type { TimePeriod } from '@/types/metric'

export function useObservabilitySummary(period: TimePeriod, agentId?: string) {
  return useQuery({
    queryKey: ['metrics', 'summary', period, agentId],
    queryFn:  () => metricsService.getSummary(period, agentId),
    staleTime: 1000 * 60 * 2, // 2 min
  })
}

export function useTimeseries(period: TimePeriod, agentId?: string) {
  return useQuery({
    queryKey: ['metrics', 'timeseries', period, agentId],
    queryFn:  () => metricsService.getTimeseries(period, agentId),
    staleTime: 1000 * 60 * 2,
  })
}
