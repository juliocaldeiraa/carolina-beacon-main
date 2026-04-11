import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

export interface PhoneHistorySlice {
  automationId:   string
  automationName: string
  turnCount:      number
  lastAt:         string | null
}

export interface PhoneInspectResult {
  found: boolean
  lead?: {
    id:          string
    nome:        string
    whatsapp:    string
    status:      string | null
    createdAt:   string
    history:     PhoneHistorySlice[]
    legacyTurns: number
  }
  ingestionLogs: {
    total:    number
    firstAt:  string | null
    lastAt:   string | null
    byStatus: Record<string, number>
  }
}

@Injectable()
export class DatabaseService {
  constructor(private readonly prisma: PrismaService) {}

  async inspectPhone(phone: string): Promise<PhoneInspectResult> {
    const cleaned = phone.replace(/\D/g, '').trim()

    const [lead, logs] = await Promise.all([
      this.prisma.leadManyInsta.findFirst({
        where: {
          OR: [{ whatsappLimpo: cleaned }, { whatsapp: cleaned }],
        },
        select: {
          id:           true,
          nome:         true,
          whatsapp:     true,
          status:       true,
          createdAt:    true,
          historicoCId: true,
        },
      }),
      this.prisma.ingestionLog.findMany({
        where:   { contactPhone: cleaned },
        select:  { status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    // Resumo dos logs
    const ingestionLogs = {
      total:   logs.length,
      firstAt: logs.length ? logs[0].createdAt.toISOString() : null,
      lastAt:  logs.length ? logs[logs.length - 1].createdAt.toISOString() : null,
      byStatus: logs.reduce<Record<string, number>>((acc, l) => {
        acc[l.status] = (acc[l.status] ?? 0) + 1
        return acc
      }, {}),
    }

    if (!lead) return { found: false, ingestionLogs }

    // Decodifica o histórico (novo formato chaveado ou legado array)
    let history: PhoneHistorySlice[] = []
    let legacyTurns = 0
    const raw = lead.historicoCId

    if (Array.isArray(raw)) {
      legacyTurns = raw.length
    } else if (raw && typeof raw === 'object') {
      const scoped = raw as Record<string, unknown[]>
      const automationIds = Object.keys(scoped)

      if (automationIds.length > 0) {
        const automations = await this.prisma.automation.findMany({
          where:  { id: { in: automationIds } },
          select: { id: true, name: true },
        })
        const nameMap = Object.fromEntries(automations.map((a) => [a.id, a.name]))

        history = automationIds.map((aid) => {
          const turns = Array.isArray(scoped[aid]) ? scoped[aid] : []
          const lastEntry = turns.length > 0
            ? (turns[turns.length - 1] as any)?.timestamp ?? null
            : null
          return {
            automationId:   aid,
            automationName: nameMap[aid] ?? '(campanha removida)',
            turnCount:      turns.length,
            lastAt:         lastEntry,
          }
        })
      }
    }

    return {
      found: true,
      lead: {
        id:       lead.id,
        nome:     lead.nome,
        whatsapp: lead.whatsapp,
        status:   lead.status,
        createdAt: lead.createdAt.toISOString(),
        history,
        legacyTurns,
      },
      ingestionLogs,
    }
  }

  async clearHistory(phones: string[], automationId?: string): Promise<{ cleared: number }> {
    const cleaned = phones.map((p) => p.replace(/\D/g, '').trim()).filter(Boolean)
    if (!cleaned.length) return { cleared: 0 }

    if (!automationId) {
      // Limpa todo o histórico
      const result = await this.prisma.leadManyInsta.updateMany({
        where: {
          OR: [{ whatsappLimpo: { in: cleaned } }, { whatsapp: { in: cleaned } }],
        },
        data: { historicoCId: {} },
      })
      return { cleared: result.count }
    }

    // Limpa apenas o slice da automação específica
    const leads = await this.prisma.leadManyInsta.findMany({
      where: {
        OR: [{ whatsappLimpo: { in: cleaned } }, { whatsapp: { in: cleaned } }],
      },
      select: { id: true, historicoCId: true },
    })

    let count = 0
    for (const lead of leads) {
      const raw = lead.historicoCId
      if (!raw || Array.isArray(raw)) continue
      const scoped = { ...(raw as Record<string, unknown>) }
      if (!(automationId in scoped)) continue
      delete scoped[automationId]
      await this.prisma.leadManyInsta.update({
        where: { id: lead.id },
        data:  { historicoCId: scoped as any },
      })
      count++
    }
    return { cleared: count }
  }

  async clearLogs(phones: string[]): Promise<{ deleted: number }> {
    const cleaned = phones.map((p) => p.replace(/\D/g, '').trim()).filter(Boolean)
    if (!cleaned.length) return { deleted: 0 }

    const result = await this.prisma.ingestionLog.deleteMany({
      where: { contactPhone: { in: cleaned } },
    })
    return { deleted: result.count }
  }

  async resetLead(phones: string[]): Promise<{ resetLeads: number; deletedLogs: number }> {
    const cleaned = phones.map((p) => p.replace(/\D/g, '').trim()).filter(Boolean)
    if (!cleaned.length) return { resetLeads: 0, deletedLogs: 0 }

    const [leadsResult, logsResult] = await Promise.all([
      this.prisma.leadManyInsta.updateMany({
        where: {
          OR: [{ whatsappLimpo: { in: cleaned } }, { whatsapp: { in: cleaned } }],
        },
        data: {
          historicoCId:       {},
          mensagemEnviada:    null,
          tentativasFollowup: 0,
          status:             'teste',
        },
      }),
      this.prisma.ingestionLog.deleteMany({
        where: { contactPhone: { in: cleaned } },
      }),
    ])

    return { resetLeads: leadsResult.count, deletedLogs: logsResult.count }
  }
}
