import { Injectable, NotFoundException } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import {
  IAgentRepository,
  CreateAgentDto,
  UpdateAgentDto,
  AGENT_REPOSITORY,
} from '../../core/repositories/IAgentRepository'
import { Agent, AgentType, buildSystemPrompt } from '../../core/entities/Agent'
import { AiEngineService } from '../../infrastructure/ai-engine/ai-engine.service'

@Injectable()
export class AgentsService {
  constructor(
    @Inject(AGENT_REPOSITORY) private readonly repo: IAgentRepository,
    private readonly aiEngine: AiEngineService,
  ) {}

  findAll(type?: AgentType, tenantId?: string): Promise<Agent[]> {
    return this.repo.findAll(type, tenantId)
  }

  async findById(id: string, tenantId?: string): Promise<Agent> {
    const agent = await this.repo.findById(id, tenantId)
    if (!agent) throw new NotFoundException(`Agente ${id} não encontrado`)
    return agent
  }

  create(dto: CreateAgentDto, tenantId?: string): Promise<Agent> {
    return this.repo.create(dto, tenantId)
  }

  async update(id: string, dto: UpdateAgentDto): Promise<Agent> {
    await this.findById(id)
    return this.repo.update(id, dto)
  }

  async updateStatus(id: string, status: Agent['status']): Promise<Agent> {
    await this.findById(id)
    return this.repo.updateStatus(id, status)
  }

  async remove(id: string): Promise<void> {
    await this.findById(id)
    return this.repo.softDelete(id)
  }

  async test(id: string, message: string): Promise<{ reply: string; inputTokens: number; outputTokens: number; latencyMs: number }> {
    const agent = await this.findById(id)
    const result = await this.aiEngine.complete({
      messages:    [{ role: 'user', content: message }],
      systemPrompt: buildSystemPrompt(agent),
      model:        agent.model,
      temperature:  agent.temperature,
      maxTokens:    agent.maxTokens,
    })
    return { reply: result.content, inputTokens: result.inputTokens, outputTokens: result.outputTokens, latencyMs: result.latencyMs }
  }
}
