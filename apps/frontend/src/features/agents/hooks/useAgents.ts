import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsService } from '@/services/agents'
import { useToast }      from '@/components/ui/Toast'
import type { CreateAgentPayload, UpdateAgentPayload, AgentStatus } from '@/types/agent'

export const AGENTS_KEY = ['agents'] as const

export function useAgents() {
  return useQuery({
    queryKey: AGENTS_KEY,
    queryFn:  agentsService.list,
  })
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: [...AGENTS_KEY, id],
    queryFn:  () => agentsService.get(id),
    enabled:  !!id,
  })
}

export function useCreateAgent() {
  const qc           = useQueryClient()
  const { toast }    = useToast()
  return useMutation({
    mutationFn: (payload: CreateAgentPayload) => agentsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      toast({ type: 'success', title: 'Agente criado com sucesso!' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao criar agente.', message: 'Tente novamente.' }),
  })
}

export function useUpdateAgent(id: string) {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (payload: UpdateAgentPayload) => agentsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      toast({ type: 'success', title: 'Agente atualizado!' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao atualizar agente.' }),
  })
}

export function useUpdateAgentStatus() {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Extract<AgentStatus, 'ACTIVE' | 'PAUSED'> }) =>
      agentsService.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      toast({
        type:  'success',
        title: status === 'ACTIVE' ? 'Agente ativado.' : 'Agente pausado.',
      })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao alterar status do agente.' }),
  })
}

export function useDeleteAgent() {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => agentsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      toast({ type: 'success', title: 'Agente excluído.' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao excluir agente.' }),
  })
}
