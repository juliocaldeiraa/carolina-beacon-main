import { Injectable }         from '@nestjs/common'
import { PrismaService }      from '@/infrastructure/database/prisma/prisma.service'
import type { IBroadcastRepository, CreateBroadcastDto } from '@/core/repositories/IBroadcastRepository'
import type { Broadcast, BroadcastStatus }               from '@/core/entities/Broadcast'

@Injectable()
export class BroadcastRepository implements IBroadcastRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  async findAll(): Promise<Broadcast[]> {
    const rows = await this.prisma.broadcast.findMany({
      where:   { tenantId: this.tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(this.toEntity)
  }

  async findById(id: string): Promise<Broadcast | null> {
    const row = await this.prisma.broadcast.findFirst({ where: { id, tenantId: this.tenantId } })
    return row ? this.toEntity(row) : null
  }

  async create(dto: CreateBroadcastDto): Promise<Broadcast> {
    const row = await this.prisma.broadcast.create({
      data: {
        tenantId:  this.tenantId,
        agentId:   dto.agentId ?? null,
        channelId: dto.channelId ?? null,
        name:      dto.name,
        template:  dto.template,
        audience:  dto.audience,
        status:    'DRAFT',
        messageDelayMinSeconds:  dto.messageDelayMinSeconds  ?? 3,
        messageDelayMaxSeconds:  dto.messageDelayMaxSeconds  ?? 8,
        batchSizeMin:            dto.batchSizeMin            ?? 20,
        batchSizeMax:            dto.batchSizeMax            ?? 30,
        batchIntervalMinMinutes: dto.batchIntervalMinMinutes ?? 30,
        batchIntervalMaxMinutes: dto.batchIntervalMaxMinutes ?? 45,
      },
    })
    return this.toEntity(row)
  }

  async updateStatus(id: string, status: BroadcastStatus): Promise<Broadcast> {
    const row = await this.prisma.broadcast.update({
      where: { id },
      data: {
        status,
        sentAt: status === 'COMPLETED' ? new Date() : undefined,
      },
    })
    return this.toEntity(row)
  }

  private toEntity(row: {
    id: string; tenantId: string; agentId: string | null; channelId: string | null;
    name: string; template: string; audience: unknown; status: string;
    sentAt: Date | null; createdAt: Date; updatedAt: Date;
    messageDelayMinSeconds: number; messageDelayMaxSeconds: number;
    batchSizeMin: number; batchSizeMax: number;
    batchIntervalMinMinutes: number; batchIntervalMaxMinutes: number;
  }): Broadcast {
    return {
      id:        row.id,
      tenantId:  row.tenantId,
      agentId:   row.agentId,
      channelId: row.channelId,
      name:      row.name,
      template:  row.template,
      audience:  row.audience as string[],
      status:    row.status as BroadcastStatus,
      sentAt:    row.sentAt,
      messageDelayMinSeconds:  row.messageDelayMinSeconds,
      messageDelayMaxSeconds:  row.messageDelayMaxSeconds,
      batchSizeMin:            row.batchSizeMin,
      batchSizeMax:            row.batchSizeMax,
      batchIntervalMinMinutes: row.batchIntervalMinMinutes,
      batchIntervalMaxMinutes: row.batchIntervalMaxMinutes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
