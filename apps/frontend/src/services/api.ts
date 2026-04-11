/**
 * API Client — Axios com interceptors de auth e multi-tenant
 */

import axios from 'axios'
import { useAuthStore } from '@/store/useAuthStore'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — injeta Bearer token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — trata 401 (token expirado)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = useAuthStore.getState().refreshToken

      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken })
          const store = useAuthStore.getState()
          store.setAuth({
            token: data.accessToken,
            refreshToken: store.refreshToken!,
            user: store.user!,
          })
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
          return api(originalRequest)
        } catch {
          useAuthStore.getState().logout()
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  },
)
