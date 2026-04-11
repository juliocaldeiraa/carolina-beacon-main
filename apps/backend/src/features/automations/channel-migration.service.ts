/**
 * ChannelMigrationService — Migra conversas ativas quando o canal principal cai.
 *
 * Executado a cada 5 minutos via @Interval.
 * Para cada automação ATIVA com fallback configurado:
 *   1. Verifica se o canal primário está DISCONNECTED/BLOCKED
 *   2. Resolve próximo canal disponível via ChannelResolverService
 *   3. Encontra leads com conversas ativas (última interação < 24h)
 *   4. Envia mensagem de recuperação pelo novo canal
 *   5. Registra log da migração
 *
 * IMPORTANTE: NUNCA deleta dados de lead_many_insta.
 */

import { Injectable, Logger } from '@nestjs/common'
import { Interval }           from '@nestjs/schedule'
import { PrismaService }      from '@/infrastructure/database/prisma/prisma.service'
import { ChannelSendService } from '@/infrastructure/channel-send/channel-send.service'
import { ChannelResolverService } from './channel-resolver.service'
import type { Automation }    from '@/core/entities/Automation'
import type { Channel, ChannelType, ChannelConfig } from '@/core/entities/Channel'

const MIGRATION_MARKER = '[CANAL_MIGRADO]'
const ACTIVE_WINDOW_HOURS = 24

@Injectable()
export class ChannelMigrationService {
  private readonly logger = new Logger(ChannelMigrationService.name)

  constructor(
    private readonly prisma:          PrismaService,
    private readonly channelSend:     ChannelSendService,
    private readonly channelResolver: ChannelResolverService,
  ) {}

  @Interval(5 * 60 * 1000) // A cada 5 minutos
  async runChannelMigration(): Promise<void> {
    try {
      const automations = await this.prisma.automation.findMany({
        where: { status: 'ACTIVE' },
      })

      for (const row of automations) {
        const automation: Automation = {
          id:                   row.id,
          tenantId:             row.tenantId,
          name:                 row.name,
          status:               row.status as 'ACTIVE' | 'INACTIVE',
          sourceTable:          row.sourceTable,
          filterStatus:         row.filterStatus,
          minHoursAfterCapture: row.minHoursAfterCapture,
          channelId:            row.channelId,
          primaryChannelId:     (row as any).primaryChannelId ?? null,
          fallbackChannelIds:   Array.isArray((row as any).fallbackChannelIds) ? (row as any).fallbackChannelIds : [],
          messageTemplates:     Array.isArray(row.messageTemplates) ? (row.messageTemplates as string[]) : [],
          messageTemplate:      row.messageTemplate,
          followupSteps:        Array.isArray((row as any).followupSteps) ? (row as any).followupSteps : [],
          linkedAgentId:        row.linkedAgentId,
          aiPrompt:             row.aiPrompt,
          startHour:            row.startHour,
          endHour:              row.endHour,
          batchIntervalMinMinutes: row.batchIntervalMinMinutes,
          batchIntervalMaxMinutes: row.batchIntervalMaxMinutes,
          batchIntervalHours:   row.batchIntervalHours,
          batchSizeMin:         row.batchSizeMin,
          batchSizeMax:         row.batchSizeMax,
          batchSize:            row.batchSize,
          testPhones:           Array.isArray((row as any).testPhones) ? (row as any).testPhones : [],
          aiChannelId:          row.aiChannelId,
          aiModel:              row.aiModel,
          debounceMs:            (row as any).debounceMs          ?? null,
          sendDelayMs:           (row as any).sendDelayMs         ?? null,
          fragmentDelayMs:       (row as any).fragmentDelayMs     ?? null,
          useExclusionList:      (row as any).useExclusionList    ?? false,
          exclusionFilterStatus: (row as any).exclusionFilterStatus ?? null,
          humanHandoffEnabled:   (row as any).humanHandoffEnabled  ?? false,
          humanHandoffPhone:     (row as any).humanHandoffPhone    ?? null,
          humanHandoffMessage:   (row as any).humanHandoffMessage  ?? null,
          dispatchDelayMinMs:    (row as any).dispatchDelayMinMs   ?? null,
          dispatchDelayMaxMs:    (row as any).dispatchDelayMaxMs   ?? null,
          lastBatchAt:          row.lastBatchAt,
          totalSent:            row.totalSent,
          totalReplied:         row.totalReplied,
          totalConverted:       row.totalConverted,
          createdAt:            row.createdAt,
          updatedAt:            row.updatedAt,
        }

        // Só migra se tiver fallback configurado
        const hasFallback = automation.fallbackChannelIds.length > 0
        if (!hasFallback) continue

        await this.processMigration(automation)
      }
    } catch (err) {
      this.logger.error('Erro no ciclo de migração de canais', err)
    }
  }

