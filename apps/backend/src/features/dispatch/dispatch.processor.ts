/**
 * DispatchProcessor — Worker BullMQ que processa envio de cada Lead
 *
 * Fluxo por job:
 * 1. Carrega lead + campaign + template
 * 2. Verifica se campanha ainda está RUNNING
 * 3. Verifica janela de horário comercial (re-agenda se fora)
 * 4. Seleciona variação do spintext (RANDOM ou SEQUENTIAL)
 * 5. Substitui {{1}}..{{5}} pelos valores do lead
 * 6. Envia cada parte com delay humanizado (3–8s entre partes)
 * 7. Atualiza status do lead e cria DispatchLog
 * 8. Verifica se campanha completou
 *
 * O delay de 120s já foi aplicado no DispatchService ao enfileirar.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService }     from '@nestjs/config'
import { Worker, Job }       from 'bullmq'
import { PrismaService }     from '@/infrastructure/database/prisma/prisma.service'
import { ChannelSendService } from '@/infrastructure/channel-send/channel-send.service'
import { DISPATCH_QUEUE_NAME, LeadJobData, DispatchQueueService } from './dispatch-queue.service'

function msUntilNextScheduledSlot(
  startHour: number,
  endHour:   number,
  days:      number[],
  timezone:  string,
): number | null {
  const now      = new Date()
  const tzFmt    = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: 'numeric',
    weekday: 'short', hour12: false,
  })
  const toParts  = (d: Date) => {
    const p = tzFmt.formatToParts(d)
    const get = (t: string) => p.find(x => x.type === t)?.value ?? ''
    const dayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }
    return {
      day:    dayMap[get('weekday')] ?? 1,
      hour:   parseInt(get('hour'), 10),
      minute: parseInt(get('minute'), 10),
    }
  }

  const cur = toParts(now)
  if (days.includes(cur.day) && cur.hour >= startHour && cur.hour < endHour) {
    return null
  }

  for (let minsAhead = 1; minsAhead <= 7 * 24 * 60; minsAhead += 15) {
    const probe = new Date(now.getTime() + minsAhead * 60_000)
    const p     = toParts(probe)
    if (days.includes(p.day) && p.hour >= startHour && p.hour < endHour) {
      return minsAhead * 60_000
    }
  }
  return 60 * 60_000
}

function buildRedisConnection(config: ConfigService) {
  const url = config.get<string>('REDIS_URL')
  if (url) {
    const parsed = new URL(url)
    const isTls  = url.startsWith('rediss://')
    return {
      host:                 parsed.hostname,
      port:                 parseInt(parsed.port || '6379'),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(isTls ? { tls: {} } : {}),
      maxRetriesPerRequest: null as unknown as number,
      enableOfflineQueue:   false,
    }
  }
  return {
    host:                 config.get<string>('REDIS_HOST', 'localhost'),
    port:                 config.get<number>('REDIS_PORT', 6379),
    maxRetriesPerRequest: null as unknown as number,
    enableOfflineQueue:   false,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function renderTemplate(text: string, lead: {
  var1?: string | null; var2?: string | null; var3?: string | null
  var4?: string | null; var5?: string | null
}): string {
  return text
    .replace(/\{\{1\}\}/g, lead.var1 ?? '')
    .replace(/\{\{2\}\}/g, lead.var2 ?? '')
    .replace(/\{\{3\}\}/g, lead.var3 ?? '')
    .replace(/\{\{4\}\}/g, lead.var4 ?? '')
    .replace(/\{\{5\}\}/g, lead.var5 ?? '')
}

@Injectable()
export class DispatchProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchProcessor.name)
  private worker!: Worker

  constructor(
    private readonly config:        ConfigService,
    private readonly prisma:        PrismaService,
    private readonly channelSend:   ChannelSendService,
    private readonly dispatchQueue: DispatchQueueService,
  ) {}

  onModuleInit() {
    const connection = buildRedisConnection(this.config)
    this.worker = new Worker<LeadJobData>(
      DISPATCH_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency: 1, // um envio por vez (anti-ban)
      },
    )

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} falhou: ${err.message}`)
    })

    this.logger.log('DispatchProcessor iniciado')
  }

  private async process(job: Job<LeadJobData>): Promise<void> {
    const { leadId, campaignId: campaignIdFromJob, templateId, channelId } = job.data

    // 1. Carrega lead
    const lead = await this.prisma.campaignLead.findUnique({
      where:  { id: leadId },
      select: {
        id: true, campaignId: true, phone: true,
        var1: true, var2: true, var3: true, var4: true, var5: true,
        status: true,
      },
    })
    if (!lead) {
      this.logger.warn(`Job ${job.id}: lead ${leadId} não encontrado — ignorando`)
      return
    }

    if (lead.status === 'REPLIED' || lead.status === 'OPTED_OUT') {
      this.logger.debug(`Lead ${leadId} já respondeu — job ignorado`)
      return
    }

    const actualCampaignId = lead.campaignId || campaignIdFromJob
    const campaign = await this.prisma.campaign.findUnique({
      where:  { id: actualCampaignId },
      select: {
        id: true, status: true, rotationMode: true, channelId: true,
        scheduleEnabled: true, scheduleStartHour: true, scheduleEndHour: true,
        scheduleDays: true, scheduleTimezone: true,
      },
    })

    // 2. Verifica se campanha ainda está RUNNING
    if (!campaign || campaign.status !== 'RUNNING') {
      this.logger.debug(`Campanha ${actualCampaignId} não está RUNNING — lead ${leadId} ignorado`)
      await this.prisma.campaignLead.update({
        where: { id: leadId },
        data:  { status: 'PENDING' },
      })
      return
    }

    // 2b. Verifica janela de horário comercial
    if (campaign.scheduleEnabled) {
      const days     = Array.isArray(campaign.scheduleDays) ? campaign.scheduleDays as number[] : [1,2,3,4,5]
      const delayMs  = msUntilNextScheduledSlot(
        campaign.scheduleStartHour,
        campaign.scheduleEndHour,
        days,
        campaign.scheduleTimezone,
      )
      if (delayMs !== null) {
        this.logger.log(
          `Lead ${leadId}: fora da janela de disparo — re-agendando em ${Math.round(delayMs / 60_000)}min`,
        )
        await this.dispatchQueue.enqueue(job.data, delayMs)
        return
      }
    }

    // 3. Carrega template
    const template = await this.prisma.campaignTemplate.findUnique({
      where:  { id: templateId },
      select: { id: true, variations: true, order: true },
    })
    if (!template || !Array.isArray(template.variations) || template.variations.length === 0) {
      this.logger.error(`Template ${templateId} sem variações — lead ${leadId} marcado como ERROR`)
      await this.markLeadError(leadId, actualCampaignId, templateId, 'Template sem variações')
      return
    }

    // 4. Seleciona variação (RANDOM ou SEQUENTIAL)
    const rawVariations = template.variations as (string | string[])[]
    const idx = campaign.rotationMode === 'SEQUENTIAL'
      ? job.attemptsMade % rawVariations.length
      : Math.floor(Math.random() * rawVariations.length)

    const rawVariation = rawVariations[idx]
    const parts: string[] = Array.isArray(rawVariation) ? rawVariation : [rawVariation]

    // 5. Busca canal
    const effectiveChannelId = campaign.channelId ?? channelId
    const channel = await this.prisma.channel.findUnique({ where: { id: effectiveChannelId } })
    if (!channel) {
      await this.markLeadError(leadId, actualCampaignId, templateId, `Canal ${effectiveChannelId} não encontrado`)
      return
    }

    // 6. Envia cada parte com delay humanizado (3–8s entre partes)
    const renderedParts: string[] = []
    try {
      for (let partIdx = 0; partIdx < parts.length; partIdx++) {
        const rendered = renderTemplate(parts[partIdx], lead)
        renderedParts.push(rendered)

        await this.channelSend.send(channel as any, lead.phone, rendered)
        this.logger.debug(`Lead ${leadId}: parte ${partIdx + 1}/${parts.length} enviada → ${lead.phone}`)

        if (partIdx < parts.length - 1) {
          const delayMs = 3_000 + Math.floor(Math.random() * 5_000)
          await sleep(delayMs)
        }
      }

      // 7. Atualiza lead → SENT
      await this.prisma.campaignLead.update({
        where: { id: leadId },
        data:  { status: 'SENT', lastMessageAt: new Date(), kanbanColumn: 'MENSAGEM_ENVIADA' },
      })

      // 8. DispatchLog
      await this.prisma.campaignDispatchLog.create({
        data: {
          leadId,
          templateId,
          messageSent:  renderedParts.join('\n---\n'),
          variationIdx: idx,
          status:       'SUCCESS',
        },
      })

      // 9. Incrementa sentCount
      await this.prisma.campaign.update({
        where: { id: actualCampaignId },
        data:  { sentCount: { increment: 1 } },
      })

      this.logger.log(`Lead ${leadId} enviado (variação ${idx}, ${parts.length} partes) → ${lead.phone}`)
    } catch (err: any) {
      const sent = renderedParts.join('\n---\n')
      await this.markLeadError(leadId, actualCampaignId, templateId, err?.message ?? String(err), idx, sent)
      this.logger.warn(`Lead ${leadId}: falha no envio → ${err?.message}`)
    }

    // 10. Verifica se campanha completou
    const remaining = await this.prisma.campaignLead.count({
      where: { campaignId: actualCampaignId, status: { in: ['PENDING', 'QUEUED'] } },
    })
    if (remaining === 0) {
      await this.prisma.campaign.update({
        where: { id: actualCampaignId },
        data:  { status: 'COMPLETED', completedAt: new Date() },
      })
      this.logger.log(`Campanha ${actualCampaignId} concluída`)
    }
  }

  private async markLeadError(
    leadId:      string,
    campaignId:  string,
    templateId:  string,
    errorMsg:    string,
    variationIdx = 0,
    messageSent  = '',
  ): Promise<void> {
    await Promise.all([
      this.prisma.campaignLead.update({
        where: { id: leadId },
        data:  { status: 'ERROR' },
      }),
      this.prisma.campaignDispatchLog.create({
        data: { leadId, templateId, messageSent, variationIdx, status: 'FAILED', errorMsg },
      }),
      this.prisma.campaign.update({
        where: { id: campaignId },
        data:  { errorCount: { increment: 1 } },
      }),
    ])
  }

  async onModuleDestroy() {
    await this.worker.close()
  }
}
