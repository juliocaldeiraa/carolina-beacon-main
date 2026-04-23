import type { Channel, ChannelType, ChannelStatus, ChannelConfig } from '@/core/entities/Channel'

export const CHANNEL_REPOSITORY = Symbol('CHANNEL_REPOSITORY')

export interface CreateChannelDto {
  name:        string
  type:        ChannelType
  phoneNumber?: string
  config:      ChannelConfig
}

export interface UpdateChannelDto {
  name?:        string
  phoneNumber?: string
  config?:      ChannelConfig
}

export interface IChannelRepository {
  findAll(tenantId?: string): Promise<Channel[]>
  findById(id: string, tenantId?: string): Promise<Channel | null>
  create(dto: CreateChannelDto, tenantId: string): Promise<Channel>
  update(id: string, dto: UpdateChannelDto, tenantId?: string): Promise<Channel>
  updateStatus(id: string, status: ChannelStatus, blockedAt?: Date): Promise<Channel>
  remove(id: string, tenantId?: string): Promise<void>
}
