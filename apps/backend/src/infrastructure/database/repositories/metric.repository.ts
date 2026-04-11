import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  IMetricRepository,
  MetricFilters,
  ObservabilitySummary,
} from '../../../core/repositories/IMetricRepository'
import { Metric } from '../../../core/entities/Metric'

@Injectable()
export class MetricRepository implements IMetricRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Omit<Metric, 'id' | 'recordedAt'>): Promise<Metric> {
    const row = await this.prisma.metric.create({ data })
    return this.toEntity(row)
  }

  async findByAgent(agentId: string): Promise<Metric[]> {
    const rows = await this.prisma.metric.findMany({
      where: { agentId, tenantId: process.env.DEFAULT_TENANT_ID },
      orderBy: { recordedAt: 'desc' },
      take: 500,
    })
    return rows.map(this.toEntity)
  }

  async getSummary(filters: MetricFilters): Promise<ObservabilitySummary> {
    const where = this.buildWhere(filters)

    const rows = await this.prisma.metric.findMany({ where })

    const avg = (arr: (number | null | undefined)[]) => {
      const vals = arr.filter((v): v is number => v != null)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }
    const sum = (arr: (number | null | undefined)[]) =>
      arr.filter((v): v is number => v != null).reduce((a, b) => a + b, 0)

    return {
      performance: {
        avgLatencyMs:  avg(rows.map((r) => r.latencyMs)),
        successRate:   avg(rows.map((r) => r.successRate)),
        fallbackRate:  avg(rows.map((r) => r.fallbackRate)),
      },
      financial: {
        totalInputTokens:          sum(rows.map((r) => r.inputTokens)),
        totalOutputTokens:         sum(rows.map((r) => r.outputTokens)),
        totalCostUsd:              sum(rows.map((r) => r.costUsd)),
        avgCostPerConversation:    avg(rows.map((r) => r.costUsd)),
      },
      quality: {
        avgSentimentScore:     avg(rows.map((r) => r.sentimentScore)),
        avgHallucinationScore: avg(rows.map((r) => r.hallucinationScore)),
        avgUserRating:         avg(rows.map((r) => r.userRating)),
        avgRelevanceScore:     avg(rows.map((r) => r.relevanceScore)),
      },
      engagement: {
        totalConversations:         rows.length,
        avgTurnsPerConversation:    avg(rows.map((r) => r.turnsCount)),
      },
    }
  }

  async getTimeseries(
    filters: MetricFilters,
    granularity: 'hour' | 'day' | 'week',
  ): Promise<unknown[]> {
    const where = this.buildWhere(filters)
    const rows = await this.prisma.metric.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      select: {
        recordedAt: true,
        latencyMs:  true,
        costUsd:    true,
        turnsCount: true,
        inputTokens: true,
        outputTokens: true,
      },
    })

    // Group by granularity
    const fmt = (d: Date) => {
      if (granularity === 'hour') {
        return `${d.toISOString().slice(0, 13)}:00`
      }
      if (granularity === 'week') {
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        return new Date(d.setDate(diff)).toISOString().slice(0, 10)
      }
      return d.toISOString().slice(0, 10)
    }

    const grouped = new Map<string, typeof rows>()
    for (const r of rows) {
      const key = fmt(new Date(r.recordedAt))
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(r)
    }

    return Array.from(grouped.entries()).map(([date, items]) => ({
      date,
      avgLatencyMs:  items.reduce((a, b) => a + (b.latencyMs ?? 0), 0) / items.length,
      totalCostUsd:  items.reduce((a, b) => a + (b.costUsd ?? 0), 0),
      totalTokens:   items.reduce((a, b) => a + (b.inputTokens ?? 0) + (b.outputTokens ?? 0), 0),
      conversations: items.length,
    }))
  }

  private buildWhere(filters: MetricFilters) {
    return {
      tenantId: process.env.DEFAULT_TENANT_ID,
      ...(filters.agentId && { agentId: filters.agentId }),
      ...(filters.from || filters.to
        ? {
            recordedAt: {
              ...(filters.from && { gte: filters.from }),
              ...(filters.to   && { lte: filters.to }),
            },
          }
        : {}),
    }
  }

  private toEntity(row: {
    id: string; tenantId: string; agentId: string; conversationId: string | null
    latencyMs: number | null; ttftMs: number | null
    successRate: number | null; fallbackRate: number | null
    inputTokens: number | null; outputTokens: number | null; costUsd: number | null
    sentimentScore: number | null; hallucinationScore: number | null
    userRating: number | null; relevanceScore: number | null
    turnsCount: number | null; recordedAt: Date
  }): Metric {
    return {
      id:             row.id,
      tenantId:       row.tenantId,
      agentId:        row.agentId,
      conversationId: row.conversationId ?? undefined,
      latencyMs:      row.latencyMs ?? undefined,
      ttftMs:         row.ttftMs ?? undefined,
      successRate:    row.successRate ?? undefined,
      fallbackRate:   row.fallbackRate ?? undefined,
      inputTokens:    row.inputTokens ?? undefined,
      outputTokens:   row.outputTokens ?? undefined,
      costUsd:        row.costUsd ?? undefined,
      sentimentScore: row.sentimentScore ?? undefined,
      hallucinationScore: row.hallucinationScore ?? undefined,
      userRating:     row.userRating ?? undefined,
      relevanceScore: row.relevanceScore ?? undefined,
      turnsCount:     row.turnsCount ?? undefined,
      recordedAt:     row.recordedAt,
    }
  }
}
