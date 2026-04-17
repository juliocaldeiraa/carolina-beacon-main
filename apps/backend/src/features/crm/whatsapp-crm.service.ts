/**
 * WhatsAppCrmService — CRM de leads que chegam via WhatsApp (agentes de IA).
 *
 * Funil: Contato Feito → Em Conversa → Agendado → Confirmado → Compareceu | Perdido
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

@Injectable()
export class WhatsAppCrmService {
  private readonly logger = new Logger(WhatsAppCrmService.name)

  constructor(private readonly prisma: PrismaService) {}

  private get defaultTenantId() { return process.env.DEFAULT_TENANT_ID! }

  async findLeads(filters: { agentId?: string; stage?: string; search?: string } = {}, tenantId?: string) {
    const where: any = { tenantId: tenantId ?? this.defaultTenantId }
    if (filters.agentId) where.agentId = filters.agentId
    if (filters.stage) where.stage = filters.stage
    if (filters.search) {
      where.OR = [
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { contactPhone: { contains: filters.search } },
      ]
    }

    return this.prisma.whatsAppLead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
      },
    })
  }

  async upsertLead(data: {
    agentId: string
    phone: string
    name?: string
    stage?: string
    conversationId?: string
    calendarEventId?: string
    appointmentDate?: Date
    lastMessage?: string
  }): Promise<void> {
    try {
      const existing = await this.prisma.whatsAppLead.findUnique({
        where: { agentId_contactPhone: { agentId: data.agentId, contactPhone: data.phone } },
      })

      if (existing) {
        // Só avança o stage, nunca retrocede (exceto pra lost)
        const stageOrder = ['contact_made', 'in_conversation', 'scheduled', 'confirmed', 'attended', 'lost']
        const currentIdx = stageOrder.indexOf(existing.stage)
        const newIdx = data.stage ? stageOrder.indexOf(data.stage) : -1

        const update: any = { updatedAt: new Date() }
        if (data.name && !existing.contactName) update.contactName = data.name
        if (data.conversationId) update.conversationId = data.conversationId
        if (data.calendarEventId) update.calendarEventId = data.calendarEventId
        if (data.appointmentDate) update.appointmentDate = data.appointmentDate
        if (data.lastMessage) update.lastMessage = data.lastMessage
        if (data.stage && (newIdx > currentIdx || data.stage === 'lost')) update.stage = data.stage

        await this.prisma.whatsAppLead.update({
          where: { id: existing.id },
          data: update,
        })
      } else {
        await this.prisma.whatsAppLead.create({
          data: {
            tenantId: this.defaultTenantId,
            agentId: data.agentId,
            contactPhone: data.phone,
            contactName: data.name ?? null,
            stage: data.stage ?? 'contact_made',
            conversationId: data.conversationId ?? null,
            calendarEventId: data.calendarEventId ?? null,
            appointmentDate: data.appointmentDate ?? null,
            lastMessage: data.lastMessage ?? null,
          },
        })
      }
    } catch (err) {
      this.logger.error(`[whatsapp-crm] upsertLead failed: ${err}`)
    }
  }

  async moveToStage(leadId: string, stage: string, lostReason?: string) {
    return this.prisma.whatsAppLead.update({
      where: { id: leadId },
      data: {
        stage,
        ...(lostReason && { lostReason }),
        updatedAt: new Date(),
      },
    })
  }

  async updateNotes(leadId: string, notes: string) {
    return this.prisma.whatsAppLead.update({
      where: { id: leadId },
      data: { notes },
    })
  }

  async getStats(agentId?: string, tenantId?: string) {
    const where: any = { tenantId: tenantId ?? this.defaultTenantId }
    if (agentId) where.agentId = agentId

    const leads = await this.prisma.whatsAppLead.groupBy({
      by: ['stage'],
      where,
      _count: { id: true },
    })

    const stats: Record<string, number> = {}
    for (const l of leads) {
      stats[l.stage] = l._count.id
    }
    return stats
  }

}
