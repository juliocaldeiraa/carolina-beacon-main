import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contactsService, ContactListParams } from '@/services/contacts'
import type { UpdateContactPayload } from '@/types/contact'

const LIST_KEY   = ['contacts']
const detail = (id: string) => ['contacts', id]

export function useContacts(params?: ContactListParams) {
  return useQuery({
    queryKey:       [...LIST_KEY, params],
    queryFn:        () => contactsService.list(params),
    refetchInterval: 15_000,
  })
}

export function useContact(id: string) {
  return useQuery({
    queryKey: detail(id),
    queryFn:  () => contactsService.get(id),
    enabled:  !!id,
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContactPayload }) =>
      contactsService.update(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: detail(id) })
      qc.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => contactsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  })
}