  private async processMigration(automation: Automation): Promise<void> {
    const primaryId = automation.primaryChannelId ?? automation.channelId
    if (!primaryId) return

    // Verifica se o canal primário está fora do ar
    const primary = await this.channelResolver.loadChannel(primaryId)
    if (!primary || primary.status === 'CONNECTED') return

    this.logger.warn(`Automação "${automation.name}": canal primário ${primary.name} está ${primary.status}`)

    // Resolve o melhor fallback disponível
    const fallback = await this.channelResolver.resolveForAutomation(automation)
    if (!fallback) {
      this.logger.warn(`Automação "${automation.name}": nenhum canal de fallback disponível`)
      return
    }

    this.logger.log(`Automação "${automation.name}": migrando para canal "${fallback.name}"`)

    // Busca leads ativos nas últimas ACTIVE_WINDOW_HOURS horas com histórico de conversa
    const cutoff = new Date(Date.now() - ACTIVE_WINDOW_HOURS * 60 * 60 * 1000)
    const leads  = await this.prisma.leadManyInsta.findMany({
      where: {
        updatedAt: { gte: cutoff },
        status:    { notIn: ['conversa_encerrada', 'converteu', 'opt_out'] },
        // Só leads que realmente tiveram interação (histórico não vazio)
        NOT: { historicoCId: { equals: [] } },
      },
    })

    if (leads.length === 0) return

    let migrated = 0
    for (const lead of leads) {
      const phone = lead.whatsappLimpo ?? lead.whatsapp
      const name  = lead.nome ?? ''

      // Verifica se já foi migrado recentemente (marcador no histórico)
      const historico = Array.isArray(lead.historicoCId) ? (lead.historicoCId as any[]) : []
      const alreadyMigrated = historico.some(
        (h: any) => typeof h.content === 'string' && h.content.includes(MIGRATION_MARKER)
      )
      if (alreadyMigrated) continue

      const recoveryMsg = `Oi ${name}, houve uma instabilidade técnica, mas estou aqui! Podemos continuar? 😊`

      try {
        await this.channelSend.send(fallback, phone, recoveryMsg)

        // Adiciona nota de migração ao histórico (não polui contexto da IA)
        const updatedHistorico = [
          ...historico,
          {
            role:      'system',
            content:   `${MIGRATION_MARKER} Conversa migrada do canal ${primary.name} para ${fallback.name}. Continue normalmente.`,
            timestamp: new Date().toISOString(),
          },
        ]

        await this.prisma.leadManyInsta.update({
          where: { id: lead.id },
          data:  { historicoCId: updatedHistorico },
        })

        migrated++
        await this.sleep(2000 + Math.random() * 3000) // anti-ban entre migrações
      } catch (err) {
        this.logger.warn(`Migração falhou para ${phone}: ${err}`)
      }
    }

    if (migrated > 0) {
      this.logger.log(`Automação "${automation.name}": ${migrated} leads migrados para canal "${fallback.name}"`)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
