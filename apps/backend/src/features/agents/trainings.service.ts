/**
 * TrainingsService — CRUD de treinamentos do agente (base de conhecimento)
 *
 * Os treinamentos são concatenados no system prompt antes de chamar a IA.
 * Tipos suportados: text, url, document
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

@Injectable()
export class TrainingsService {
  private readonly logger = new Logger(TrainingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async findByAgent(agentId: string) {
    return this.prisma.agentTraining.findMany({
      where:   { agentId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(agentId: string, dto: { type: string; title?: string; content: string }) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) throw new NotFoundException('Agente não encontrado')

    return this.prisma.agentTraining.create({
      data: {
        agentId,
        type:    dto.type,
        title:   dto.title ?? null,
        content: dto.content,
        status:  'ready',
        metadata: { charCount: dto.content.length },
      },
    })
  }

  async remove(agentId: string, trainingId: string) {
    const training = await this.prisma.agentTraining.findFirst({
      where: { id: trainingId, agentId },
    })
    if (!training) throw new NotFoundException('Treinamento não encontrado')
    await this.prisma.agentTraining.delete({ where: { id: trainingId } })
  }

  /**
   * Retorna todos os treinamentos concatenados como contexto para o system prompt.
   * Usado pelo AiEngineService antes de chamar a IA.
   */
  async getTrainingContext(agentId: string): Promise<string> {
    const trainings = await this.prisma.agentTraining.findMany({
      where:   { agentId, status: 'ready' },
      orderBy: { createdAt: 'asc' },
      select:  { type: true, title: true, content: true },
    })

    if (trainings.length === 0) return ''

    return trainings
      .map((t) => {
        const header = t.title ? `[${t.type.toUpperCase()}: ${t.title}]` : `[${t.type.toUpperCase()}]`
        return `${header}\n${t.content}`
      })
      .join('\n\n---\n\n')
  }
}
