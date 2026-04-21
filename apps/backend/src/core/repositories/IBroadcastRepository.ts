import type { Broadcast, BroadcastStatus } from '@/core/entities/Broadcast'

export const BROADCAST_REPOSITORY = Symbol('BROADCAST_REPOSITORY')

export interface CreateBroadcastDto {
  agentId?:   string
  channelId?: string
  name:       string
  template:   string
  audience:   string[]
  // Timing anti-ban
  messageDelayMinSeconds?:  number
  messageDelayMaxSeconds?:  number
  batchSizeMin?:            number
  batchSizeMax?:            number
  batchIntervalMinMinutes?: number
  batchIntervalMaxMinutes?: number
}

export interface IBroadcastRepository {
  findAll(tenantId: string): Promise<Broadcast[]>
  findById(id: string, tenantId: string): Promise<Broadcast | null>
  create(dto: CreateBroadcastDto, tenantId: string): Promise<Broadcast>
  updateStatus(id: string, status: BroadcastStatus): Promise<Broadcast>
}
