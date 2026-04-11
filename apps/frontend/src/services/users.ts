import { api } from './api'
import type { UserRole } from '@/store/useAuthStore'

export interface UserRecord {
  id:        string
  email:     string
  role:      UserRole
  createdAt: string
}

export const usersService = {
  findAll: () =>
    api.get<UserRecord[]>('/users').then((r) => r.data),

  create: (data: { email: string; password: string; role: UserRole }) =>
    api.post<UserRecord>('/users', data).then((r) => r.data),

  updateRole: (id: string, role: UserRole) =>
    api.patch<UserRecord>(`/users/${id}/role`, { role }).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/users/${id}`),
}
