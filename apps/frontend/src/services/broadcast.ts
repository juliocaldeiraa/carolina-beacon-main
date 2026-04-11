import { api } from './api'
import type { Broadcast, CreateBroadcastPayload } from '@/types/broadcast'

export const broadcastService = {
  list: async (): Promise<Broadcast[]> => {
    const { data } = await api.get('/broadcast')
    return data
  },

  get: async (id: string): Promise<Broadcast> => {
    const { data } = await api.get(`/broadcast/${id}`)
    return data
  },

  create: async (payload: CreateBroadcastPayload): Promise<Broadcast> => {
    const { data } = await api.post('/broadcast', payload)
    return data
  },

  launch: async (id: string): Promise<Broadcast> => {
    const { data } = await api.post(`/broadcast/${id}/launch`)
    return data
  },
}
