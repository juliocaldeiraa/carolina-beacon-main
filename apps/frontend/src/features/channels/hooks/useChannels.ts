import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { channelsService } from '@/services/channels'
import type { CreateChannelPayload } from '@/types/channel'

const QUERY_KEY = ['channels']

export function useChannels() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: channelsService.findAll,
    refetchInterval: 30_000,
  })
}

export function useCreateChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateChannelPayload) => channelsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => channelsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useCheckChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => channelsService.check(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useCheckConflicts() {
  return useMutation({
    mutationFn: (channelIds: string[]) => channelsService.checkConflicts(channelIds),
  })
}
