import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Overview ──────────────────────────────────────────────────────────────

  async getOverview(from: string, to: string) {
    const range = { gte: new Date(from), lte: new Date(to) }

    // Campanhas — contadores cumulativos (não filtrados por data)
    const automations = await this.prisma.automation.findMany({
      select: { totalSent: true, totalReplied: true, totalConverted: true, status: true },
    })
    const totalSent      = automations.reduce((s, a) => s + a.totalSent, 0)
    const totalReplied   = automations.reduce((s, a) => s + a.totalReplied, 0)
    const totalConverted = automations.reduce((s, a) => s + a.totalConverted, 0)
    const activeCampaigns = automations.filter(a => a.status === 'ACTIVE').length

    // Logs de campanha no período (para tendência)
    const logsInPeriod = await this.prisma.automationLog.aggregate({
      where: { executedAt: range },
      _sum: { sent: true, errors: true, skipped: true },
    })

    // Conversas no período
    const [totalConvs, openConvs, humanTakeoverConvs] = await Promise.all([
      this.prisma.conversation.count({ where: { startedAt: range } }),
      this.prisma.conversation.count({ where: { status: 'OPEN', startedAt: range } }),
      this.prisma.conversation.count({ where: { humanTakeover: true, startedAt: range } }),
    ])

    // Saúde do sistema (ingestion logs no período)
    const [totalIngested, completedIngested, aiErrors, noAgent] = await Promise.all([
      this.prisma.ingestionLog.count({ where: { createdAt: range } }),
      this.prisma.ingestionLog.count({ where: { status: 'completed', createdAt: range } }),
      this.prisma.ingestionLog.count({ where: { status: 'ai_error',  createdAt: range } }),
      this.prisma.ingestionLog.count({ where: { status: 'no_agent',  createdAt: range } }),
    ])

    const latencyAgg = await this.prisma.ingestionLog.aggregate({
      where: { status: 'completed', latencyMs: { not: null }, createdAt: range },
      _avg: { latencyMs: true },
    })

    // Leads funil
    // Coleta todos os exclTags das automações ativas com exclusão habilitada
    const activeAutomations = await this.prisma.automation.findMany({
      where:  { status: 'ACTIVE', useExclusionList: true },
      select: { exclusionFilterStatus: true },
    })
    const allExclTags = [...new Set(
      activeAutomations
        .flatMap((a) => a.exclusionFilterStatus
          ? a.exclusionFilterStatus.split(',').map((s) => s.trim()).filter(Boolean)
          : []
        )
    )]

    const [leadsTotal, leadsConvertidos, leadsOptOut, exclusionListTotal] = await Promise.all([
      this.prisma.leadManyInsta.count(),
      this.prisma.leadManyInsta.count({ where: { converteu: true } }),
      this.prisma.leadManyInsta.count({ where: { status: 'opt_out' } }),
      allExclTags.length > 0
        ? this.prisma.leadManyInsta.count({ where: { status: { in: allExclTags } } })
        : Promise.resolve(0),
    ])

    return {
      campaigns: {
        totalSent, totalReplied, totalConverted,
        replyRate:      totalSent > 0 ? Math.round((totalReplied   / totalSent) * 100) : 0,
        conversionRate: totalSent > 0 ? Math.round((totalConverted / totalSent) * 100) : 0,
        activeCampaigns, total: automations.length,
        periodSent:    logsInPeriod._sum.sent    ?? 0,
        periodErrors:  logsInPeriod._sum.errors  ?? 0,
        periodSkipped: logsInPeriod._sum.skipped ?? 0,
      },
      conversations: {
        total: totalConvs, open: openConvs,
        humanTakeover: humanTakeoverConvs,
        humanTakeoverRate: totalConvs > 0 ? Math.round((humanTakeoverConvs / totalConvs) * 100) : 0,
      },
      system: {
        totalIngested, completed: completedIngested, aiErrors, noAgent,
        healthPct: totalIngested > 0 ? Math.round((completedIngested / totalIngested) * 100) : 100,
        avgLatencyMs: Math.round(latencyAgg._avg.latencyMs ?? 0),
      },
      leads: {
        total: leadsTotal, converted: leadsConvertidos, optOut: leadsOptOut,
        conversionRate: leadsTotal > 0 ? Math.round((leadsConvertidos / leadsTotal) * 100) : 0,
        exclusionListTotal,
      },
    }
  }

  // ─── Vendedor ──────────────────────────────────────────────────────────────

  async getVendedor() {
    const automations = await this.prisma.automation.findMany({
      orderBy: { totalSent: 'desc' },
    })

    // Stats por automação (paralelo)
    const perAuto = await Promise.all(automations.map(async (a) => {
      const filterStatuses = a.filterStatus
        .split(',').map((s) => s.trim()).filter(Boolean)
      const filterWhere = filterStatuses.length === 1
        ? { status: filterStatuses[0] }
        : { status: { in: filterStatuses } }
      const minHoursAgo = new Date(Date.now() - a.minHoursAfterCapture * 3_600_000)

      const exclTags = (a as any).useExclusionList && (a as any).exclusionFilterStatus
        ? (a as any).exclusionFilterStatus.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []

      const [leadsNaFila, leadsExcluidos] = await Promise.all([
        this.prisma.leadManyInsta.count({
          where: {
            ...filterWhere,
            tentativasFollowup: 0,
            dataCaptura:        { lte: minHoursAgo },
            converteu:          false,
            NOT: { status: { in: ['opt_out', 'conversa_encerrada', ...exclTags] } },
          },
        }),
        exclTags.length > 0
          ? this.prisma.leadManyInsta.count({ where: { status: { in: exclTags } } })
          : Promise.resolve(0),
      ])

      return {
        id:                   a.id,
        name:                 a.name,
        status:               a.status,
        filterStatus:         a.filterStatus,
        useExclusionList:     (a as any).useExclusionList ?? false,
        exclusionFilterStatus: (a as any).exclusionFilterStatus ?? null,
        totalSent:            a.totalSent,
        totalReplied:         a.totalReplied,
        totalConverted:       a.totalConverted,
        replyRate:            a.totalSent > 0 ? Math.round((a.totalReplied    / a.totalSent) * 100) : 0,
        conversionRate:       a.totalSent > 0 ? Math.round((a.totalConverted  / a.totalSent) * 100) : 0,
        leadsNaFila,
        leadsExcluidos,
        lastBatchAt:          a.lastBatchAt,
      }
    }))

    const totalEnviados    = perAuto.reduce((s, r) => s + r.totalSent,       0)
    const totalRespostas   = perAuto.reduce((s, r) => s + r.totalReplied,    0)
    const totalConvertidos = perAuto.reduce((s, r) => s + r.totalConverted,  0)
    const totalNaFila      = perAuto.reduce((s, r) => s + r.leadsNaFila,     0)
    const campanhasAtivas  = perAuto.filter((r) => r.status === 'ACTIVE').length

    return {
      summary: {
        campanhasAtivas,
        totalCampanhas:   perAuto.length,
        totalNaFila,
        totalEnviados,
        totalRespostas,
        totalConvertidos,
        taxaResposta:   totalEnviados > 0 ? Math.round((totalRespostas   / totalEnviados) * 100) : 0,
        taxaConversao:  totalEnviados > 0 ? Math.round((totalConvertidos / totalEnviados) * 100) : 0,
      },
      automations: perAuto,
    }
  }

  // ─── Campanhas ─────────────────────────────────────────────────────────────

  async getCampaigns(from: string, to: string, automationId?: string) {
    const range = { gte: new Date(from), lte: new Date(to) }

    const automations = await this.prisma.automation.findMany({
      where:   automationId ? { id: automationId } : undefined,
      orderBy: { totalSent: 'desc' },
      select: {
        id: true, name: true, status: true, channelId: true, linkedAgentId: true,
        totalSent: true, totalReplied: true, totalConverted: true, lastBatchAt: true,
        batchSizeMin: true, batchSizeMax: true,
      },
    })

    // Logs timeline
    const logs = await this.prisma.automationLog.findMany({
      where: {
        ...(automationId ? { automationId } : {}),
        executedAt: range,
      },
      orderBy: { executedAt: 'asc' },
    })

    // Agrupa por dia
    const byDay: Record<string, { sent: number; errors: number; skipped: number }> = {}
    for (const log of logs) {
      const day = log.executedAt.toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = { sent: 0, errors: 0, skipped: 0 }
      byDay[day].sent    += log.sent
      byDay[day].errors  += log.errors
      byDay[day].skipped += log.skipped
    }

    const totalSent      = automations.reduce((s, a) => s + a.totalSent, 0)
    const totalReplied   = automations.reduce((s, a) => s + a.totalReplied, 0)
    const totalConverted = automations.reduce((s, a) => s + a.totalConverted, 0)

    return {
      automations: automations.map(a => ({
        id: a.id, name: a.name, status: a.status,
        totalSent: a.totalSent, totalReplied: a.totalReplied, totalConverted: a.totalConverted,
        replyRate:      a.totalSent > 0 ? Math.round((a.totalReplied   / a.totalSent) * 100) : 0,
        conversionRate: a.totalSent > 0 ? Math.round((a.totalConverted / a.totalSent) * 100) : 0,
        lastBatchAt: a.lastBatchAt,
      })),
      timeline: Object.entries(byDay).map(([date, v]) => ({ date, ...v })),
      totals: { sent: totalSent, replied: totalReplied, converted: totalConverted },
    }
  }

  // ─── Chat IA ───────────────────────────────────────────────────────────────

  async getChat(from: string, to: string, channelId?: string) {
    const range  = { gte: new Date(from), lte: new Date(to) }
    const filter = { createdAt: range, ...(channelId ? { channelId } : {}) }

    const statuses = [
      'completed', 'no_agent', 'ai_error', 'parse_error',
      'send_error', 'human_takeover', 'ignored_group', 'ignored_trigger', 'debounced',
    ] as const

    const [total, ...statusCounts] = await Promise.all([
      this.prisma.ingestionLog.count({ where: filter }),
      ...statuses.map(s => this.prisma.ingestionLog.count({ where: { ...filter, status: s } })),
    ])

    const latencyAgg = await this.prisma.ingestionLog.aggregate({
      where: { ...filter, status: 'completed', latencyMs: { not: null } },
      _avg:  { latencyMs: true },
      _max:  { latencyMs: true },
    })

    // Timeline por dia
    const rawLogs = await this.prisma.ingestionLog.findMany({
      where:   filter,
      select:  { status: true, createdAt: true, latencyMs: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDay: Record<string, { total: number; completed: number; errors: number; latencies: number[] }> = {}
    for (const log of rawLogs) {
      const day = log.createdAt.toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = { total: 0, completed: 0, errors: 0, latencies: [] }
      byDay[day].total++
      if (log.status === 'completed') {
        byDay[day].completed++
        if (log.latencyMs) byDay[day].latencies.push(log.latencyMs)
      }
      if (['ai_error', 'parse_error', 'send_error'].includes(log.status ?? '')) byDay[day].errors++
    }

    const breakdown = Object.fromEntries(statuses.map((s, i) => [s, statusCounts[i]]))
    const completed = breakdown['completed'] ?? 0

    // Conversas
    const convFilter = { startedAt: range, ...(channelId ? { channelId } : {}) }
    const [totalConvs, humanTakeoverConvs] = await Promise.all([
      this.prisma.conversation.count({ where: convFilter }),
      this.prisma.conversation.count({ where: { ...convFilter, humanTakeover: true } }),
    ])
    const turnsAgg = await this.prisma.conversation.aggregate({ where: convFilter, _avg: { turns: true } })

    return {
      ingestion: {
        total, breakdown,
        successRate:  total > 0 ? Math.round((completed / total) * 100) : 100,
        avgLatencyMs: Math.round(latencyAgg._avg.latencyMs ?? 0),
        maxLatencyMs: latencyAgg._max.latencyMs ?? 0,
      },
      conversations: {
        total: totalConvs, humanTakeover: humanTakeoverConvs,
        humanTakeoverRate: totalConvs > 0 ? Math.round((humanTakeoverConvs / totalConvs) * 100) : 0,
        avgTurns: Math.round((turnsAgg._avg.turns ?? 0) * 10) / 10,
      },
      timeline: Object.entries(byDay).map(([date, v]) => ({
        date, total: v.total, completed: v.completed, errors: v.errors,
        avgLatencyMs: v.latencies.length > 0
          ? Math.round(v.latencies.reduce((s, l) => s + l, 0) / v.latencies.length)
          : null,
      })),
    }
  }
}
