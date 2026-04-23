import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import type { IChannelRepository, CreateChannelDto, UpdateChannelDto } from '@/core/repositories/IChannelRepository'
import type { Channel, ChannelType, ChannelStatus, ChannelConfig } from '@/core/entities/Channel'

@Injectable()
export class ChannelRepository implements IChannelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId?: string): Promise<Channel[]> {
    const rows = await this.prisma.channel.findMany({
      where:   tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(this.toEntity)
  }

  async findById(id: string, tenantId?: string): Promise<Channel | null> {
    const row = await this.prisma.channel.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    })
    return row ? this.toEntity(row) : null
  }

  async create(dto: CreateChannelDto, tenantId: string): Promise<Channel> {
    const row = await this.prisma.channel.create({
      data: {
        tenantId,
        name:        dto.name,
        type:        dto.type,
        phoneNumber: dto.phoneNumber,
        config:      dto.config as object,
        status:      'UNKNOWN',
      },
    })
    return this.toEntity(row)
  }

  async update(id: string, dto: UpdateChannelDto, tenantId?: string): Promise<Channel> {
    // Valida ownership via findFirst antes do update (update por PK não tem where por tenant)
    const owned = await this.prisma.channel.findFirst({
      where:  tenantId ? { id, tenantId } : { id },
      select: { id: true },
    })
    if (!owned) throw new NotFoundException('Canal não encontrado')

    const row = await this.prisma.channel.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name: dto.name }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.config      !== undefined && { config: dto.config as object }),
      },
    })
    return this.toEntity(row)
  }

  async updateStatus(id: string, status: ChannelStatus, blockedAt?: Date): Promise<Channel> {
    const row = await this.prisma.channel.update({
      where: { id },
      data: {
        status,
        lastCheckedAt: new Date(),
        ...(blockedAt !== undefined && { blockedAt }),
      },
    })
    return this.toEntity(row)
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const owned = await this.prisma.channel.findFirst({
      where:  tenantId ? { id, tenantId } : { id },
      select: { id: true },
    })
    if (!owned) throw new NotFoundException('Canal não encontrado')
    await this.prisma.channel.delete({ where: { id } })
  }

  private toEntity(row: {
    id: string; tenantId: string; name: string; type: string; phoneNumber: string | null
    status: string; config: unknown; lastCheckedAt: Date | null
    blockedAt: Date | null; createdAt: Date; updatedAt: Date
  }): Channel {
    return {
      id:            row.id,
      tenantId:      row.tenantId,
      name:          row.name,
      type:          row.type as ChannelType,
      phoneNumber:   row.phoneNumber ?? undefined,
      status:        row.status as ChannelStatus,
      config:        (row.config ?? {}) as ChannelConfig,
      lastCheckedAt: row.lastCheckedAt ?? undefined,
      blockedAt:     row.blockedAt ?? undefined,
      createdAt:     row.createdAt,
      updatedAt:     row.updatedAt,
    }
  }
}
