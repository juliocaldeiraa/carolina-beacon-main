/**
 * Auth Store — Zustand
 * Persiste token, user e tenant ativo no localStorage
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'ADMIN' | 'EQUIPE' | 'SUPORTE' | 'COMERCIAL'

export interface User {
  id: string
  email: string
  role: UserRole
  tenantId: string
}

export type NicheKey = 'healthcare' | 'launch' | 'services' | 'generic'

export interface Tenant {
  id: string
  name: string
  slug: string
  niche?: NicheKey
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  activeTenant: Tenant | null
  setAuth: (data: { token: string; refreshToken: string; user: User }) => void
  setToken: (token: string) => void
  setActiveTenant: (tenant: Tenant) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      activeTenant: null,

      setAuth: ({ token, refreshToken, user }) =>
        set({ token, refreshToken, user }),

      setToken: (token) => set({ token }),

      setActiveTenant: (tenant) => set({ activeTenant: tenant }),

      logout: () =>
        set({ token: null, refreshToken: null, user: null, activeTenant: null }),
    }),
    {
      name: 'beacon-auth',
      partialize: (state) => ({
        token:        state.token,
        refreshToken: state.refreshToken,
        user:         state.user,
        activeTenant: state.activeTenant,
      }),
    },
  ),
)
