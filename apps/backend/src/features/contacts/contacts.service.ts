/**
 * ContactsService — Banco de dados de contatos
 *
 * Contatos são criados automaticamente via webhook ingestion (upsertByPhone)
 * e podem ser enriquecidos manualmente (email, notas, tags).
 */

import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

export interface ContactFilters {
  search?:    string
  channelId?: string
  tag?:       string
  page?:      number
  limit?:     number
}

export interface UpdateContactDto {
  name?:  string
  email?: string
  notes?: string
  tags?:  string[]
}

export interface UpsertContactDto {
  phone:      string
  name?:      string
  channelId?: string
}

@Injectable()
export class ContactsService {
  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ContactFilters = {}) {
    const { search, channelId, tag, page = 1, limit = 50 } = filters
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { tenantId: this.tenantId }
    if (channelId) where['channelId'] = channelId
    if (search) {
      where['OR'] = [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (tag) {
      // Filtra por tag dentro do array JSON
      where['tags'] = { array_contains: tag }
    }

    const [total, items] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { lastContactAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
      }),
    ])

    return { items, total, page, limit }
  }

  async findById(id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId: this.tenantId },
    })
    if (!contact) throw new NotFoundException('Contato não encontrado')

    // Busca conversas vinculadas pelo telefone do contato
    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId: this.tenantId, contactPhone: contact.phone },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id:           true,
        status:       true,
        startedAt:    true,
        lastMessageAt: true,
        turns:        true,
        channelId:    true,
        agent: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true },
        },
      },
    })

    return { ...contact, conversations }
  }

  async update(id: string, dto: UpdateContactDto) {
    const existing = await this.prisma.contact.findFirst({ where: { id, tenantId: this.tenantId } })
    if (!existing) throw new NotFoundException('Contato não encontrado')

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.name  !== undefined && { name:  dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags  !== undefined && { tags:  dto.tags }),
        updatedAt: new Date(),
      },
    })
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.contact.findFirst({ where: { id, tenantId: this.tenantId } })
    if (!existing) throw new NotFoundException('Contato não encontrado')
    await this.prisma.contact.delete({ where: { id } })
  }

  /**
   * Cria ou atualiza o contato quando uma nova conversa é recebida.
   * Chamado pelo WebhookIngestionService após criar/encontrar conversa.
   */
  async upsertByPhone(dto: UpsertContactDto): Promise<void> {
    const { phone, name, channelId } = dto
    const tenantId = this.tenantId

    try {
      await this.prisma.contact.upsert({
        where:  { tenantId_phone: { tenantId, phone } },
        create: {
          tenantId,
          phone,
          name:          name ?? phone,
          channelId,
          convCount:     1,
          lastContactAt: new Date(),
        },
        update: {
          // Atualiza nome apenas se chegou um nome novo
          ...(name && { name }),
          lastContactAt: new Date(),
          convCount:     { increment: 1 },
          updatedAt:     new Date(),
        },
      })
    } catch {
      // Não deve interromper o fluxo de ingestão
    }
  }
}
