/**
 * FollowUpService — Gerencia regras de follow-up e cron de disparo
 *
 * Cron roda a cada 10 minutos. O disparo segue uma FILA POR ESTÁGIO (anti-ban):
 *
 *   inicial → FU1 → FU2 → FU3   (um estágio de cada vez, na ordem)
 *
 * Só avança para o próximo estágio quando o anterior termina para a lista TODA.
 * Assim a 1ª mensagem alcança todos antes de qualquer follow-up, e o FU2 não
 * compete com o FU1. O `triggerAfterMinutes` deixa de ser um gatilho por horário
 * e vira apenas um PISO (espaçamento mínimo: "não cutuca antes de X").
 *
 * Tudo divide o mesmo teto diário por número (aplicado no dispatch.processor),
 * então reordenar os estágios não aumenta o volume — só o torna previsível.
 *
 * status = triggerOnStatus (padrão: SENT) define quem ainda está elegível
 * (lead que respondeu muda de status e sai do funil de follow-up).
 *
 * Após o último follow-up configurado sem resposta, move o lead para SEM_INTERESSE.
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

  private async validateCampaignOwnership(campaignId: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } })
    if (!campaign) throw new NotFoundException('Campanha não encontrada')
    return campaign
  }

  async createWithTemplate(campaignId: string, dto: CreateFollowUpWithTemplateDto, tenantId?: string) {
    if (tenantId) await this.validateCampaignOwnership(campaignId, tenantId)
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

  async deleteByOrder(campaignId: string, order: number, tenantId?: string) {
    if (tenantId) await this.validateCampaignOwnership(campaignId, tenantId)
    const template = await this.prisma.campaignTemplate.findFirst({
      where: { campaignId, type: 'FOLLOW_UP', order },
    })
    if (!template) throw new NotFoundException('Follow-up não encontrado')
    await this.prisma.campaignTemplate.delete({ where: { id: template.id } })
  }

  async findByCampaign(campaignId: string, tenantId?: string) {
    if (tenantId) await this.validateCampaignOwnership(campaignId, tenantId)
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

    // Agrupa as regras ativas por campanha — cada campanha tem sua própria
    // fila de estágios (FU1/FU2/FU3) e é processada de forma independente.
    const byCampaign = new Map<string, typeof rules>()
    for (const rule of rules) {
      const campaign = rule.template?.campaign
      if (!campaign || campaign.status !== 'RUNNING' || !campaign.channelId) continue
      const bucket = byCampaign.get(campaign.id)
      if (bucket) bucket.push(rule)
      else byCampaign.set(campaign.id, [rule])
    }

    for (const campaignRules of byCampaign.values()) {
      // campaignRules[0] sempre existe — a chave do mapa só nasce com ≥1 regra.
      const campaign = campaignRules[0].template!.campaign!
      try {
        // Mapa estágio→regra + estágio→gatilho + maior estágio (limitado a MAX_FOLLOW_UPS).
        const stageRules     = new Map<number, (typeof campaignRules)[number]>()
        const triggerByStage = new Map<number, string>()
        let maxOrder = 0
        for (const r of campaignRules) {
          const order = r.template?.order
          if (!order) continue
          stageRules.set(order, r)
          triggerByStage.set(order, String(r.triggerOnStatus))
          if (order > maxOrder) maxOrder = order
        }
        maxOrder = Math.min(maxOrder, MAX_FOLLOW_UPS)
        if (maxOrder === 0) continue

        // 1) Desistência: quem já recebeu o último follow-up e segue sem responder
        //    (após o piso de carência do último estágio) → SEM_INTERESSE.
        const lastRule = stageRules.get(maxOrder)
        if (lastRule) {
          const graceCutoff = new Date(Date.now() - lastRule.triggerAfterMinutes * 60_000)
          const gaveUp = await this.prisma.campaignLead.updateMany({
            where: {
              campaignId:    campaign.id,
              followUpCount: { gte: maxOrder },
              status:        lastRule.triggerOnStatus as any,
              kanbanColumn:  { not: 'SEM_INTERESSE' },
              lastMessageAt: { lt: graceCutoff },
            },
            data: { kanbanColumn: 'SEM_INTERESSE' },
          })
          if (gaveUp.count > 0) {
            this.logger.log(
              `Campanha ${campaign.id}: ${gaveUp.count} lead(s) → SEM_INTERESSE após ${maxOrder} follow-up(s) sem resposta`,
            )
          }
        }

        // 2) Estágio ativo da fila. 0 = inicial ainda em andamento → adia tudo.
        const activeStage = await this.resolveActiveStage(campaign.id, triggerByStage, maxOrder)
        if (activeStage === 0) {
          this.logger.debug(`Campanha ${campaign.id}: disparo inicial em andamento — follow-ups adiados`)
          continue
        }
        if (activeStage > maxOrder) continue // todos os estágios concluídos

        const rule = stageRules.get(activeStage)
        if (!rule) continue // estágio em voo sem regra (raro) — aguarda drenar

        // 3) Dispara SÓ o estágio ativo. triggerAfterMinutes é apenas o PISO
        //    (espaçamento mínimo desde a última mensagem do lead).
        const cutoff = new Date(Date.now() - rule.triggerAfterMinutes * 60_000)
        const leads = await this.prisma.campaignLead.findMany({
          where: {
            campaignId:    campaign.id,
            status:        rule.triggerOnStatus as any,
            followUpCount: activeStage - 1, // recebeu a mensagem do estágio anterior
            lastMessageAt: { lt: cutoff },
            nextActionAt:  null,
          },
          select: { id: true, followUpCount: true },
          take:   500,
        })

        if (leads.length === 0) continue

        this.logger.log(`Follow-up: campanha ${campaign.id}, estágio FU${activeStage} — ${leads.length} lead(s) elegíveis`)

        await this.dispatch.enqueueFollowUp({
          leads,
          templateId:  rule.templateId,
          channelId:   campaign.channelId!,
          delayMinSec: campaign.delayMinSec,
          delayMaxSec: campaign.delayMaxSec,
        })

        await this.prisma.campaignLead.updateMany({
          where: { id: { in: leads.map((l) => l.id) } },
          data:  { followUpCount: { increment: 1 } },
        })
      } catch (err) {
        this.logger.error(`Falha ao processar follow-ups da campanha ${campaign.id}: ${(err as Error).message}`)
      }
    }
  }

  /**
   * Resolve o estágio ativo da fila por estágio:
   *   0          → disparo inicial ainda pendente/em voo (adia todos os FUs)
   *   1..maxOrder → primeiro estágio que ainda tem trabalho (deve o FU ou está em voo)
   *   maxOrder+1 → todos os estágios concluídos
   *
   * Um estágio "tem trabalho" enquanto algum lead ainda deve aquele follow-up
   * (mesmo que o piso de tempo ainda não tenha vencido) ou está em voo para ele.
   * Isso garante que o FU(n) só começa quando o FU(n-1) termina para a lista toda.
   */
  private async resolveActiveStage(
    campaignId:     string,
    triggerByStage: Map<number, string>,
    maxOrder:       number,
  ): Promise<number> {
    // Estágio 0: algum lead ainda aguarda ou está em voo da 1ª mensagem.
    const initialPending = await this.prisma.campaignLead.count({
      where: { campaignId, status: { in: ['PENDING', 'QUEUED'] }, followUpCount: 0 },
    })
    if (initialPending > 0) return 0

    for (let stage = 1; stage <= maxOrder; stage++) {
      // Em voo: já enfileirado para o FU(stage), aguardando o envio efetivo.
      const inFlight = await this.prisma.campaignLead.count({
        where: { campaignId, status: { in: ['PENDING', 'QUEUED'] }, followUpCount: stage },
      })
      if (inFlight > 0) return stage

      // Deve o FU(stage): recebeu a mensagem anterior e continua elegível.
      const trigger = triggerByStage.get(stage)
      if (trigger) {
        const owes = await this.prisma.campaignLead.count({
          where: {
            campaignId,
            status:        trigger as any,
            followUpCount: stage - 1,
            kanbanColumn:  { not: 'SEM_INTERESSE' },
          },
        })
        if (owes > 0) return stage
      }
    }

    return maxOrder + 1
  }
}
