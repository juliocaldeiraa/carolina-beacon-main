import { api } from './api'
import type { User } from '@/store/useAuthStore'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export const authService = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>('/auth/login', payload).then((r) => r.data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data),
}
