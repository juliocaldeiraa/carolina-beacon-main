import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crmService } from '@/services/crm'
import type { CreateCardPayload, UpdateCardPayload } from '@/services/crm'

const PIPELINES_KEY = ['crm-pipelines']
const CARDS_KEY     = ['crm-cards']

export function usePipelines() {
  return useQuery({
    queryKey: PIPELINES_KEY,
    queryFn:  crmService.findAllPipelines,
  })
}

export function usePipeline(id: string | null) {
  return useQuery({
    queryKey: [...PIPELINES_KEY, id],
    queryFn:  () => crmService.findPipeline(id!),
    enabled:  !!id,
    refetchInterval: 15_000,
  })
}

export function useCrmCards(params?: { pipelineId?: string; stage?: string; search?: string }) {
  return useQuery({
    queryKey:        [...CARDS_KEY, params],
    queryFn:         () => crmService.findAllCards(params),
    refetchInterval: 15_000,
  })
}

export function useCreateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCardPayload) => crmService.createCard(data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: CARDS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINES_KEY })
    },
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCardPayload }) =>
      crmService.updateCard(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CARDS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINES_KEY })
    },
  })
}

export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crmService.removeCard(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: CARDS_KEY })
      qc.invalidateQueries({ queryKey: PIPELINES_KEY })
    },
  })
}
