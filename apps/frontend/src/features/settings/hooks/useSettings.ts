import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  profileService, aiProvidersService, webhooksService, centralAiService,
} from '@/services/settings'
import type {
  UpdateAiProviderPayload, CreateAiProviderPayload,
  CreateWebhookPayload, UpdateWebhookPayload,
  CreateCentralAiPayload, UpdateCentralAiPayload,
} from '@/services/settings'

// ─── Profile ────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: ['settings', 'profile'],
    queryFn:  profileService.get,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string }) => profileService.update(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'profile'] }),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      profileService.changePassword(data),
  })
}

// ─── AI Providers ────────────────────────────────────────────────────────────

export function useAiProviders() {
  return useQuery({
    queryKey: ['settings', 'ai-providers'],
    queryFn:  aiProvidersService.findAll,
  })
}

export function useCreateAiProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAiProviderPayload) => aiProvidersService.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'ai-providers'] }),
  })
}

export function useUpdateAiProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAiProviderPayload }) =>
      aiProvidersService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'ai-providers'] }),
  })
}

export function useDeleteAiProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiProvidersService.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'ai-providers'] }),
  })
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export function useWebhooks() {
  return useQuery({
    queryKey: ['settings', 'webhooks'],
    queryFn:  webhooksService.findAll,
  })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWebhookPayload) => webhooksService.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'webhooks'] }),
  })
}

export function useUpdateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookPayload }) =>
      webhooksService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'webhooks'] }),
  })
}

export function useDeleteWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => webhooksService.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'webhooks'] }),
  })
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) => webhooksService.test(id),
  })
}

// ─── Central AI ──────────────────────────────────────────────────────────────

export function useCentralAiList() {
  return useQuery({
    queryKey: ['settings', 'central-ai'],
    queryFn:  centralAiService.findAll,
  })
}

export function useCreateCentralAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCentralAiPayload) => centralAiService.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'central-ai'] }),
  })
}

export function useUpdateCentralAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCentralAiPayload }) =>
      centralAiService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'central-ai'] }),
  })
}

export function useDeleteCentralAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => centralAiService.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'central-ai'] }),
  })
}

export function useActivateCentralAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => centralAiService.activate(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['settings', 'central-ai'] }),
  })
}
