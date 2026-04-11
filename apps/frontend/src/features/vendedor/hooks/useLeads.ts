import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsService, type LeadFilters, type LeadImportRow } from '@/services/leads'
export type { ConversationTurn } from '@/services/leads'

export function useLeads(filters: LeadFilters = {}) {
  return useQuery({
    queryKey: ['leads', filters],
    queryFn:  () => leadsService.list(filters),
    placeholderData: (prev) => prev,
  })
}

export function useLeadFilters() {
  return useQuery({
    queryKey:  ['leads-filters'],
    queryFn:   () => leadsService.filters(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useLeadConversation(phone: string | null) {
  return useQuery({
    queryKey:        ['lead-conversation', phone],
    queryFn:         () => leadsService.conversation(phone!),
    enabled:         !!phone,
    refetchInterval: 5_000,
  })
}

export function useLeadFieldDefs() {
  return useQuery({
    queryKey:  ['lead-field-defs'],
    queryFn:   () => leadsService.listFieldDefs(),
    staleTime: 60_000,
  })
}

export function useCreateFieldDef() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leadsService.createFieldDef,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['lead-field-defs'] }),
  })
}

export function useDeleteFieldDef() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leadsService.deleteFieldDef(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['lead-field-defs'] }),
  })
}

export function useImportLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rows, lista }: { rows: LeadImportRow[]; lista?: string }) =>
      leadsService.import(rows, lista),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['leads-filters'] })
    },
  })
}

export function usePatchLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof leadsService.patchLead>[1] }) =>
      leadsService.patchLead(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}
