import { api } from './api'
import type { Agent, CreateAgentPayload, UpdateAgentPayload, AgentStatus } from '@/types/agent'

export const agentsService = {
  list: () =>
    api.get<Agent[]>('/agents').then((r) => r.data),

  get: (id: string) =>
    api.get<Agent>(`/agents/${id}`).then((r) => r.data),

  create: (payload: CreateAgentPayload) =>
    api.post<Agent>('/agents', payload).then((r) => r.data),

  update: (id: string, payload: UpdateAgentPayload) =>
    api.patch<Agent>(`/agents/${id}`, payload).then((r) => r.data),

  updateStatus: (id: string, status: Extract<AgentStatus, 'ACTIVE' | 'PAUSED'>) =>
    api.patch<Agent>(`/agents/${id}/status`, { status }).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/agents/${id}`).then((r) => r.data),

  test: (id: string, message: string) =>
    api
      .post<{ reply: string; inputTokens: number; outputTokens: number; latencyMs: number }>(
        `/agents/${id}/test`,
        { message },
      )
      .then((r) => r.data),
}
