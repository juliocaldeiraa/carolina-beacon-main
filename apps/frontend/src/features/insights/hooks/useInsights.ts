import { useQuery } from '@tanstack/react-query'
import { insightsService } from '@/services/insights'

const STALE = 1000 * 60 * 2 // 2 min

export function useInsightsOverview(from: string, to: string) {
  return useQuery({
    queryKey:  ['insights', 'overview', from, to],
    queryFn:   () => insightsService.getOverview(from, to),
    staleTime: STALE,
  })
}

export function useInsightsCampaigns(from: string, to: string, automationId?: string) {
  return useQuery({
    queryKey:  ['insights', 'campaigns', from, to, automationId],
    queryFn:   () => insightsService.getCampaigns(from, to, automationId),
    staleTime: STALE,
  })
}

export function useInsightsChat(from: string, to: string, channelId?: string) {
  return useQuery({
    queryKey:  ['insights', 'chat', from, to, channelId],
    queryFn:   () => insightsService.getChat(from, to, channelId),
    staleTime: STALE,
  })
}

export function useInsightsVendedor() {
  return useQuery({
    queryKey:        ['insights', 'vendedor'],
    queryFn:         insightsService.getVendedor,
    staleTime:       30_000,
    refetchInterval: 60_000,
  })
}
