import { useMutation } from '@tanstack/react-query'
import { databaseService } from '@/services/settings'

export function useInspectPhone() {
  return useMutation({
    mutationFn: (phone: string) => databaseService.inspect(phone),
  })
}

export function useClearHistory() {
  return useMutation({
    mutationFn: ({ phones, automationId }: { phones: string[]; automationId?: string }) =>
      databaseService.clearHistory(phones, automationId),
  })
}

export function useClearLogs() {
  return useMutation({
    mutationFn: (phones: string[]) => databaseService.clearLogs(phones),
  })
}

export function useResetLead() {
  return useMutation({
    mutationFn: (phones: string[]) => databaseService.reset(phones),
  })
}
