import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import type {
  IAutomationRepository,
  CreateAutomationDto,
  UpdateAutomationDto,
  CreateAutomationLogDto,
} from '@/core/repositories/IAutomationRepository'
import type { Automation, AutomationLog, AutomationStatus, FollowupStep } from '@/core/entities/Automation'

@Injectable()
export class AutomationRepository implements IAutomationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId?: string): Promise<Automation[]> {
    const rows = await this.prisma.automation.findMany({
      where:   tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(this.toEntity)
  }

  async findById(id: string, tenantId?: string): Promise<Automation | null> {
    const row = await this.prisma.automation.findFirst({
      where:   tenantId ? { id, tenantId } : { id },
      include: { logs: { orderBy: { executedAt: 'desc' }, take: 20 } },
    })
    return row ? this.toEntity(row) : null
  }

  async findByChannelId(channelId: string, tenantId?: string): Promise<Automation | null> {
    const row = await this.prisma.automation.findFirst({
      where: tenantId ? { channelId, status: 'ACTIVE', tenantId } : { channelId, status: 'ACTIVE' },
    })
    return row ? this.toEntity(row) : null
  }

  async create(dto: CreateAutomationDto, tenantId: string): Promise<Automation> {
    const primaryCh = dto.primaryChannelId ?? dto.channelId ?? null
    const row = await this.prisma.automation.create({
      data: {
        tenantId,
        name:                 dto.name,
        channelId:            dto.channelId               ?? null,
        primaryChannelId:     primaryCh,
        fallbackChannelIds:   dto.fallbackChannelIds       ?? [],
        testPhones:           dto.testPhones               ?? [],
        messageTemplates:     dto.messageTemplates         ?? [],
        linkedAgentId:        dto.linkedAgentId            ?? null,
        filterStatus:         dto.filterStatus             ?? 'ebook_enviado',
        minHoursAfterCapture: dto.minHoursAfterCapture     ?? 12,
        startHour:            dto.startHour                ?? 6,
        endHour:              dto.endHour                  ?? 21,
        batchIntervalMinMinutes: dto.batchIntervalMinMinutes ?? null,
        batchIntervalMaxMinutes: dto.batchIntervalMaxMinutes ?? null,
        batchSizeMin:         dto.batchSizeMin             ?? null,
        batchSizeMax:         dto.batchSizeMax             ?? null,
        aiChannelId:          dto.aiChannelId              ?? null,
        aiModel:              dto.aiModel                  ?? null,
        followupSteps:        (dto.followupSteps ?? []) as unknown as never,
        followupEnabled:      dto.followupEnabled          ?? true,
        debounceMs:           dto.debounceMs               ?? null,
        sendDelayMs:          dto.sendDelayMs              ?? null,
        fragmentDelayMs:      dto.fragmentDelayMs          ?? null,
        useExclusionList:     dto.useExclusionList         ?? false,
        exclusionFilterStatus: dto.exclusionFilterStatus   ?? null,
        humanHandoffEnabled:  dto.humanHandoffEnabled      ?? false,
        humanHandoffPhone:    dto.humanHandoffPhone        ?? null,
        humanHandoffMessage:  dto.humanHandoffMessage      ?? null,
        dispatchDelayMinMs:   dto.dispatchDelayMinMs       ?? null,
        dispatchDelayMaxMs:   dto.dispatchDelayMaxMs       ?? null,
      },
    })
    return this.toEntity(row)
  }

  async update(id: string, dto: UpdateAutomationDto): Promise<Automation> {
    const row = await this.prisma.automation.update({
      where: { id },
      data: {
        ...(dto.name                    !== undefined && { name: dto.name }),
        ...(dto.status                  !== undefined && { status: dto.status }),
        ...(dto.channelId               !== undefined && { channelId: dto.channelId }),
        // Ao atualizar channelId, sincroniza primaryChannelId — a menos que o caller já envie primaryChannelId explicitamente
        ...(dto.channelId               !== undefined && dto.primaryChannelId === undefined && { primaryChannelId: dto.channelId }),
        ...(dto.primaryChannelId        !== undefined && { primaryChannelId: dto.primaryChannelId }),
        ...(dto.fallbackChannelIds      !== undefined && { fallbackChannelIds: dto.fallbackChannelIds }),
        ...(dto.testPhones              !== undefined && { testPhones: dto.testPhones }),
        ...(dto.messageTemplates        !== undefined && { messageTemplates: dto.messageTemplates }),
        ...(dto.linkedAgentId           !== undefined && { linkedAgentId: dto.linkedAgentId }),
        ...(dto.filterStatus            !== undefined && { filterStatus: dto.filterStatus }),
        ...(dto.minHoursAfterCapture    !== undefined && { minHoursAfterCapture: dto.minHoursAfterCapture }),
        ...(dto.startHour               !== undefined && { startHour: dto.startHour }),
        ...(dto.endHour                 !== undefined && { endHour: dto.endHour }),
        ...(dto.batchIntervalMinMinutes !== undefined && { batchIntervalMinMinutes: dto.batchIntervalMinMinutes }),
        ...(dto.batchIntervalMaxMinutes !== undefined && { batchIntervalMaxMinutes: dto.batchIntervalMaxMinutes }),
        ...(dto.batchSizeMin            !== undefined && { batchSizeMin: dto.batchSizeMin }),
        ...(dto.batchSizeMax            !== undefined && { batchSizeMax: dto.batchSizeMax }),
        ...(dto.aiChannelId             !== undefined && { aiChannelId: dto.aiChannelId }),
        ...(dto.aiModel                 !== undefined && { aiModel: dto.aiModel }),
        ...(dto.followupSteps           !== undefined && { followupSteps: dto.followupSteps as unknown as never }),
        ...(dto.followupEnabled         !== undefined && { followupEnabled: dto.followupEnabled }),
        ...(dto.debounceMs              !== undefined && { debounceMs: dto.debounceMs }),
        ...(dto.sendDelayMs             !== undefined && { sendDelayMs: dto.sendDelayMs }),
        ...(dto.fragmentDelayMs         !== undefined && { fragmentDelayMs: dto.fragmentDelayMs }),
        ...(dto.useExclusionList        !== undefined && { useExclusionList: dto.useExclusionList }),
        ...(dto.exclusionFilterStatus   !== undefined && { exclusionFilterStatus: dto.exclusionFilterStatus }),
        ...(dto.humanHandoffEnabled     !== undefined && { humanHandoffEnabled: dto.humanHandoffEnabled }),
        ...(dto.humanHandoffPhone       !== undefined && { humanHandoffPhone: dto.humanHandoffPhone }),
        ...(dto.humanHandoffMessage     !== undefined && { humanHandoffMessage: dto.humanHandoffMessage }),
        ...(dto.dispatchDelayMinMs      !== undefined && { dispatchDelayMinMs: dto.dispatchDelayMinMs }),
        ...(dto.dispatchDelayMaxMs      !== undefined && { dispatchDelayMaxMs: dto.dispatchDelayMaxMs }),
        ...(dto.lastBatchAt             !== undefined && { lastBatchAt: dto.lastBatchAt }),
        ...(dto.totalSent               !== undefined && { totalSent: dto.totalSent }),
        ...(dto.totalReplied            !== undefined && { totalReplied: dto.totalReplied }),
        ...(dto.totalConverted          !== undefined && { totalConverted: dto.totalConverted }),
      },
    })
    return this.toEntity(row)
  }

  async remove(id: string): Promise<void> {
    await this.prisma.automation.delete({ where: { id } })
  }

  async addLog(automationId: string, dto: CreateAutomationLogDto): Promise<AutomationLog> {
    const row = await this.prisma.automationLog.create({
      data: {
        automationId,
        sent:    dto.sent,
        skipped: dto.skipped,
        errors:  dto.errors,
        reason:  dto.reason  ?? null,
        notes:   dto.notes   ?? null,
      },
    })
    return {
      id:           row.id,
      automationId: row.automationId,
      executedAt:   row.executedAt,
      sent:         row.sent,
      skipped:      row.skipped,
      errors:       row.errors,
      reason:       row.reason,
      notes:        row.notes,
    }
  }

  private toEntity(row: {
    id: string; tenantId: string; name: string; status: string
    sourceTable: string; filterStatus: string; minHoursAfterCapture: number
    channelId: string | null; primaryChannelId: string | null; fallbackChannelIds: unknown
    testPhones: unknown; messageTemplates: unknown; messageTemplate: string | null
    followupSteps: unknown
    linkedAgentId: string | null; aiPrompt: string | null
    aiChannelId: string | null; aiModel: string | null
    startHour: number; endHour: number
    batchIntervalMinMinutes: number | null; batchIntervalMaxMinutes: number | null
    batchIntervalHours: number
    batchSizeMin: number | null; batchSizeMax: number | null; batchSize: number
    debounceMs: number | null; sendDelayMs: number | null; fragmentDelayMs: number | null
    followupEnabled: boolean
    useExclusionList: boolean; exclusionFilterStatus: string | null
    humanHandoffEnabled: boolean; humanHandoffPhone: string | null; humanHandoffMessage: string | null
    dispatchDelayMinMs: number | null; dispatchDelayMaxMs: number | null
    lastBatchAt: Date | null
    totalSent: number; totalReplied: number; totalConverted: number
    createdAt: Date; updatedAt: Date
    logs?: {
      id: string; automationId: string; executedAt: Date
      sent: number; skipped: number; errors: number; reason: string | null; notes: string | null
    }[]
  }): Automation {
    return {
      id:                   row.id,
      tenantId:             row.tenantId,
      name:                 row.name,
      status:               row.status as AutomationStatus,
      sourceTable:          row.sourceTable,
      filterStatus:         row.filterStatus,
      minHoursAfterCapture: row.minHoursAfterCapture,
      channelId:            row.channelId,
      primaryChannelId:     row.primaryChannelId,
      fallbackChannelIds:   Array.isArray(row.fallbackChannelIds) ? (row.fallbackChannelIds as string[]) : [],
      testPhones:           Array.isArray(row.testPhones) ? (row.testPhones as string[]) : [],
      messageTemplates:     Array.isArray(row.messageTemplates) ? (row.messageTemplates as string[]) : [],
      messageTemplate:      row.messageTemplate,
      followupSteps:        Array.isArray(row.followupSteps) ? (row.followupSteps as FollowupStep[]) : [],
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
      aiChannelId:          row.aiChannelId,
      aiModel:              row.aiModel,
      debounceMs:           row.debounceMs,
      sendDelayMs:          row.sendDelayMs,
      fragmentDelayMs:      row.fragmentDelayMs,
      followupEnabled:      row.followupEnabled,
      useExclusionList:     row.useExclusionList,
      exclusionFilterStatus: row.exclusionFilterStatus,
      humanHandoffEnabled:  row.humanHandoffEnabled,
      humanHandoffPhone:    row.humanHandoffPhone,
      humanHandoffMessage:  row.humanHandoffMessage,
      dispatchDelayMinMs:   row.dispatchDelayMinMs,
      dispatchDelayMaxMs:   row.dispatchDelayMaxMs,
      lastBatchAt:          row.lastBatchAt,
      totalSent:            row.totalSent,
      totalReplied:         row.totalReplied,
      totalConverted:       row.totalConverted,
      createdAt:            row.createdAt,
      updatedAt:            row.updatedAt,
      logs: row.logs?.map((l) => ({
        id: l.id, automationId: l.automationId, executedAt: l.executedAt,
        sent: l.sent, skipped: l.skipped, errors: l.errors, reason: l.reason, notes: l.notes,
      })),
    }
  }
}
