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

const WARMUP_PLATEAU = 200

/**
 * Teto diário de mensagens por NÚMERO (canal), considerando a curva de aquecimento.
 * Curva (dias desde o 1º envio): 1–2→20, 3–4→30, 5–7→50, 8–14→80, 15–21→120, 22+→200.
 * `dailyMessageCap` (>0) é um teto manual que, se menor que a curva, prevalece.
 */
function channelDailyCap(channel: {
  warmupEnabled:   boolean
  isWarmedUp:      boolean
  warmupStartedAt: Date | null
  dailyMessageCap: number
}): number {
  // Chip já aquecido ou warmup desligado → teto manual (se houver) ou platô.
  if (channel.isWarmedUp || !channel.warmupEnabled) {
    return channel.dailyMessageCap > 0 ? channel.dailyMessageCap : WARMUP_PLATEAU
  }
  // Em aquecimento → curva crescente por dias corridos desde o 1º envio (dia 1 = hoje).
  const start = channel.warmupStartedAt ?? new Date()
  const days  = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60_000)) + 1
  let curve: number
  if      (days <= 2)  curve = 20
  else if (days <= 4)  curve = 30
  else if (days <= 7)  curve = 50
  else if (days <= 14) curve = 80
  else if (days <= 21) curve = 120
  else                 curve = WARMUP_PLATEAU
  // Respeita o menor entre a curva e um teto manual configurado.
  return channel.dailyMessageCap > 0 ? Math.min(curve, channel.dailyMessageCap) : curve
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

    // IDEMPOTÊNCIA (defesa de fundo de poço): se já existe um SUCCESS desse
    // lead+template, não re-envia. Protege contra qualquer cenário de jobs
    // duplicados na fila (pause/resume em sequência, race conditions, retries
    // do BullMQ após exceção tardia). O dedup na fila é a 1ª linha; isto é a 2ª.
    const alreadySent = await this.prisma.campaignDispatchLog.findFirst({
      where:  { leadId, templateId, status: 'SUCCESS' },
      select: { id: true, sentAt: true },
    })
    if (alreadySent) {
      this.logger.warn(
        `Lead ${leadId}: template ${templateId} JÁ ENVIADO em ${alreadySent.sentAt.toISOString()} ` +
        `(dispatch ${alreadySent.id}) — DUPLICATA EVITADA`,
      )
      if (lead.status !== 'SENT') {
        await this.prisma.campaignLead.update({
          where: { id: leadId },
          data:  { status: 'SENT' },
        })
      }
      return
    }

    const actualCampaignId = lead.campaignId || campaignIdFromJob
    const campaign = await this.prisma.campaign.findUnique({
      where:  { id: actualCampaignId },
      select: {
        id: true, status: true, rotationMode: true, channelId: true,
        scheduleEnabled: true, scheduleStartHour: true, scheduleEndHour: true,
        scheduleDays: true, scheduleTimezone: true,
        dailyLimit: true, longPauseEvery: true,
        longPauseMinMinutes: true, longPauseMaxMinutes: true,
        messagesSinceBreak: true, typingSimulation: true,
        autoPauseOnError: true, errorThresholdPct: true,
        lastResumedAt: true,
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

    // 2c. Limite diário (últimas 24h)
    if (campaign.dailyLimit > 0) {
      const last24h = new Date(Date.now() - 24 * 60 * 60_000)
      const sentLast24h = await this.prisma.campaignLead.count({
        where: {
          campaignId: actualCampaignId,
          status: { in: ['SENT', 'REPLIED'] },
          lastMessageAt: { gte: last24h },
        },
      })
      if (sentLast24h >= campaign.dailyLimit) {
        this.logger.log(
          `Lead ${leadId}: limite diário atingido (${sentLast24h}/${campaign.dailyLimit}) — re-agendando em 1h`,
        )
        await this.dispatchQueue.enqueue(job.data, 60 * 60_000)
        return
      }
    }

    // 2d. Pausa longa periódica (a cada N envios)
    if (campaign.longPauseEvery > 0 && campaign.messagesSinceBreak >= campaign.longPauseEvery) {
      const minMs = campaign.longPauseMinMinutes * 60_000
      const maxMs = campaign.longPauseMaxMinutes * 60_000
      const delayMs = minMs + Math.floor(Math.random() * (maxMs - minMs + 1))
      this.logger.log(
        `Lead ${leadId}: pausa longa após ${campaign.messagesSinceBreak} envios — re-agendando em ${Math.round(delayMs/60_000)}min`,
      )
      await this.prisma.campaign.update({
        where: { id: actualCampaignId },
        data:  { messagesSinceBreak: 0 },
      })
      await this.dispatchQueue.enqueue(job.data, delayMs)
      return
    }

    // 2e. Auto-pause se taxa de erro disparar nos últimos 20 envios.
    // Janela: só conta dispatch_logs após o último resume da campanha — sem isso,
    // erros antigos paralisam toda nova retomada (feedback loop).
    if (campaign.autoPauseOnError) {
      const recent = await this.prisma.campaignDispatchLog.findMany({
        where: {
          lead: { campaignId: actualCampaignId },
          ...(campaign.lastResumedAt ? { sentAt: { gt: campaign.lastResumedAt } } : {}),
        },
        orderBy: { sentAt: 'desc' },
        take:    20,
        select:  { status: true },
      })
      if (recent.length >= 10) {
        const failed = recent.filter(r => r.status === 'FAILED').length
        const pct    = (failed / recent.length) * 100
        if (pct >= campaign.errorThresholdPct) {
          this.logger.warn(
            `Campanha ${actualCampaignId}: ${pct.toFixed(0)}% de erros nos últimos ${recent.length} envios — pausando automaticamente`,
          )
          await this.prisma.campaign.update({
            where: { id: actualCampaignId },
            data:  { status: 'PAUSED' },
          })
          await this.prisma.campaignLead.update({
            where: { id: leadId },
            data:  { status: 'PENDING' },
          })
          return
        }
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

    // 5b. Canal caído/bloqueado → NÃO envia. Pausa a campanha e devolve o lead p/ fila.
    // O poller (a cada 30s) mantém channel.status; enviar por um número caído/banido
    // só piora a situação. Status UNKNOWN/CONNECTED segue normalmente.
    if (channel.status === 'DISCONNECTED' || channel.status === 'BLOCKED') {
      this.logger.warn(
        `Canal ${channel.id} (${channel.name}) está ${channel.status} — pausando campanha ` +
        `${actualCampaignId} e devolvendo lead ${leadId} para a fila`,
      )
      await this.prisma.campaign.update({
        where: { id: actualCampaignId },
        data:  { status: 'PAUSED' },
      })
      await this.prisma.campaignLead.update({
        where: { id: leadId },
        data:  { status: 'PENDING' },
      })
      return
    }

    // 5c. Aquecimento: marca o início no 1º envio do número (lazy init).
    if (channel.warmupEnabled && !channel.isWarmedUp && !channel.warmupStartedAt) {
      const now = new Date()
      await this.prisma.channel.update({
        where: { id: channel.id },
        data:  { warmupStartedAt: now },
      })
      channel.warmupStartedAt = now
    }

    // 5d. Teto diário POR NÚMERO (curva de warmup ou teto manual). Conta envios reais
    // (dispatch_logs SUCCESS) deste canal nas últimas 24h, somando TODAS as campanhas e
    // follow-ups — tudo que sai do número conta p/ risco de ban. Atingido → re-agenda +1h.
    const numberCap = channelDailyCap(channel)
    if (numberCap > 0) {
      const last24h = new Date(Date.now() - 24 * 60 * 60_000)
      const sentByNumber = await this.prisma.campaignDispatchLog.count({
        where: {
          status: 'SUCCESS',
          sentAt: { gte: last24h },
          lead:   { campaign: { channelId: effectiveChannelId } },
        },
      })
      if (sentByNumber >= numberCap) {
        this.logger.log(
          `Canal ${channel.id}: teto diário por número atingido (${sentByNumber}/${numberCap}) — ` +
          `re-agendando lead ${leadId} em 1h`,
        )
        await this.dispatchQueue.enqueue(job.data, 60 * 60_000)
        return
      }
    }

    // 6. Envia cada parte com delay humanizado (3–8s entre partes)
    const renderedParts: string[] = []
    try {
      for (let partIdx = 0; partIdx < parts.length; partIdx++) {
        const rendered = renderTemplate(parts[partIdx], lead)
        renderedParts.push(rendered)

        // Simulação de "digitando…" antes de enviar (humaniza o envio)
        if (campaign.typingSimulation) {
          await this.channelSend.sendTyping(channel as any, lead.phone)
          await sleep(1_500 + Math.floor(Math.random() * 2_500)) // 1.5–4s "digitando"
        }

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

      // 9. Incrementa sentCount + messagesSinceBreak (anti-ban)
      await this.prisma.campaign.update({
        where: { id: actualCampaignId },
        data:  {
          sentCount:          { increment: 1 },
          messagesSinceBreak: { increment: 1 },
        },
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
