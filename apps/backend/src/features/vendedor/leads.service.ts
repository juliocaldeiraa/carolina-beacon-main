/**
 * LeadsService — Gestão completa da tabela lead_many_insta.
 *
 * IMPORTANTE: Nunca deletar dados de lead_many_insta.
 * Import via upsert por whatsapp (nunca sobrescreve campos críticos).
 */

import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

export interface ConversationTurn {
  role:      string
  content:   string
  timestamp: string
}

export interface LeadsQuery {
  page?:     number
  limit?:    number
  search?:   string
  status?:   string
  campanha?: string
  lista?:    string
}

export interface LeadsResult {
  data:       any[]
  total:      number
  page:       number
  totalPages: number
}

export interface LeadImportRow {
  nome:      string
  whatsapp:  string
  status?:   string
  campanha?: string
  origem?:   string
  lista?:    string
  [key: string]: string | undefined  // campos extra → metadata
}

export interface CreateFieldDefDto {
  key:       string
  label:     string
  fieldType?: string
}

export interface PatchLeadDto {
  status?:   string
  lista?:    string
  notas?:    string
  metadata?: Record<string, unknown>
}

const PROTECTED_FIELDS = new Set(['nome', 'whatsapp', 'status', 'campanha', 'origem', 'lista'])

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Listagem paginada ───────────────────────────────────────────────────

  async list(query: LeadsQuery): Promise<LeadsResult> {
    const page  = Math.max(1, query.page ?? 1)
    const limit = Math.min(200, query.limit ?? 50)
    const skip  = (page - 1) * limit
    const where = this.buildWhere(query)

    const [rows, total] = await Promise.all([
      this.prisma.leadManyInsta.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.leadManyInsta.count({ where }),
    ])

    return { data: rows, total, page, totalPages: Math.ceil(total / limit) }
  }

  // ─── Export completo (sem paginação, máx 10k) ────────────────────────────

  async exportAll(query: Omit<LeadsQuery, 'page' | 'limit'>): Promise<any[]> {
    return this.prisma.leadManyInsta.findMany({
      where:   this.buildWhere(query),
      orderBy: { createdAt: 'desc' },
      take:    10_000,
    })
  }

  // ─── Import CSV ──────────────────────────────────────────────────────────

  async import(rows: LeadImportRow[], defaultLista?: string): Promise<{ imported: number; updated: number }> {
    let imported = 0
    let updated  = 0

    for (const row of rows) {
      const whatsapp = row.whatsapp?.replace(/\D/g, '').trim()
      if (!whatsapp || !row.nome?.trim()) continue

      // Campos extra (não conhecidos) → metadata
      const metaEntries = Object.entries(row).filter(([k]) => !PROTECTED_FIELDS.has(k))
      const metadata    = metaEntries.length > 0
        ? Object.fromEntries(metaEntries.map(([k, v]) => [k, v ?? '']))
        : undefined

      const existing = await this.prisma.leadManyInsta.findFirst({
        where: { OR: [{ whatsappLimpo: whatsapp }, { whatsapp }] },
      })

      if (existing) {
        // Atualiza apenas campos não críticos (nunca toca tentativas, histórico, converteu)
        await this.prisma.leadManyInsta.update({
          where: { id: existing.id },
          data:  {
            ...(row.status   && { status:   row.status }),
            ...(row.campanha && { campanha: row.campanha }),
            ...(row.origem   && { origem:   row.origem }),
            lista: row.lista ?? defaultLista ?? existing.lista,
            ...(metadata && {
              metadata: { ...(existing.metadata as object ?? {}), ...metadata } as any,
            }),
          },
        })
        updated++
      } else {
        await this.prisma.leadManyInsta.create({
          data: {
            nome:          row.nome.trim(),
            whatsapp:      row.whatsapp,
            whatsappLimpo: whatsapp,
            status:        row.status   ?? null,
            campanha:      row.campanha ?? null,
            origem:        row.origem   ?? null,
            lista:         row.lista    ?? defaultLista ?? null,
            ...(metadata && { metadata }),
          },
        })
        imported++
      }
    }

    return { imported, updated }
  }

  // ─── Patch lead ──────────────────────────────────────────────────────────

  async patchLead(id: string, dto: PatchLeadDto): Promise<void> {
    const lead = await this.prisma.leadManyInsta.findUnique({ where: { id } })
    if (!lead) throw new NotFoundException('Lead não encontrado')

    await this.prisma.leadManyInsta.update({
      where: { id },
      data:  {
        ...(dto.status   !== undefined && { status:   dto.status }),
        ...(dto.lista    !== undefined && { lista:    dto.lista }),
        ...(dto.notas    !== undefined && { notas:    dto.notas }),
        ...(dto.metadata !== undefined && {
          metadata: { ...(lead.metadata as object ?? {}), ...dto.metadata } as any,
        }),
      },
    })
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────

  async distinctStatuses(): Promise<string[]> {
    const rows = await this.prisma.leadManyInsta.findMany({
      select: { status: true }, distinct: ['status'], where: { status: { not: null } },
    })
    return rows.map((r) => r.status!).filter(Boolean).sort()
  }

  async distinctCampanhas(): Promise<string[]> {
    const rows = await this.prisma.leadManyInsta.findMany({
      select: { campanha: true }, distinct: ['campanha'], where: { campanha: { not: null } },
    })
    return rows.map((r) => r.campanha!).filter(Boolean).sort()
  }

  async distinctListas(): Promise<string[]> {
    const rows = await this.prisma.leadManyInsta.findMany({
      select: { lista: true }, distinct: ['lista'], where: { lista: { not: null } },
    })
    return rows.map((r) => r.lista!).filter(Boolean).sort()
  }

  // ─── Field Defs ──────────────────────────────────────────────────────────

  async listFieldDefs() {
    return this.prisma.leadFieldDef.findMany({ orderBy: { createdAt: 'asc' } })
  }

  async createFieldDef(dto: CreateFieldDefDto) {
    return this.prisma.leadFieldDef.create({
      data: { key: dto.key.trim(), label: dto.label.trim(), fieldType: dto.fieldType ?? 'text' },
    })
  }

  async deleteFieldDef(id: string) {
    const def = await this.prisma.leadFieldDef.findUnique({ where: { id } })
    if (!def) throw new NotFoundException('Campo não encontrado')
    await this.prisma.leadFieldDef.delete({ where: { id } })
  }

  // ─── Conversa ────────────────────────────────────────────────────────────

  async getConversation(phone: string): Promise<{ turns: ConversationTurn[] }> {
    const clean = phone.replace(/\D/g, '').trim()

    const conv = await this.prisma.conversation.findFirst({
      where:   { OR: [{ contactPhone: clean }, { contactPhone: phone }] },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { startedAt: 'desc' },
    })

    if (conv && conv.messages.length > 0) {
      return {
        turns: conv.messages.map((m) => ({
          role:      m.role.toLowerCase(),
          content:   m.content,
          timestamp: m.createdAt.toISOString(),
        })),
      }
    }

    const lead = await this.prisma.leadManyInsta.findFirst({
      where:  { OR: [{ whatsappLimpo: clean }, { whatsapp: clean }, { whatsappLimpo: phone }, { whatsapp: phone }] },
      select: { historicoCId: true },
    })

    if (!lead?.historicoCId) return { turns: [] }

    const raw = lead.historicoCId as any
    let entries: any[] = []

    if (Array.isArray(raw)) {
      entries = raw
    } else if (typeof raw === 'object') {
      entries = Object.values(raw).flat() as any[]
    }

    return {
      turns: entries.map((e: any) => ({
        role:      e.role      ?? 'user',
        content:   e.content   ?? '',
        timestamp: e.timestamp ?? '',
      })),
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private buildWhere(query: Omit<LeadsQuery, 'page' | 'limit'>): any {
    const where: any = {}

    if (query.search?.trim()) {
      const term = query.search.trim()
      where.OR = [
        { nome:          { contains: term, mode: 'insensitive' } },
        { whatsapp:      { contains: term, mode: 'insensitive' } },
        { whatsappLimpo: { contains: term, mode: 'insensitive' } },
      ]
    }

    if (query.status   && query.status   !== 'all') where.status   = query.status
    if (query.campanha && query.campanha !== 'all') where.campanha = query.campanha
    if (query.lista    && query.lista    !== 'all') where.lista    = query.lista

    return where
  }
}
