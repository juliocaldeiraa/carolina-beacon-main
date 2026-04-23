/**
 * ChannelResolverService — Resolve qual canal usar para uma automação.
 *
 * Lógica de fallback:
 *   1. Tenta primaryChannelId (novo campo canônico)
 *   2. Fallback para channelId legado
 *   3. Itera fallbackChannelIds em ordem de prioridade
 *   4. Retorna o primeiro canal com status CONNECTED
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService }      from '@/infrastructure/database/prisma/prisma.service'
import type { Automation }    from '@/core/entities/Automation'
import type { Channel, ChannelType, ChannelConfig } from '@/core/entities/Channel'

@Injectable()
export class ChannelResolverService {
  private readonly logger = new Logger(ChannelResolverService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve o melhor canal disponível (CONNECTED) para a automação.
   * Retorna null se nenhum canal estiver disponível.
   */
  async resolveForAutomation(automation: Automation): Promise<Channel | null> {
    // Ordem de prioridade: primaryChannelId → channelId (legado) → fallbackChannelIds
    const candidateIds = [
      automation.primaryChannelId,
      automation.channelId,
      ...automation.fallbackChannelIds,
    ].filter((id): id is string => !!id)

    // Remove duplicatas mantendo a ordem
    const uniqueIds = [...new Set(candidateIds)]

    for (const channelId of uniqueIds) {
      const channel = await this.loadChannel(channelId)
      if (channel && channel.status === 'CONNECTED') {
        return channel
      }
      if (channel && channel.status !== 'CONNECTED') {
        this.logger.debug(`Canal ${channelId} (${channel.name}) indisponível: ${channel.status}`)
      }
    }

    this.logger.warn(`Automação ${automation.id}: nenhum canal disponível (${uniqueIds.length} candidatos)`)
    return null
  }

  /**
   * Retorna todos os canais candidatos de uma automação com seus status.
   * Útil para o endpoint de teste e diagnóstico.
   */
  async listCandidates(automation: Automation): Promise<Array<{ id: string; name: string; status: string; isPrimary: boolean }>> {
    const primaryId = automation.primaryChannelId ?? automation.channelId

    const candidateIds = [
      automation.primaryChannelId,
      automation.channelId,
      ...automation.fallbackChannelIds,
    ].filter((id): id is string => !!id)

    const uniqueIds = [...new Set(candidateIds)]

    const results: Array<{ id: string; name: string; status: string; isPrimary: boolean }> = []
    for (const id of uniqueIds) {
      const ch = await this.loadChannel(id)
      if (ch) {
        results.push({ id: ch.id, name: ch.name, status: ch.status, isPrimary: id === primaryId })
      }
    }
    return results
  }

  async loadChannel(channelId: string): Promise<Channel | null> {
    const row = await this.prisma.channel.findUnique({ where: { id: channelId } })
    if (!row) return null
    return {
      id:           row.id,
      tenantId:     row.tenantId,
      name:         row.name,
      type:         row.type     as ChannelType,
      status:       row.status   as Channel['status'],
      phoneNumber:  row.phoneNumber ?? undefined,
      config:       (row.config ?? {}) as ChannelConfig,
      lastCheckedAt: row.lastCheckedAt ?? undefined,
      blockedAt:    row.blockedAt ?? undefined,
      createdAt:    row.createdAt,
      updatedAt:    row.updatedAt,
    }
  }
}
