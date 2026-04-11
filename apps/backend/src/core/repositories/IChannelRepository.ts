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
  findAll(): Promise<Channel[]>
  findById(id: string): Promise<Channel | null>
  create(dto: CreateChannelDto): Promise<Channel>
  update(id: string, dto: UpdateChannelDto): Promise<Channel>
  updateStatus(id: string, status: ChannelStatus, blockedAt?: Date): Promise<Channel>
  remove(id: string): Promise<void>
}
