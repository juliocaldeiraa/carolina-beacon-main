import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import {
  IChannelRepository,
  CreateChannelDto,
  UpdateChannelDto,
  CHANNEL_REPOSITORY,
} from '@/core/repositories/IChannelRepository'
import { ChannelPollerService } from './channel-poller.service'
import { PrismaService }        from '@/infrastructure/database/prisma/prisma.service'

export interface ChannelConflictChatIa {
  id:        string
  name:      string
  agentName: string
}

export interface ChannelConflictAutomation {
  id:   string
  name: string
}

export interface ChannelConflictItem {
  channelId:   string
  channelName: string
  chatIa:      ChannelConflictChatIa[]
  automations: ChannelConflictAutomation[]
}

@Injectable()
export class ChannelsService {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly repo: IChannelRepository,
    private readonly poller:  ChannelPollerService,
    private readonly prisma:  PrismaService,
  ) {}

  findAll(tenantId?: string) {
    return this.repo.findAll(tenantId)
  }

  async findById(id: string, tenantId?: string) {
    const channel = await this.repo.findById(id, tenantId)
    if (!channel) throw new NotFoundException('Canal não encontrado')
    return channel
  }

  create(dto: CreateChannelDto, tenantId: string) {
    return this.repo.create(dto, tenantId)
  }

  async update(id: string, dto: UpdateChannelDto, tenantId?: string) {
    await this.findById(id, tenantId)
    return this.repo.update(id, dto, tenantId)
  }

  async remove(id: string, tenantId?: string) {
    await this.findById(id, tenantId)
    return this.repo.remove(id, tenantId)
  }

  /** Verifica status de um canal imediatamente (manual) */
  async checkStatus(id: string, tenantId?: string) {
    const channel = await this.findById(id, tenantId)
    return this.poller.checkChannel(channel)
  }

  /**
   * Verifica conflitos de uso para uma lista de channelIds.
   * Retorna por canal: quais Chat IA configs estão ativas + quais automações ativas usam o canal.
   * Escopada por tenantId — só considera canais/agents/automations desse tenant.
   */
  async checkConflicts(channelIds: string[], tenantId?: string): Promise<{ conflicts: ChannelConflictItem[] }> {
    if (!channelIds.length) return { conflicts: [] }

    const channelWhere = tenantId
      ? { id: { in: channelIds }, tenantId }
      : { id: { in: channelIds } }
    const channelAgentWhere = tenantId
      ? { channelId: { in: channelIds }, isActive: true, tenantId }
      : { channelId: { in: channelIds }, isActive: true }
    const automationWhere = tenantId
      ? {
          status: 'ACTIVE' as const,
          tenantId,
          OR: [
            { channelId:        { in: channelIds } },
            { primaryChannelId: { in: channelIds } },
          ],
        }
      : {
          status: 'ACTIVE' as const,
          OR: [
            { channelId:        { in: channelIds } },
            { primaryChannelId: { in: channelIds } },
          ],
        }

    const [channels, channelAgents, automations] = await Promise.all([
      this.prisma.channel.findMany({ where: channelWhere, select: { id: true, name: true } }),
      this.prisma.channelAgent.findMany({
        where:  channelAgentWhere,
        select: { id: true, name: true, channelId: true, agentId: true },
      }),
      this.prisma.automation.findMany({
        where:  automationWhere,
        select: { id: true, name: true, channelId: true, primaryChannelId: true },
      }),
    ])

    // Busca nomes dos agentes referenciados pelos channelAgents
    const agentIds = [...new Set(channelAgents.map((ca) => ca.agentId))]
    const agents   = agentIds.length
      ? await this.prisma.agent.findMany({
          where:  { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : []
    const agentMap = new Map(agents.map((a) => [a.id, a.name]))

    const conflicts: ChannelConflictItem[] = channelIds
      .map((channelId) => {
        const ch         = channels.find((c) => c.id === channelId)
        const chatIa     = channelAgents
          .filter((ca) => ca.channelId === channelId)
          .map((ca) => ({ id: ca.id, name: ca.name, agentName: agentMap.get(ca.agentId) ?? '—' }))
        const usedByAuto = automations
          .filter((a) => a.channelId === channelId || a.primaryChannelId === channelId)
          .map((a) => ({ id: a.id, name: a.name }))

        if (!chatIa.length && !usedByAuto.length) return null
        return {
          channelId,
          channelName: ch?.name ?? channelId,
          chatIa,
          automations: usedByAuto,
        }
      })
      .filter(Boolean) as ChannelConflictItem[]

    return { conflicts }
  }
}
