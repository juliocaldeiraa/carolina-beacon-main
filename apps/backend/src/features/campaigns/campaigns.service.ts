/**
 * CampaignsService — CRUD de campanhas de disparo (multi-tenant)
 *
 * Regras de negócio:
 * - delay_min_sec deve ser >= 120 (2 minutos) — enforçado aqui + CHECK constraint no banco
 * - O lançamento da campanha (launch) delega ao DispatchService para enfileirar leads no BullMQ
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { DispatchService } from '@/features/dispatch/dispatch.service'

const MIN_DELAY_SEC = 120

export interface ScheduleConfig {
  scheduleEnabled?:   boolean
  scheduleStartHour?: number
  scheduleEndHour?:   number
  scheduleDays?:      number[]
  scheduleTimezone?:  string
}

export interface CreateCampaignDto extends ScheduleConfig {
  name:         string
  channelId?:   string
  agentId?:     string | null
  delayMinSec?: number
  delayMaxSec?: number
  rotationMode?: 'RANDOM' | 'SEQUENTIAL'
  scheduledAt?:  string
  varLabels?:    string[]
  initialVariations: string[][]
}

export interface UpdateCampaignDto extends ScheduleConfig {
  name?:         string
  channelId?:    string
  agentId?:      string | null
  delayMinSec?:  number
  delayMaxSec?:  number
  rotationMode?: 'RANDOM' | 'SEQUENTIAL'
  scheduledAt?:  string
  varLabels?:    string[]
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DispatchService))
    private readonly dispatch: DispatchService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.campaign.findMany({
      where:   { tenantId },
      include: {
        templates: { orderBy: { order: 'asc' } },
        _count:    { select: { leads: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where:   { id, tenantId },
      include: {
        templates: {
          include:  { followUpRule: true },
          orderBy:  { order: 'asc' },
        },
        _count: { select: { leads: true } },
      },
    })
    if (!campaign) throw new NotFoundException('Campanha não encontrada')
    return campaign
  }

  async create(dto: CreateCampaignDto, tenantId: string) {
    const delayMin = dto.delayMinSec ?? MIN_DELAY_SEC
    const delayMax = dto.delayMaxSec ?? Math.max(180, delayMin + 60)

    if (delayMin < MIN_DELAY_SEC) {
      throw new BadRequestException(`delay_min_sec deve ser >= ${MIN_DELAY_SEC} segundos (2 minutos)`)
    }
    if (delayMax < delayMin) {
      throw new BadRequestException('delay_max_sec deve ser >= delay_min_sec')
    }
    if (
      !dto.initialVariations?.length ||
      !dto.initialVariations.some((parts) => Array.isArray(parts) && parts.some((p) => p?.trim()))
    ) {
      throw new BadRequestException('A campanha precisa de ao menos uma variação de mensagem')
    }

    return this.prisma.campaign.create({
      data: {
        tenantId,
        channelId:        dto.channelId,
        agentId:          dto.agentId ?? null,
        name:             dto.name,
        delayMinSec:      delayMin,
        delayMaxSec:      delayMax,
        rotationMode:     dto.rotationMode ?? 'RANDOM',
        varLabels:        dto.varLabels ?? [],
        scheduledAt:      dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        scheduleEnabled:  dto.scheduleEnabled ?? false,
        scheduleStartHour: dto.scheduleStartHour ?? 8,
        scheduleEndHour:  dto.scheduleEndHour ?? 18,
        scheduleDays:     dto.scheduleDays ?? [1,2,3,4,5],
        scheduleTimezone: dto.scheduleTimezone ?? 'America/Sao_Paulo',
        templates: {
          create: {
            type:       'INITIAL',
            variations: dto.initialVariations,
            order:      0,
          },
        },
      },
      include: {
        templates: true,
        _count:    { select: { leads: true } },
      },
    })
  }

  async update(id: string, dto: UpdateCampaignDto, tenantId: string) {
    const campaign = await this.findById(id, tenantId)

    if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
      throw new BadRequestException('Apenas campanhas em DRAFT ou PAUSED podem ser editadas')
    }

    const delayMin = dto.delayMinSec ?? campaign.delayMinSec
    const delayMax = dto.delayMaxSec ?? campaign.delayMaxSec

    if (delayMin < MIN_DELAY_SEC) {
      throw new BadRequestException(`delay_min_sec deve ser >= ${MIN_DELAY_SEC} segundos`)
    }
    if (delayMax < delayMin) {
      throw new BadRequestException('delay_max_sec deve ser >= delay_min_sec')
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        name:         dto.name,
        channelId:    dto.channelId,
        ...(dto.agentId !== undefined ? { agentId: dto.agentId } : {}),
        delayMinSec:  delayMin,
        delayMaxSec:  delayMax,
        rotationMode: dto.rotationMode,
        scheduledAt:  dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        ...(dto.varLabels !== undefined ? { varLabels: dto.varLabels } : {}),
        ...(dto.scheduleEnabled  !== undefined ? { scheduleEnabled:   dto.scheduleEnabled  } : {}),
        ...(dto.scheduleStartHour !== undefined ? { scheduleStartHour: dto.scheduleStartHour } : {}),
        ...(dto.scheduleEndHour  !== undefined ? { scheduleEndHour:   dto.scheduleEndHour  } : {}),
        ...(dto.scheduleDays     !== undefined ? { scheduleDays:      dto.scheduleDays     } : {}),
        ...(dto.scheduleTimezone !== undefined ? { scheduleTimezone:  dto.scheduleTimezone } : {}),
      },
    })
  }

  async launch(id: string, tenantId: string) {
    const campaign = await this.findById(id, tenantId)

    if (!campaign.channelId) {
      throw new BadRequestException('A campanha precisa ter uma instância WhatsApp configurada antes de lançar')
    }
    if (campaign.status === 'RUNNING') {
      throw new BadRequestException('Campanha já está em execução')
    }
    if (campaign.status === 'COMPLETED') {
      throw new BadRequestException('Campanha já foi concluída')
    }

    const pendingCount = await this.prisma.campaignLead.count({
      where: { campaignId: id, status: 'PENDING' },
    })
    if (pendingCount === 0) {
      throw new BadRequestException('Nenhum lead pendente para disparar. Importe contatos antes de lançar.')
    }

    await this.prisma.campaign.update({
      where: { id },
      data:  { status: 'RUNNING' },
    })

    await this.dispatch.enqueueCampaign(campaign as any)

    return this.findById(id, tenantId)
  }

  async pause(id: string, tenantId: string) {
    const campaign = await this.findById(id, tenantId)
    if (campaign.status !== 'RUNNING') {
      throw new BadRequestException('Apenas campanhas RUNNING podem ser pausadas')
    }
    return this.prisma.campaign.update({
      where: { id },
      data:  { status: 'PAUSED' },
    })
  }

  async resume(id: string, tenantId: string) {
    const campaign = await this.findById(id, tenantId)
    if (campaign.status !== 'PAUSED') {
      throw new BadRequestException('Apenas campanhas PAUSED podem ser retomadas')
    }

    await this.prisma.campaign.update({
      where: { id },
      data:  { status: 'RUNNING' },
    })

    await this.dispatch.enqueueCampaign(campaign as any)

    return this.findById(id, tenantId)
  }

  async remove(id: string, tenantId: string) {
    const campaign = await this.findById(id, tenantId)
    if (campaign.status === 'RUNNING') {
      throw new BadRequestException('Pare a campanha antes de excluir')
    }
    await this.prisma.campaign.delete({ where: { id } })
  }

  async updateStats(id: string, delta: { sentCount?: number; errorCount?: number }) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(delta.sentCount  != null ? { sentCount:  { increment: delta.sentCount  } } : {}),
        ...(delta.errorCount != null ? { errorCount: { increment: delta.errorCount } } : {}),
      },
    })
  }

  async markCompleted(id: string) {
    return this.prisma.campaign.update({
      where: { id },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })
  }

  async markFailed(id: string) {
    return this.prisma.campaign.update({
      where: { id },
      data:  { status: 'FAILED' },
    })
  }

  async retryErrors(id: string, tenantId: string) {
    const campaign = await this.findById(id, tenantId)

    if (!campaign.channelId) {
      throw new BadRequestException('Configure uma instância WhatsApp antes de redisparar')
    }

    const errorLeads = await this.prisma.campaignLead.count({
      where: { campaignId: id, status: 'ERROR' },
    })
    if (errorLeads === 0) {
      throw new BadRequestException('Nenhum lead com erro para redisparar')
    }

    await this.prisma.campaignLead.updateMany({
      where: { campaignId: id, status: 'ERROR' },
      data:  { status: 'PENDING', kanbanColumn: 'MENSAGEM_ENVIADA' },
    })

    await this.prisma.campaign.update({
      where: { id },
      data:  { status: 'RUNNING', errorCount: { decrement: errorLeads } },
    })

    await this.dispatch.enqueueCampaign(campaign as any)

    return { retriedCount: errorLeads }
  }

  async updateInitialTemplate(id: string, variations: string[][], tenantId: string) {
    const campaign = await this.findById(id, tenantId)
    if (campaign.status === 'RUNNING') {
      throw new BadRequestException('Pause a campanha antes de editar as mensagens')
    }
    if (!variations?.length || !variations.some((p) => Array.isArray(p) && p.some((t) => t?.trim()))) {
      throw new BadRequestException('Precisa de ao menos uma variação com texto')
    }
    const template = campaign.templates.find((t) => t.order === 0)
    if (!template) throw new BadRequestException('Template inicial não encontrado')
    return this.prisma.campaignTemplate.update({
      where: { id: template.id },
      data:  { variations },
    })
  }

  async getFunnel(tenantId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where:   { tenantId },
      select:  { id: true, name: true, status: true, totalLeads: true },
      orderBy: { createdAt: 'desc' },
    })

    const COLUMNS = ['MENSAGEM_ENVIADA', 'RESPONDEU', 'EM_CONTATO', 'AGENDADO', 'CONVERTIDO']

    const result = await Promise.all(
      campaigns.map(async (c) => {
        const counts = await this.prisma.campaignLead.groupBy({
          by:    ['kanbanColumn'],
          where: { campaignId: c.id },
          _count: true,
        })

        const columns: Record<string, number> = {}
        for (const col of COLUMNS) columns[col] = 0
        for (const row of counts) {
          columns[row.kanbanColumn] = (columns[row.kanbanColumn] ?? 0) + row._count
        }

        const conversionAgg = await this.prisma.campaignLead.aggregate({
          where: { campaignId: c.id, kanbanColumn: 'CONVERTIDO', conversionValue: { not: null } },
          _sum:  { conversionValue: true },
          _count: true,
        })

        return {
          id:              c.id,
          name:            c.name,
          status:          c.status,
          total:           c.totalLeads,
          columns,
          conversionCount: conversionAgg._count,
          conversionTotal: Number(conversionAgg._sum.conversionValue ?? 0),
        }
      }),
    )

    return result.filter((c) => c.total > 0)
  }

  async duplicate(id: string, tenantId: string) {
    const source = await this.prisma.campaign.findFirst({
      where:   { id, tenantId },
      include: {
        templates: {
          include:  { followUpRule: true },
          orderBy:  { order: 'asc' },
        },
      },
    })
    if (!source) throw new NotFoundException('Campanha não encontrada')

    return this.prisma.campaign.create({
      data: {
        tenantId,
        channelId:        source.channelId,
        name:             `Cópia de ${source.name}`,
        delayMinSec:      source.delayMinSec,
        delayMaxSec:      source.delayMaxSec,
        rotationMode:     source.rotationMode,
        varLabels:        source.varLabels ?? [],
        scheduleEnabled:  source.scheduleEnabled,
        scheduleStartHour: source.scheduleStartHour,
        scheduleEndHour:  source.scheduleEndHour,
        scheduleDays:     source.scheduleDays ?? [1,2,3,4,5],
        scheduleTimezone: source.scheduleTimezone,
        templates: {
          create: source.templates.map((t) => ({
            type:       t.type,
            variations: t.variations as any,
            order:      t.order,
            ...(t.followUpRule ? {
              followUpRule: {
                create: {
                  triggerAfterMinutes: t.followUpRule.triggerAfterMinutes,
                  triggerOnStatus:     t.followUpRule.triggerOnStatus,
                  isActive:            t.followUpRule.isActive,
                },
              },
            } : {}),
          })),
        },
      },
      include: {
        templates: true,
        _count:    { select: { leads: true } },
      },
    })
  }
}
