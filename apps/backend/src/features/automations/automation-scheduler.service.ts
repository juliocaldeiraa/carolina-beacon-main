/**
 * AutomationSchedulerService — Dispara lotes de follow-up para leads
 *
 * Executado a cada 30 minutos via @Interval.
 * Para cada automação ACTIVE:
 *   1. Verifica horário comercial (BRT UTC-3)
 *   2. Verifica intervalo mínimo desde o último lote
 *   3. Resolve canal via ChannelResolverService (primaryChannelId → fallbackChannelIds)
 *   4. Processa etapa 0 (contato inicial) — leads com tentativasFollowup = 0
 *   5. Processa etapas 1..N (follow-ups) — só se não converteu e tempo configurado passou
 *   6. Deduplicação por número — pula leads com mesmo número já enviado neste ciclo
 *   7. Template ALEATÓRIO + delay anti-ban 80–160s
 *   8. Atualiza lead e cria AutomationLog
 */

import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import {
  IAutomationRepository,
  AUTOMATION_REPOSITORY,
} from '@/core/repositories/IAutomationRepository'
import { PrismaService }          from '@/infrastructure/database/prisma/prisma.service'
import { ChannelSendService, PhoneNotOnWhatsAppError } from '@/infrastructure/channel-send/channel-send.service'
import { ChannelResolverService } from './channel-resolver.service'
import { CrmService }            from '@/features/crm/crm.service'
import { brPhoneVariants, normalizePhoneForSend } from '@/shared/utils/phone.utils'
import type { Channel }           from '@/core/entities/Channel'
import type { FollowupStep }      from '@/core/entities/Automation'

/** Interpola variáveis built-in + campos custom (metadata) no template */
function renderTemplate(tpl: string, lead: {
  nome?: string | null; whatsapp: string; whatsappLimpo?: string | null
  status?: string | null; campanha?: string | null; origem?: string | null
  instagramUsername?: string | null; lista?: string | null; metadata?: unknown
}): string {
  let msg = tpl
    .replace(/\{nome\}/g,      lead.nome      ?? '')
    .replace(/\{status\}/g,    lead.status    ?? '')
    .replace(/\{campanha\}/g,  lead.campanha  ?? '')
    .replace(/\{origem\}/g,    lead.origem    ?? '')
    .replace(/\{whatsapp\}/g,  lead.whatsappLimpo ?? lead.whatsapp)
    .replace(/\{instagram\}/g, lead.instagramUsername ?? '')
    .replace(/\{lista\}/g,     lead.lista     ?? '')

  const meta = (lead.metadata as Record<string, unknown>) ?? {}
  for (const [k, v] of Object.entries(meta)) {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''))
  }
  return msg
}

/** Número inteiro aleatório entre min e max (inclusive) */
function randInt(min: number, max: number): number {
  if (min >= max) return min
  return Math.floor(Math.random() * (max - min + 1)) + min
}

