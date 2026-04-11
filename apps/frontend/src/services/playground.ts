import { api } from './api'
import type {
  ChatResponse, PlaygroundBroadcast, PlaygroundAutomation,
} from '@/types/playground'

interface ContextMessage {
  role: 'user' | 'assistant'
  content: string
}

export const playgroundService = {
  createSession: async (contextMessages?: ContextMessage[]): Promise<{ sessionId: string }> => {
    const { data } = await api.post('/playground/session', { contextMessages: contextMessages ?? [] })
    return data
  },

  chat: async (
    agentId: string,
    sessionId: string,
    message: string,
    model?: string,
  ): Promise<ChatResponse> => {
    const { data } = await api.post('/playground/chat', {
      agentId, sessionId, message, ...(model ? { model } : {}),
    })
    return data
  },

  clearSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/playground/session/${sessionId}`)
  },

  getBroadcasts: async (): Promise<PlaygroundBroadcast[]> => {
    const { data } = await api.get('/playground/broadcasts')
    return data
  },

  getAutomations: async (): Promise<PlaygroundAutomation[]> => {
    const { data } = await api.get('/playground/automations')
    return data
  },
}
