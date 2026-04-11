import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { broadcastService } from '@/services/broadcast'
import { useToast }         from '@/components/ui/Toast'
import type { CreateBroadcastPayload } from '@/types/broadcast'

export const BROADCAST_KEY = ['broadcasts'] as const

export function useBroadcasts() {
  return useQuery({
    queryKey: BROADCAST_KEY,
    queryFn:  broadcastService.list,
  })
}

export function useBroadcast(id: string) {
  return useQuery({
    queryKey:       [...BROADCAST_KEY, id],
    queryFn:        () => broadcastService.get(id),
    enabled:        !!id,
    // Polling automático enquanto a campanha está ativa
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'RUNNING' || status === 'QUEUED' ? 3000 : false
    },
  })
}

export function useCreateBroadcast() {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (payload: CreateBroadcastPayload) => broadcastService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BROADCAST_KEY })
      toast({ type: 'success', title: 'Campanha criada!' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao criar campanha.' }),
  })
}

export function useLaunchBroadcast() {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => broadcastService.launch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BROADCAST_KEY })
      toast({ type: 'success', title: 'Campanha lançada!', message: 'O envio foi iniciado.' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao lançar campanha.' }),
  })
}
