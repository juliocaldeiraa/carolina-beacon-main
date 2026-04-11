import { api } from './api'
import type { Channel, CreateChannelPayload, UpdateChannelPayload, ChannelConflictItem } from '@/types/channel'

export const channelsService = {
  findAll: () =>
    api.get<Channel[]>('/channels').then((r) => r.data),

  findById: (id: string) =>
    api.get<Channel>(`/channels/${id}`).then((r) => r.data),

  create: (payload: CreateChannelPayload) =>
    api.post<Channel>('/channels', payload).then((r) => r.data),

  update: (id: string, payload: UpdateChannelPayload) =>
    api.patch<Channel>(`/channels/${id}`, payload).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/channels/${id}`),

  check: (id: string) =>
    api.post<Channel>(`/channels/${id}/check`).then((r) => r.data),

  checkConflicts: (channelIds: string[]): Promise<{ conflicts: ChannelConflictItem[] }> =>
    api.post('/channels/check-conflicts', { channelIds }).then((r) => r.data),
}
