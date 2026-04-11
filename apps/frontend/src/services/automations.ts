import { api } from './api'
import type {
  Automation,
  CreateAutomationPayload,
  UpdateAutomationPayload,
  TestFireResult,
  TestStatusResponse,
  TestLead,
  DispatchLog,
} from '@/types/automation'

export const automationsService = {
  list: async (): Promise<Automation[]> => {
    const { data } = await api.get('/automations')
    return data
  },

  get: async (id: string): Promise<Automation> => {
    const { data } = await api.get(`/automations/${id}`)
    return data
  },

  create: async (payload: CreateAutomationPayload): Promise<Automation> => {
    const { data } = await api.post('/automations', payload)
    return data
  },

  update: async (id: string, payload: UpdateAutomationPayload): Promise<Automation> => {
    const { data } = await api.patch(`/automations/${id}`, payload)
    return data
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/automations/${id}`)
  },

  testFire: async (
    id: string,
    payload: { leads?: TestLead[]; phones?: string[]; templateIndex?: number },
  ): Promise<{ results: TestFireResult[] }> => {
    const { data } = await api.post(`/automations/${id}/test-fire`, payload)
    return data
  },

  testClear: async (
    id: string,
    payload: { phones?: string[] },
  ): Promise<{ cleared: number }> => {
    const { data } = await api.post(`/automations/${id}/test-clear`, payload)
    return data
  },

  testStatus: async (
    id: string,
    payload: { phones: string[] },
  ): Promise<TestStatusResponse> => {
    const { data } = await api.post(`/automations/${id}/test-status`, payload)
    return data
  },

  getDispatchLogs: async (id: string, limit = 60): Promise<DispatchLog[]> => {
    const { data } = await api.get(`/automations/${id}/dispatch-logs?limit=${limit}`)
    return data
  },

  getLeadStatuses: async (): Promise<string[]> => {
    const { data } = await api.get('/automations/lead-statuses')
    return data
  },
}
