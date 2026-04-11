import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { conversationsService } from '@/services/conversations'
import type { ConversationStatus } from '@/services/conversations'

const QUERY_KEY = ['conversations']

export function useConversations(params?: {
  channelId?: string
  status?: string
  search?: string
  page?: number
}) {
  return useQuery({
    queryKey:       [...QUERY_KEY, params],
    queryFn:        () => conversationsService.findAll(params),
    refetchInterval: 10_000,
  })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn:  () => conversationsService.findById(id!),
    enabled:  !!id,
  })
}

export function useUpdateConversationStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ConversationStatus }) =>
      conversationsService.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useSetTakeover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      conversationsService.setTakeover(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
