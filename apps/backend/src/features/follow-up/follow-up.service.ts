/**
 * FollowUpService — Gerencia regras de follow-up e cron de disparo
 *
 * Cron roda a cada 10 minutos e verifica leads que precisam de follow-up:
 * - status = triggerOnStatus (padrão: SENT)
 * - lastMessageAt + triggerAfterMinutes < NOW()
 * - campanha ainda está RUNNING
 *
 * Após MAX_FOLLOW_UPS sem resposta, move lead para SEM_INTERESSE.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService }  from '@/infrastructure/database/prisma/prisma.service'
import { DispatchService } from '@/features/dispatch/dispatch.service'

export interface CreateFollowUpWithTemplateDto {
  order:                number
  variations:           string[][]
  triggerAfterMinutes:  number
  triggerOnStatus?:     string
}

const MAX_FOLLOW_UPS = 3

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name)

  constructor(
    private readonly prisma:    PrismaService,
    private readonly dispatch:  DispatchService,
  ) {}

  async createWithTemplate(campaignId: string, dto: CreateFollowUpWithTemplateDto) {
    if (dto.order < 1 || dto.order > MAX_FOLLOW_UPS) {
      throw new BadRequestException(`order deve ser entre 1 e ${MAX_FOLLOW_UPS}`)
    }
    if (dto.triggerAfterMinutes < 1) {
      throw new BadRequestException('triggerAfterMinutes deve ser >= 1')
    }
    if (!dto.variations?.length || !dto.variations.some((p) => p.some((t) => t.trim()))) {
      throw new BadRequestException('O follow-up precisa de ao menos uma mensagem')
    }

    const existing = await this.prisma.campaignTemplate.findFirst({
      where: { campaignId, type: 'FOLLOW_UP', order: dto.order },
      include: { followUpRule: true },
    })
    if (existing) {
      await this.prisma.campaignTemplate.delete({ where: { id: existing.id } })
    }

    return this.prisma.campaignTemplate.create({
      data: {
        campaignId,
        type:       'FOLLOW_UP',
        variations: dto.variations,
        order:      dto.order,
        followUpRule: {
          create: {
            triggerAfterMinutes: dto.triggerAfterMinutes,
            triggerOnStatus:     (dto.triggerOnStatus ?? 'SENT') as any,
            isActive:            true,
          },
        },
      },
      include: { followUpRule: true },
    })
  }

  async deleteByOrder(campaignId: string, order: number) {
    const template = await this.prisma.campaignTemplate.findFirst({
      where: { campaignId, type: 'FOLLOW_UP', order },
    })
    if (!template) throw new NotFoundException('Follow-up não encontrado')
    await this.prisma.campaignTemplate.delete({ where: { id: template.id } })
  }

  async findByCampaign(campaignId: string) {
    return this.prisma.followUpRule.findMany({
      where:   { template: { campaignId } },
      include: { template: true },
      orderBy: { template: { order: 'asc' } },
    })
  }

  async updateRule(id: string, dto: { triggerAfterMinutes?: number; triggerOnStatus?: string; isActive?: boolean }) {
    return this.prisma.followUpRule.update({
      where: { id },
      data: {
        ...(dto.triggerAfterMinutes != null ? { triggerAfterMinutes: dto.triggerAfterMinutes } : {}),
        ...(dto.triggerOnStatus             ? { triggerOnStatus:     dto.triggerOnStatus as any } : {}),
        ...(dto.isActive            != null ? { isActive:            dto.isActive } : {}),
      },
    })
  }

  async removeRule(id: string) {
    return this.prisma.followUpRule.delete({ where: { id } })
  }

  @Cron('*/10 * * * *')
  async processFollowUps(): Promise<void> {
    const rules = await this.prisma.followUpRule.findMany({
      where:   { isActive: true },
      include: {
        template: {
          include: { campaign: { select: { id: true, status: true, channelId: true, delayMinSec: true, delayMaxSec: true } } },
        },
      },
    })

    if (rules.length === 0) return

    for (const rule of rules) {
      if (!rule.template?.campaign) continue
      const campaign = rule.template.campaign

      if (campaign.status !== 'RUNNING' || !campaign.channelId) continue

      const cutoff = new Date(Date.now() - rule.triggerAfterMinutes * 60_000)
      const templateOrder = rule.template.order

      const leads = await this.prisma.campaignLead.findMany({
        where: {
          campaignId:    campaign.id,
          status:        rule.triggerOnStatus as any,
          lastMessageAt: { lt: cutoff },
          nextActionAt:  null,
          followUpCount: { lt: templateOrder },
        },
        select: { id: true, followUpCount: true },
        take:   500,
      })

      if (leads.length === 0) continue

      const toSend   = leads.filter((l) => l.followUpCount < MAX_FOLLOW_UPS)
      const toGiveUp = leads.filter((l) => l.followUpCount >= MAX_FOLLOW_UPS)

      if (toGiveUp.length > 0) {
        await this.prisma.campaignLead.updateMany({
          where: { id: { in: toGiveUp.map((l) => l.id) } },
          data:  { kanbanColumn: 'SEM_INTERESSE' },
        })
        this.logger.log(
          `${toGiveUp.length} leads movidos para SEM_INTERESSE após ${MAX_FOLLOW_UPS} follow-ups sem resposta`,
        )
      }

      if (toSend.length === 0) continue

      this.logger.log(
        `Follow-up rule ${rule.id}: ${toSend.length} leads elegíveis ` +
        `(campanha ${campaign.id}, FU ordem ${templateOrder})`,
      )

      await this.dispatch.enqueueFollowUp({
        leads:       toSend,
        templateId:  rule.templateId,
        channelId:   campaign.channelId,
        delayMinSec: campaign.delayMinSec,
        delayMaxSec: campaign.delayMaxSec,
      })

      await this.prisma.campaignLead.updateMany({
        where: { id: { in: toSend.map((l) => l.id) } },
        data:  { followUpCount: { increment: 1 } },
      })
    }
  }
}