@Injectable()
export class AutomationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AutomationSchedulerService.name)

  constructor(
    @Inject(AUTOMATION_REPOSITORY) private readonly repo: IAutomationRepository,
    private readonly prisma:          PrismaService,
    private readonly channelSend:     ChannelSendService,
    private readonly channelResolver: ChannelResolverService,
    private readonly crm:             CrmService,
  ) {}

  /** Roda imediatamente na startup para não perder o ciclo após deploys/restarts */
  async onModuleInit(): Promise<void> {
    // Aguarda 30s para DB e todos os módulos estarem prontos
    setTimeout(() => this.runScheduler(), 30_000)
  }

  @Interval(30 * 60 * 1000) // 30 minutos
  async runScheduler(): Promise<void> {
    this.logger.log('AutomationScheduler: iniciando ciclo')
    try {
      const automations = await this.repo.findAll()
      const active = automations.filter((a) => a.status === 'ACTIVE')
      if (active.length === 0) return

      for (const automation of active) {
        try {
          await this.processAutomation(automation.id)
        } catch (err) {
          this.logger.error(`Erro ao processar automação ${automation.id}: ${err}`)
        }
      }
    } catch (err) {
      this.logger.error('Erro no ciclo do AutomationScheduler', err)
    }
  }

  private async processAutomation(automationId: string): Promise<void> {
    const automation = await this.repo.findById(automationId)
    if (!automation || automation.status !== 'ACTIVE') return

    const now = new Date()

    // 1. Verifica horário comercial BRT (UTC-3)
    if (!this.isWithinBusinessHours(now, automation.startHour, automation.endHour)) {
      this.logger.debug(`Automação ${automation.name}: fora do horário comercial`)
      await this.repo.addLog(automationId, { sent: 0, skipped: 0, errors: 0, reason: 'out_of_hours' })
      return
    }

    // 2. Verifica intervalo mínimo desde o último lote
    if (automation.lastBatchAt) {
      const minIntervalMs = (
        automation.batchIntervalMinMinutes ?? automation.batchIntervalHours * 60
      ) * 60 * 1000

      if (now.getTime() - automation.lastBatchAt.getTime() < minIntervalMs) {
        this.logger.debug(`Automação ${automation.name}: intervalo não atingido`)
        await this.repo.addLog(automationId, { sent: 0, skipped: 0, errors: 0, reason: 'batch_interval_not_reached' })
        return
      }
    }

    // 3. Resolve canal — usa chain primaryChannelId → channelId → fallbackChannelIds
    const channel = await this.channelResolver.resolveForAutomation(automation)
    if (!channel) {
      this.logger.warn(`Automação ${automation.name}: nenhum canal disponível (principal + reservas offline)`)
      await this.repo.addLog(automationId, { sent: 0, skipped: 0, errors: 0, reason: 'no_channel' })
      return
    }

    // 4. Cap diário por canal — máx 300 envios/dia para proteger o número de ban
    const DAILY_CHANNEL_CAP = 300
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sentToday = await this.prisma.automationDispatchLog.count({
      where: { channelId: channel.id, status: 'sent', executedAt: { gte: since24h } },
    })
    if (sentToday >= DAILY_CHANNEL_CAP) {
      this.logger.warn(`Automação ${automation.name}: canal ${channel.name} atingiu cap diário (${sentToday}/${DAILY_CHANNEL_CAP}) — pulando ciclo`)
      await this.repo.addLog(automationId, { sent: 0, skipped: 0, errors: 0, reason: 'daily_channel_cap_reached' })
      return
    }

    // 5. Tamanho do lote RANDOMIZADO dentro do range configurado
    const sizeMin    = automation.batchSizeMin ?? automation.batchSize
    const sizeMax    = automation.batchSizeMax ?? automation.batchSize
    const batchLimit = randInt(sizeMin, sizeMax)

    // 5. Pool de templates iniciais
    const templates = automation.messageTemplates.length > 0
      ? automation.messageTemplates
      : (automation.messageTemplate ? [automation.messageTemplate] : ['Olá {nome}!'])

    // 6. Exclusion tags — status da lead_many_insta a bloquear
    const exclTags: string[] = automation.useExclusionList && automation.exclusionFilterStatus
      ? automation.exclusionFilterStatus.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    // 7. Deduplicação global por número (shared entre etapa 0 e follow-ups do ciclo)
    const sentPhones = new Set<string>()

    let totalSent   = 0
    let totalErrors = 0
    let totalSkip   = 0

    // ── Etapa 0: contato inicial ─────────────────────────────────────────────
    const minHoursAgo   = new Date(now.getTime() - automation.minHoursAfterCapture * 3_600_000)
    const filterStatuses = automation.filterStatus
      .split(',').map((s) => s.trim()).filter(Boolean)
    const filterWhere = filterStatuses.length === 1
      ? { status: filterStatuses[0] }
      : { status: { in: filterStatuses } }
    const blockedStatuses = ['opt_out', 'conversa_encerrada', 'sem_whatsapp', ...exclTags]
    const leadsEtapa0 = await this.prisma.leadManyInsta.findMany({
      where: {
        ...filterWhere,
        tentativasFollowup: 0,
        dataCaptura:        { lte: minHoursAgo },
        converteu:          false,
        NOT: { status: { in: blockedStatuses } },
      },
      take: batchLimit,
    })

    if (leadsEtapa0.length > 0) {
      const { sent, errors, skipped } = await this.sendBatch(
        leadsEtapa0, templates, channel, sentPhones, now, 0, automationId, automation.name,
        automation.dispatchDelayMinMs ?? undefined, automation.dispatchDelayMaxMs ?? undefined,
        (automation as any).linkedAgentId ?? undefined,
        (automation as any).tenantId as string,
      )
      totalSent   += sent
      totalErrors += errors
      totalSkip   += skipped
    }

    // ── Etapas 1..N: follow-ups sequenciais ───────────────────────────────────
    const followupSteps = (automation.followupEnabled !== false)
      ? ((automation.followupSteps ?? []) as FollowupStep[])
      : []

    for (let i = 0; i < followupSteps.length; i++) {
      const step    = followupSteps[i]
      const cutoff  = new Date(now.getTime() - step.afterHours * 3_600_000)
      const stepNum = i + 1 // tentativasFollowup esperado para esta etapa

      if (!step.templates?.length) continue

      const leadsEtapaN = await this.prisma.leadManyInsta.findMany({
        where: {
          tentativasFollowup:       stepNum,
          lastDispatchAutomationId: automationId,   // só leads que esta automação disparou
          converteu:                false,
          dataFollowupEnviado:      { lte: cutoff },
          NOT: { status: { in: ['opt_out', 'conversa_encerrada', 'sem_whatsapp'] } },
        },
        take: batchLimit,
      })

      if (leadsEtapaN.length === 0) continue

      this.logger.log(`Automação ${automation.name}: follow-up etapa ${stepNum} — ${leadsEtapaN.length} leads`)

      const { sent, errors, skipped } = await this.sendBatch(
        leadsEtapaN, step.templates, channel, sentPhones, now, stepNum, automationId, automation.name,
        automation.dispatchDelayMinMs ?? undefined, automation.dispatchDelayMaxMs ?? undefined,
        (automation as any).linkedAgentId ?? undefined,
        (automation as any).tenantId as string,
      )
      totalSent   += sent
      totalErrors += errors
      totalSkip   += skipped
    }

    if (totalSent === 0 && totalErrors === 0 && leadsEtapa0.length === 0) {
      this.logger.debug(`Automação ${automation.name}: nenhum lead elegível`)
      await this.repo.addLog(automationId, { sent: 0, skipped: 0, errors: 0, reason: 'no_leads' })
      return
    }

    // 7. Atualiza automação
    await this.repo.update(automationId, {
      lastBatchAt: now,
      totalSent:   (automation.totalSent ?? 0) + totalSent,
    })

    // 8. Log
    const stepDesc = followupSteps.length > 0
      ? ` + ${followupSteps.length} etapa(s) follow-up`
      : ''
    await this.repo.addLog(automationId, {
      sent:    totalSent,
      skipped: totalSkip,
      errors:  totalErrors,
      reason:  'success',
      notes:   `Lote ${batchLimit} (range ${sizeMin}–${sizeMax}) · ${templates.length} template(s)${stepDesc}`,
    })

    this.logger.log(`Automação ${automation.name}: ${totalSent} enviados, ${totalErrors} erros, ${totalSkip} pulados`)
  }

  /**
   * Envia um batch de leads, aplicando deduplicação por número.
   * Retorna contadores de sent/errors/skipped.
   */
  private async sendBatch(
    leads:             { id: string; whatsapp: string; whatsappLimpo: string | null; nome: string | null; status?: string | null; campanha?: string | null; origem?: string | null; instagramUsername?: string | null; lista?: string | null; metadata?: unknown }[],
    templates:         string[],
    channel:           Channel,
    sentPhones:        Set<string>,
    now:               Date,
    stepNum:           number,  // 0 = inicial, 1+ = follow-up
    automationId:      string,
    automationName:    string,
    dispatchDelayMinMs?: number,
    dispatchDelayMaxMs?: number,
    linkedAgentId?:    string,
    tenantId?:         string,
  ): Promise<{ sent: number; errors: number; skipped: number }> {
    let sent    = 0
    let errors  = 0
    let skipped = 0

    // ── Pré-validação em lote: quais números têm WhatsApp ativo ──────────────
    const normalizedPhones = leads.map((l) => normalizePhoneForSend(l.whatsappLimpo ?? l.whatsapp))
    const validPhones = await this.channelSend.checkWhatsAppNumbers(channel, normalizedPhones)
    this.logger.debug(`[pre-val] ${validPhones.size}/${normalizedPhones.length} números válidos no WhatsApp`)

    // ── Dedup cross-ciclo: pré-popula sentPhones com telefones já enviados nesta etapa ──
    // Evita que dois registros diferentes (duplicatas no banco) com o mesmo phone
    // sejam disparados em ciclos separados.
    if (stepNum === 0) {
      const alreadySent = await this.prisma.automationDispatchLog.findMany({
        where: { automationId, step: 0, status: 'sent', phone: { in: normalizedPhones } },
        select: { phone: true },
      })
      for (const { phone: p } of alreadySent) {
        brPhoneVariants(p).forEach((v) => sentPhones.add(v))
      }
      if (alreadySent.length > 0) {
        this.logger.debug(`[cross-cycle-dedup] ${alreadySent.length} telefone(s) já disparados nesta automação — pulando duplicatas`)
      }
    }

    // Delay pós-validação antes de iniciar os envios (respeito à API)
    await this.sleep(1_500)

    for (let idx = 0; idx < leads.length; idx++) {
      const lead  = leads[idx]
      const phone = normalizedPhones[idx]
      const name  = lead.nome ?? ''

      // Filtra números sem WhatsApp antes de qualquer tentativa de envio
      if (!validPhones.has(phone)) {
        this.logger.debug(`[sem_whatsapp] ${phone} — inválido na pré-validação`)
        this.prisma.leadManyInsta.update({
          where: { id: lead.id },
          data:  { status: 'sem_whatsapp', tentativasFollowup: { increment: 1 } },
        }).catch(() => {})
        this.prisma.automationDispatchLog.create({
          data: { automationId, phone, name: name || null, message: null, status: 'skipped', errorMsg: 'sem_whatsapp', channelId: channel.id, channelName: channel.name, step: stepNum },
        }).catch(() => {})
        skipped++
        continue
      }

      // Deduplicação: pula se qualquer variante já foi enviada neste ciclo
      const variants = brPhoneVariants(phone)
      if (variants.some((v) => sentPhones.has(v))) {
        this.logger.debug(`[dedup] ${phone} já enviado neste ciclo — pulando`)
        skipped++
        this.prisma.automationDispatchLog.create({
          data: { automationId, phone, name: name || null, message: null, status: 'skipped', errorMsg: 'duplicate_phone', channelId: channel.id, channelName: channel.name, step: stepNum },
        }).catch(() => {})
        continue
      }
      variants.forEach((v) => sentPhones.add(v))

      // Pula leads que já falharam 3x nas últimas 24h para esta automação (evita retry infinito em canal com problema)
      const recentErrors = await this.prisma.automationDispatchLog.count({
        where: {
          automationId,
          phone,
          status:      'error',
          executedAt:  { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
      if (recentErrors >= 3) {
        this.logger.warn(`[max-retry] ${phone} — ${recentErrors} erros nas últimas 24h — pulando`)
        this.prisma.automationDispatchLog.create({
          data: { automationId, phone, name: name || null, message: null, status: 'skipped', errorMsg: 'max_retries_exceeded', channelId: channel.id, channelName: channel.name, step: stepNum },
        }).catch(() => {})
        skipped++
        continue
      }

      // Template ALEATÓRIO
      const tpl     = templates[Math.floor(Math.random() * templates.length)]
      const message = renderTemplate(tpl, lead)

      try {
        // Typing simulation anti-ban antes de cada envio
        await this.channelSend.sendTyping(channel, phone).catch(() => {})
        await this.sleep(800 + Math.random() * 1200)

        await this.channelSend.send(channel, phone, message)

        // Status do lead por etapa
        const newStatus = stepNum === 0 ? 'followup_enviado' : `followup_${stepNum}`

        await this.prisma.leadManyInsta.update({
          where: { id: lead.id },
          data: {
            status:                   newStatus,
            dataFollowupEnviado:      now,
            tentativasFollowup:       { increment: 1 },
            lastDispatchAutomationId: automationId,
            ...(stepNum === 0 && { mensagemEnviada: message }),
          },
        })

        this.prisma.automationDispatchLog.create({
          data: { automationId, phone, name: name || null, message, status: 'sent', channelId: channel.id, channelName: channel.name, step: stepNum },
        }).catch(() => {})

        // Registra mensagem enviada como ASSISTANT na conversa da IA (para histórico cross-canal)
        if (linkedAgentId && tenantId) {
          const phoneVariants = brPhoneVariants(phone)
          this.prisma.conversation.findFirst({
            where: { agentId: linkedAgentId, contactPhone: { in: phoneVariants }, tenantId, status: 'OPEN' },
            orderBy: { lastMessageAt: 'desc' },
          }).then(async (conv) => {
            const convId = conv
              ? conv.id
              : (await this.prisma.conversation.create({
                  data: { tenantId, agentId: linkedAgentId, channelId: channel.id, contactPhone: phone, contactName: lead.nome || undefined, status: 'OPEN' },
                })).id
            // Atualiza channelId se migrou de canal
            if (conv && conv.channelId !== channel.id) {
              await this.prisma.conversation.update({ where: { id: conv.id }, data: { channelId: channel.id } })
            }
            await this.prisma.message.create({ data: { conversationId: convId, role: 'ASSISTANT', content: message } })
          }).catch(() => {})
        }

        this.crm.upsertLeadCard({
          phone, name: lead.nome, automationId, automationName,
          targetStage: 'Novo Lead',
          note: `Mensagem enviada (etapa ${stepNum})`,
          followupStep: stepNum,
        }).catch(() => {})

        sent++

        // Delay anti-ban aleatório (usa config da automação ou padrão 80–160s)
        const dMin = dispatchDelayMinMs ?? 80_000
        const dMax = dispatchDelayMaxMs ?? 160_000
        await this.sleep(dMin + Math.random() * (Math.max(dMax, dMin) - dMin))
      } catch (err) {
        if (err instanceof PhoneNotOnWhatsAppError) {
          // Número não tem WhatsApp — marca lead para não retentar
          this.logger.debug(`[sem_whatsapp] ${phone} — marcando lead e pulando`)
          this.prisma.leadManyInsta.update({
            where: { id: lead.id },
            data:  { status: 'sem_whatsapp', tentativasFollowup: { increment: 1 } },
          }).catch(() => {})
          this.prisma.automationDispatchLog.create({
            data: { automationId, phone, name: name || null, message, status: 'skipped', errorMsg: 'sem_whatsapp', channelId: channel.id, channelName: channel.name, step: stepNum },
          }).catch(() => {})
          skipped++
        } else {
          this.logger.warn(`Falha ao enviar para ${phone}: ${err}`)
          this.prisma.automationDispatchLog.create({
            data: { automationId, phone, name: name || null, message, status: 'error', errorMsg: String(err), channelId: channel.id, channelName: channel.name, step: stepNum },
          }).catch(() => {})
          errors++
        }
      }
    }

    return { sent, errors, skipped }
  }

  private isWithinBusinessHours(now: Date, startHour: number, endHour: number): boolean {
    const brtOffsetMs = -3 * 60 * 60 * 1000
    const brtMs       = now.getTime() + now.getTimezoneOffset() * 60 * 1000 + brtOffsetMs
    const brtHour     = new Date(brtMs).getHours()
    return brtHour >= startHour && brtHour < endHour
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
