import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersService } from '@/services/users'
import type { UserRole } from '@/store/useAuthStore'

const QUERY_KEY = ['users']

export function useUsers() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn:  usersService.findAll,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; password: string; role: UserRole }) =>
      usersService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersService.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
