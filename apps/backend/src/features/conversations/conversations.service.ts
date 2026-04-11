import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service'

export interface ConversationFilters {
  channelId?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}

@Injectable()
export class ConversationsService {
  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ConversationFilters = {}) {
    const { channelId, status, search, page = 1, limit = 30 } = filters
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { tenantId: this.tenantId }
    if (channelId) where['channelId'] = channelId
    if (status)    where['status']    = status
    if (search) {
      where['OR'] = [
        { contactName:  { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search } },
      ]
    }

    const [total, items] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          { startedAt: 'desc' },
        ],
        include: {
          agent: { select: { id: true, name: true, model: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
        },
      }),
    ])

    return { items, total, page, limit }
  }

  async findById(id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, tenantId: this.tenantId },
      include: {
        agent:    { select: { id: true, name: true, model: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!conv) throw new NotFoundException('Conversa não encontrada')
    return conv
  }

  async updateStatus(id: string, status: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id, tenantId: this.tenantId } })
    if (!conv) throw new NotFoundException('Conversa não encontrada')

    return this.prisma.conversation.update({
      where: { id },
      data:  { status, ...(status === 'CLOSED' || status === 'RESOLVED' ? { endedAt: new Date() } : {}) },
    })
  }

  async setHumanTakeover(id: string, active: boolean) {
    const conv = await this.prisma.conversation.findFirst({ where: { id, tenantId: this.tenantId } })
    if (!conv) throw new NotFoundException('Conversa não encontrada')

    return this.prisma.conversation.update({
      where: { id },
      data:  { humanTakeover: active },
    })
  }
}
