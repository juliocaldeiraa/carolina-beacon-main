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

  findAll() {
    return this.repo.findAll()
  }

  async findById(id: string) {
    const channel = await this.repo.findById(id)
    if (!channel) throw new NotFoundException('Canal não encontrado')
    return channel
  }

  create(dto: CreateChannelDto) {
    return this.repo.create(dto)
  }

  async update(id: string, dto: UpdateChannelDto) {
    await this.findById(id)
    return this.repo.update(id, dto)
  }

  async remove(id: string) {
    await this.findById(id)
    return this.repo.remove(id)
  }

  /** Verifica status de um canal imediatamente (manual) */
  async checkStatus(id: string) {
    const channel = await this.findById(id)
    return this.poller.checkChannel(channel)
  }

  /**
   * Verifica conflitos de uso para uma lista de channelIds.
   * Retorna por canal: quais Chat IA configs estão ativas + quais automações ativas usam o canal.
   */
  async checkConflicts(channelIds: string[]): Promise<{ conflicts: ChannelConflictItem[] }> {
    if (!channelIds.length) return { conflicts: [] }

    const [channels, channelAgents, automations] = await Promise.all([
      this.prisma.channel.findMany({
        where:  { id: { in: channelIds } },
        select: { id: true, name: true },
      }),
      this.prisma.channelAgent.findMany({
        where:  { channelId: { in: channelIds }, isActive: true },
        select: { id: true, name: true, channelId: true, agentId: true },
      }),
      this.prisma.automation.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { channelId:        { in: channelIds } },
            { primaryChannelId: { in: channelIds } },
          ],
        },
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
