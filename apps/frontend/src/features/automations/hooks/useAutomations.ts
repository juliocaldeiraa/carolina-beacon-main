import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { automationsService } from '@/services/automations'
import { useToast }           from '@/components/ui/Toast'
import type { CreateAutomationPayload, UpdateAutomationPayload, TestLead } from '@/types/automation'

export const AUTOMATIONS_KEY = ['automations'] as const

export function useAutomations() {
  return useQuery({
    queryKey:       AUTOMATIONS_KEY,
    queryFn:        automationsService.list,
    refetchInterval: 30_000,
  })
}

export function useAutomation(id: string) {
  return useQuery({
    queryKey:       [...AUTOMATIONS_KEY, id],
    queryFn:        () => automationsService.get(id),
    enabled:        !!id,
    refetchInterval: (query) => {
      return query.state.data?.status === 'ACTIVE' ? 10_000 : false
    },
  })
}

export function useCreateAutomation() {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (payload: CreateAutomationPayload) => automationsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY })
      toast({ type: 'success', title: 'Automação criada!' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao criar automação.' }),
  })
}

export function useUpdateAutomation() {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAutomationPayload }) =>
      automationsService.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY })
      qc.invalidateQueries({ queryKey: [...AUTOMATIONS_KEY, id] })
      toast({ type: 'success', title: 'Automação atualizada!' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao atualizar automação.' }),
  })
}

export function useDeleteAutomation() {
  const qc        = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => automationsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY })
      toast({ type: 'success', title: 'Automação removida.' })
    },
    onError: () => toast({ type: 'error', title: 'Erro ao remover automação.' }),
  })
}

export function useTestFire(automationId: string) {
  const { toast } = useToast()
  return useMutation({
    mutationFn: (payload: { leads?: TestLead[]; phones?: string[]; templateIndex?: number }) =>
      automationsService.testFire(automationId, payload),
    onError: () => toast({ type: 'error', title: 'Erro ao disparar teste.' }),
  })
}

export function useTestClear(automationId: string) {
  const { toast } = useToast()
  return useMutation({
    mutationFn: (payload: { phones?: string[] }) =>
      automationsService.testClear(automationId, payload),
    onSuccess: ({ cleared }) =>
      toast({ type: 'success', title: `${cleared} lead(s) resetado(s).` }),
    onError: () => toast({ type: 'error', title: 'Erro ao limpar histórico.' }),
  })
}

export function useTestStatus(
  automationId: string,
  phones: string[],
  enabled: boolean,
) {
  return useQuery({
    queryKey:        [...AUTOMATIONS_KEY, automationId, 'test-status', phones.join(',')],
    queryFn:         () => automationsService.testStatus(automationId, { phones }),
    enabled:         enabled && phones.length > 0,
    refetchInterval: 4_000,
  })
}

export function useDispatchLogs(automationId: string, isActive: boolean) {
  return useQuery({
    queryKey:        [...AUTOMATIONS_KEY, automationId, 'dispatch-logs'],
    queryFn:         () => automationsService.getDispatchLogs(automationId),
    enabled:         !!automationId,
    refetchInterval: isActive ? 6_000 : false,
  })
}

export function useLeadStatuses() {
  return useQuery({
    queryKey:  [...AUTOMATIONS_KEY, 'lead-statuses'],
    queryFn:   automationsService.getLeadStatuses,
    staleTime: 60_000,
  })
}

