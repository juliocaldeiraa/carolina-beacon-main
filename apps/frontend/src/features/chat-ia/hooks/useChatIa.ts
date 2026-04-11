import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatIaService } from '@/services/chat-ia'
import type { CreateChannelAgentPayload, UpdateChannelAgentPayload } from '@/types/chat-ia'

export function useChatIaList() {
  return useQuery({
    queryKey: ['chat-ia'],
    queryFn:  chatIaService.list,
    refetchInterval: 30_000,
  })
}

export function useCreateChatIa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChannelAgentPayload) => chatIaService.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['chat-ia'] }),
  })
}

export function useUpdateChatIa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChannelAgentPayload }) =>
      chatIaService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-ia'] }),
  })
}

export function useDeleteChatIa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => chatIaService.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['chat-ia'] }),
  })
}

export function useTestChatIa() {
  return useMutation({
    mutationFn: (id: string) => chatIaService.testConnection(id),
  })
}

export function useIngestionLogs(params?: { channelId?: string; status?: string; search?: string; limit?: number }) {
  return useQuery({
    queryKey:        ['ingestion-logs', params],
    queryFn:         () => chatIaService.getLogs(params),
    refetchInterval: 5_000,
  })
}

export function useExplainLog() {
  return useMutation({
    mutationFn: (id: string) => chatIaService.explainLog(id),
  })
}
