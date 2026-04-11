/**
 * DispatchService — Orquestra o enfileiramento de campanhas
 *
 * Anti-ban 3ª camada: delay SEMPRE >= MIN_DISPATCH_DELAY_MS (120s).
 * (1ª camada = validação no CampaignsService, 2ª = CHECK constraint no banco)
 */

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }       from '@nestjs/config'
import { PrismaService }       from '@/infrastructure/database/prisma/prisma.service'
import { DispatchQueueService } from './dispatch-queue.service'

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name)

  constructor(
    private readonly prisma:   PrismaService,
    private readonly queue:    DispatchQueueService,
    private readonly config:   ConfigService,
  ) {}

  private get minDelayMs(): number {
    const env = this.config.get<number>('MIN_DISPATCH_DELAY_MS', 120_000)
    return Math.max(120_000, Number(env))
  }

  private randomDelay(minSec: number, maxSec: number): number {
    const minMs = Math.max(this.minDelayMs, minSec * 1000)
    const maxMs = Math.max(minMs, maxSec * 1000)
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  }

  async enqueueCampaign(campaign: {
    id:          string
    channelId?:  string | null
    delayMinSec: number
    delayMaxSec: number
    rotationMode: string
  }): Promise<void> {
    if (!campaign.channelId) {
      this.logger.warn(`Campanha ${campaign.id} sem canal configurado — não enfileirado`)
      return
    }

    const template = await this.prisma.campaignTemplate.findFirst({
      where:   { campaignId: campaign.id, type: 'INITIAL' },
      orderBy: { order: 'asc' },
    })
    if (!template) {
      this.logger.warn(`Campanha ${campaign.id}: sem template INITIAL — não enfileirado`)
      return
    }

    const leads = await this.prisma.campaignLead.findMany({
      where:   { campaignId: campaign.id, status: { in: ['PENDING', 'QUEUED'] } },
      select:  { id: true },
      orderBy: { createdAt: 'asc' },
    })

    if (leads.length === 0) {
      this.logger.log(`Campanha ${campaign.id}: sem leads pendentes`)
      return
    }

    this.logger.log(`Campanha ${campaign.id}: enfileirando ${leads.length} leads`)

    let accumulatedDelay = 0

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]

      await this.queue.enqueue(
        {
          leadId:     lead.id,
          campaignId: campaign.id,
          templateId: template.id,
          channelId:  campaign.channelId!,
        },
        accumulatedDelay,
      )

      await this.prisma.campaignLead.update({
        where: { id: lead.id },
        data:  { status: 'QUEUED' },
      })

      accumulatedDelay += this.randomDelay(campaign.delayMinSec, campaign.delayMaxSec)
    }

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data:  { totalLeads: leads.length },
    })

    this.logger.log(
      `Campanha ${campaign.id}: ${leads.length} leads enfileirados. ` +
      `Tempo total estimado: ~${Math.round(accumulatedDelay / 60000)} minutos`,
    )
  }

  async enqueueFollowUp(params: {
    leads:      Array<{ id: string }>
    templateId: string
    channelId:  string
    delayMinSec: number
    delayMaxSec: number
  }): Promise<void> {
    let accumulatedDelay = 0

    for (const lead of params.leads) {
      await this.queue.enqueue(
        {
          leadId:     lead.id,
          campaignId: '',
          templateId: params.templateId,
          channelId:  params.channelId,
        },
        accumulatedDelay,
      )

      await this.prisma.campaignLead.update({
        where: { id: lead.id },
        data:  { status: 'QUEUED', nextActionAt: null },
      })

      accumulatedDelay += this.randomDelay(params.delayMinSec, params.delayMaxSec)
    }

    this.logger.log(`Follow-up: ${params.leads.length} leads enfileirados`)
  }
}
