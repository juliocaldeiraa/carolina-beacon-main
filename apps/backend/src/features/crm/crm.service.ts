import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service'

export interface CreateCardDto {
  pipelineId:   string
  title:        string
  contactName:  string
  contactPhone?: string
  stage:        string
  priority?:    string
  conversationId?: string
  notes?:       string
}

export interface UpdateCardDto {
  title?:         string
  contactName?:   string
  contactPhone?:  string
  stage?:         string
  priority?:      string
  conversationId?: string
  notes?:         string
  movedByAi?:     boolean
  aiNotes?:       string
  followupStep?:  number | null
}

export interface CreatePipelineDto {
  name:   string
  stages: string[]
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Pipelines ────────────────────────────────────────────

  async findAllPipelines() {
    return this.prisma.crmPipeline.findMany({
      orderBy: { createdAt: 'asc' },
    })
  }

  async findPipelineById(id: string) {
    const pipeline = await this.prisma.crmPipeline.findUnique({
      where: { id },
      include: {
        cards: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!pipeline) throw new NotFoundException('Pipeline não encontrado')
    return pipeline
  }

  async createPipeline(dto: CreatePipelineDto) {
    return this.prisma.crmPipeline.create({
      data: { name: dto.name, stages: dto.stages },
    })
  }

  // ─── Cards ────────────────────────────────────────────────

  async findAllCards(pipelineId?: string, stage?: string, search?: string) {
    const where: Record<string, unknown> = {}
    if (pipelineId) where['pipelineId'] = pipelineId
    if (stage)      where['stage']      = stage
    if (search) {
      where['OR'] = [
        { title:        { contains: search, mode: 'insensitive' } },
        { contactName:  { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search } },
      ]
    }
    return this.prisma.crmCard.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async createCard(dto: CreateCardDto) {
    // Validate stage exists in pipeline
    const pipeline = await this.prisma.crmPipeline.findUnique({ where: { id: dto.pipelineId } })
    if (!pipeline) throw new NotFoundException('Pipeline não encontrado')

    const stages = pipeline.stages as string[]
    if (!stages.includes(dto.stage)) {
      throw new BadRequestException(`Stage "${dto.stage}" não existe no pipeline`)
    }

    return this.prisma.crmCard.create({
      data: {
        pipelineId:    dto.pipelineId,
        title:         dto.title,
        contactName:   dto.contactName,
        contactPhone:  dto.contactPhone,
        stage:         dto.stage,
        priority:      dto.priority ?? 'NORMAL',
        conversationId: dto.conversationId,
        notes:         dto.notes,
      },
    })
  }

  async updateCard(id: string, dto: UpdateCardDto) {
    const card = await this.prisma.crmCard.findUnique({ where: { id } })
    if (!card) throw new NotFoundException('Card não encontrado')

    // Validate stage if being changed
    if (dto.stage) {
      const pipeline = await this.prisma.crmPipeline.findUnique({ where: { id: card.pipelineId } })
      const stages   = (pipeline?.stages as string[]) ?? []
      if (!stages.includes(dto.stage)) {
        throw new BadRequestException(`Stage "${dto.stage}" não existe no pipeline`)
      }
    }

    return this.prisma.crmCard.update({
      where: { id },
      data:  {
        ...(dto.title         !== undefined && { title: dto.title }),
        ...(dto.contactName   !== undefined && { contactName: dto.contactName }),
        ...(dto.contactPhone  !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.stage         !== undefined && { stage: dto.stage }),
        ...(dto.priority      !== undefined && { priority: dto.priority }),
        ...(dto.conversationId !== undefined && { conversationId: dto.conversationId }),
        ...(dto.notes         !== undefined && { notes: dto.notes }),
        ...(dto.movedByAi     !== undefined && { movedByAi: dto.movedByAi }),
        ...(dto.aiNotes       !== undefined && { aiNotes: dto.aiNotes }),
        ...(dto.followupStep  !== undefined && { followupStep: dto.followupStep }),
      },
    })
  }

  async removeCard(id: string) {
    const card = await this.prisma.crmCard.findUnique({ where: { id } })
    if (!card) throw new NotFoundException('Card não encontrado')
    await this.prisma.crmCard.delete({ where: { id } })
  }

  // ─── Integração Automações ─────────────────────────────────────────────────

  /** Cria ou avança um card para um lead na jornada de automação (fire-and-forget safe). */
  async upsertLeadCard(params: {
    phone:          string
    name:           string | null | undefined
    automationId:   string
    automationName: string
    targetStage:    string
    note?:          string
    followupStep?:  number
  }): Promise<void> {
    const pipeline = await this.prisma.crmPipeline.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!pipeline) return

    const stages = pipeline.stages as string[]
    if (!stages.includes(params.targetStage)) return

    const existing = await this.prisma.crmCard.findFirst({
      where: { pipelineId: pipeline.id, contactPhone: params.phone },
    })

    const targetIdx = stages.indexOf(params.targetStage)
    const aiNotes   = params.note ?? `Automação: ${params.automationName}`
    const title     = params.name ?? params.phone

    if (!existing) {
      await this.prisma.crmCard.create({
        data: {
          pipelineId:   pipeline.id,
          title,
          contactName:  title,
          contactPhone: params.phone,
          stage:        params.targetStage,
          priority:     'NORMAL',
          movedByAi:    true,
          aiNotes,
          ...(params.followupStep !== undefined && { followupStep: params.followupStep }),
        },
      })
    } else {
      const TERMINAL   = ['Fechado Ganho', 'Fechado Perdido']
      const currentIdx = stages.indexOf(existing.stage)
      const isTerminal = TERMINAL.includes(existing.stage)
      const shouldMove = !isTerminal && (targetIdx > currentIdx || TERMINAL.includes(params.targetStage))

      // Sempre atualiza followupStep quando for mais alto (maior etapa de follow-up)
      const followupChanged = params.followupStep !== undefined &&
        (existing.followupStep === null || params.followupStep > (existing.followupStep ?? 0))

      if (shouldMove || followupChanged) {
        await this.prisma.crmCard.update({
          where: { id: existing.id },
          data:  {
            ...(shouldMove && { stage: params.targetStage, movedByAi: true, aiNotes }),
            ...(followupChanged && { followupStep: params.followupStep }),
          },
        })
      }
    }
  }
}
