import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  IAgentRepository,
  CreateAgentDto,
  UpdateAgentDto,
} from '../../../core/repositories/IAgentRepository'
import { Agent, AgentType } from '../../../core/entities/Agent'

@Injectable()
export class AgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  async findAll(type?: AgentType): Promise<Agent[]> {
    const rows = await this.prisma.agent.findMany({
      where: {
        tenantId:  this.tenantId,
        deletedAt: null,
        ...(type && { agentType: type }),
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(this.toEntity)
  }

  async findById(id: string): Promise<Agent | null> {
    const row = await this.prisma.agent.findFirst({
      where: { id, tenantId: this.tenantId, deletedAt: null },
    })
    return row ? this.toEntity(row) : null
  }

  async create(data: CreateAgentDto): Promise<Agent> {
    const row = await this.prisma.agent.create({
      data: {
        tenantId:        this.tenantId,
        name:            data.name,
        description:     data.description,
        model:           data.model,
        agentType:       data.agentType       ?? 'PASSIVO',
        systemPrompt:    data.systemPrompt,
        personality:     data.personality,
        actionPrompt:    data.actionPrompt,
        temperature:     data.temperature     ?? 0.6,
        maxTokens:       data.maxTokens       ?? 300,
        limitTurns:      data.limitTurns      ?? false,
        maxTurns:        data.maxTurns        ?? 8,
        fallbackEnabled: data.fallbackEnabled ?? true,
        fallbackMessage: data.fallbackMessage ?? 'Oi! Tive um probleminha técnico, já volto! 😊',
        tools:           data.tools           ?? [],
        historyLimit:    data.historyLimit     ?? 20,
        status:          'ACTIVE',
        channelId:       data.channelId,
      },
    })
    return this.toEntity(row)
  }

  async update(id: string, data: UpdateAgentDto): Promise<Agent> {
    const row = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(data.name            !== undefined && { name:            data.name }),
        ...(data.description     !== undefined && { description:     data.description }),
        ...(data.model           !== undefined && { model:           data.model }),
        ...(data.agentType       !== undefined && { agentType:       data.agentType }),
        ...(data.systemPrompt    !== undefined && { systemPrompt:    data.systemPrompt }),
        ...(data.personality     !== undefined && { personality:     data.personality }),
        ...(data.actionPrompt    !== undefined && { actionPrompt:    data.actionPrompt }),
        ...(data.temperature     !== undefined && { temperature:     data.temperature }),
        ...(data.maxTokens       !== undefined && { maxTokens:       data.maxTokens }),
        ...(data.limitTurns      !== undefined && { limitTurns:      data.limitTurns }),
        ...(data.maxTurns        !== undefined && { maxTurns:        data.maxTurns }),
        ...(data.fallbackEnabled !== undefined && { fallbackEnabled: data.fallbackEnabled }),
        ...(data.fallbackMessage !== undefined && { fallbackMessage: data.fallbackMessage }),
        ...(data.tools           !== undefined && { tools:           data.tools }),
        ...(data.channelId       !== undefined && { channelId:       data.channelId }),
        ...(data.historyLimit    !== undefined && { historyLimit:    data.historyLimit }),
      },
    })
    return this.toEntity(row)
  }

  async updateStatus(id: string, status: Agent['status']): Promise<Agent> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Agent not found')
    const row = await this.prisma.agent.update({ where: { id }, data: { status } })
    return this.toEntity(row)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Agent not found')
    await this.prisma.agent.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    })
  }

  private toEntity(row: {
    id: string; tenantId: string; name: string; description: string | null
    model: string; status: string; agentType: string; systemPrompt: string | null; tools: unknown
    personality: string | null; actionPrompt: string | null
    temperature: number; maxTokens: number
    limitTurns: boolean; maxTurns: number
    fallbackEnabled: boolean; fallbackMessage: string | null
    channelId: string | null; historyLimit: number
    createdAt: Date; updatedAt: Date; deletedAt: Date | null
  }): Agent {
    return {
      id:              row.id,
      tenantId:        row.tenantId,
      name:            row.name,
      description:     row.description     ?? undefined,
      model:           row.model,
      status:          row.status          as Agent['status'],
      agentType:       (row.agentType      as AgentType) ?? 'PASSIVO',
      systemPrompt:    row.systemPrompt    ?? undefined,
      personality:     row.personality     ?? undefined,
      actionPrompt:    row.actionPrompt    ?? undefined,
      temperature:     row.temperature,
      maxTokens:       row.maxTokens,
      limitTurns:      row.limitTurns,
      maxTurns:        row.maxTurns,
      fallbackEnabled: row.fallbackEnabled,
      fallbackMessage: row.fallbackMessage ?? undefined,
      tools:           Array.isArray(row.tools) ? (row.tools as string[]) : undefined,
      channelId:       row.channelId       ?? undefined,
      historyLimit:    row.historyLimit,
      createdAt:       row.createdAt,
      updatedAt:       row.updatedAt,
      deletedAt:       row.deletedAt       ?? undefined,
    }
  }
}
