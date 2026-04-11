/**
 * LeadsService — Gestão de leads e importação de planilhas (multi-tenant)
 *
 * Importação:
 * - Aceita CSV e XLS/XLSX
 * - Colunas esperadas: telefone (obrigatório), 1-5 (variáveis customizáveis)
 * - Normaliza telefone para E.164 brasileiro
 * - Deduplica por (campaignId, phone)
 */

import {
  Injectable, Logger, NotFoundException, BadRequestException,
  Inject, forwardRef,
} from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { DispatchQueueService } from '@/features/dispatch/dispatch-queue.service'
import { brPhoneVariants } from '@/shared/utils/phone.utils'
import * as Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ImportResult {
  total:      number
  imported:   number
  skipped:    number
  errors:     string[]
}

export interface UpdateLeadDto {
  status?:       string
  kanbanColumn?: string
  notes?:        string
  nextActionAt?: string
  var1?: string | null
  var2?: string | null
  var3?: string | null
  var4?: string | null
  var5?: string | null
}

type RawRow = Record<string, string>

// ─── Helpers de telefone ──────────────────────────────────────────────────────

function rawToDigits(raw: unknown): string {
  let s = String(raw ?? '').trim()
  if (/^\d+(\.\d+)?[eE][+\-]?\d+$/.test(s)) {
    s = Math.round(Number(s)).toString()
  }
  return s.replace(/\D/g, '')
}

function normalizePhone(raw: unknown): string | null {
  const digits = rawToDigits(raw)
  if (!digits) return null
  const d = digits.replace(/^0+/, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d
  if (d.length === 10 || d.length === 11) return '55' + d
  if (d.startsWith('55') && d.length === 12) return d
  return null
}

const PHONE_COLS = ['telefone', 'phone', 'tel', 'whatsapp', 'numero', 'número', 'celular', 'fone', 'mobile', 'contato']

function detectPhoneColumn(headers: string[], rows: RawRow[]): string | null {
  for (const col of PHONE_COLS) {
    if (headers.includes(col)) return col
  }
  for (const hdr of headers) {
    if (PHONE_COLS.some((k) => hdr.includes(k))) return hdr
  }
  const sample = rows.slice(0, Math.min(rows.length, 20))
  for (const hdr of headers) {
    const hits = sample.filter((r) => normalizePhone(r[hdr]) !== null).length
    if (hits >= Math.ceil(sample.length * 0.6)) return hdr
  }
  return null
}

function parseCsv(buffer: Buffer): RawRow[] {
  const text = buffer.toString('utf8')
  const result = Papa.parse<RawRow>(text, {
    header:          true,
    skipEmptyLines:  true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  return result.data
}

function parseXlsx(buffer: Buffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true })
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), String(v ?? '').trim()]),
    ),
  )
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DispatchQueueService))
    private readonly queue: DispatchQueueService,
  ) {}

  async createOne(campaignId: string, tenantId: string, dto: {
    phone: string; var1?: string; var2?: string; var3?: string; var4?: string; var5?: string
  }) {
    const phone = normalizePhone(dto.phone)
    if (!phone) throw new BadRequestException('Número de telefone inválido')

    return this.prisma.campaignLead.upsert({
      where:  { campaignId_phone: { campaignId, phone } },
      update: { var1: dto.var1, var2: dto.var2, var3: dto.var3, var4: dto.var4, var5: dto.var5 },
      create: {
        tenantId,
        campaignId,
        phone,
        var1: dto.var1 ?? null,
        var2: dto.var2 ?? null,
        var3: dto.var3 ?? null,
        var4: dto.var4 ?? null,
        var5: dto.var5 ?? null,
        status: 'PENDING',
      },
    })
  }

  async findByCampaign(campaignId: string, tenantId: string, filters?: {
    status?: string
    kanbanColumn?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const page  = filters?.page  ?? 1
    const limit = Math.min(filters?.limit ?? 50, 200)
    const skip  = (page - 1) * limit

    const where: any = { campaignId, tenantId }
    if (filters?.status)       where.status = filters.status
    if (filters?.kanbanColumn) where.kanbanColumn = filters.kanbanColumn
    if (filters?.search) {
      where.OR = [
        { phone: { contains: filters.search } },
        { var1:  { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [leads, total] = await Promise.all([
      this.prisma.campaignLead.findMany({
        where,
        include: { dispatchLogs: { orderBy: { sentAt: 'desc' }, take: 5 } },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.campaignLead.count({ where }),
    ])

    return { leads, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async findById(id: string, tenantId: string) {
    const lead = await this.prisma.campaignLead.findFirst({
      where:   { id, tenantId },
      include: { dispatchLogs: { orderBy: { sentAt: 'desc' } } },
    })
    if (!lead) throw new NotFoundException('Lead não encontrado')
    return lead
  }

  async update(id: string, tenantId: string, dto: UpdateLeadDto) {
    await this.findById(id, tenantId)
    return this.prisma.campaignLead.update({
      where: { id },
      data: {
        ...(dto.status       ? { status:       dto.status as any } : {}),
        ...(dto.kanbanColumn ? { kanbanColumn: dto.kanbanColumn  } : {}),
        ...(dto.notes        !== undefined ? { notes: dto.notes  } : {}),
        ...(dto.nextActionAt ? { nextActionAt: new Date(dto.nextActionAt) } : {}),
        ...(dto.var1 !== undefined ? { var1: dto.var1 } : {}),
        ...(dto.var2 !== undefined ? { var2: dto.var2 } : {}),
        ...(dto.var3 !== undefined ? { var3: dto.var3 } : {}),
        ...(dto.var4 !== undefined ? { var4: dto.var4 } : {}),
        ...(dto.var5 !== undefined ? { var5: dto.var5 } : {}),
      },
    })
  }

  async cancelLead(id: string, tenantId: string) {
    const lead = await this.findById(id, tenantId)
    if (lead.status === 'OPTED_OUT') return lead

    await this.queue.removeLeadJobs(id)
    const updated = await this.prisma.campaignLead.update({
      where: { id },
      data:  { status: 'OPTED_OUT' },
    })
    this.logger.log(`Lead ${id} cancelado (OPTED_OUT)`)
    return updated
  }

  async getMessages(id: string, tenantId: string) {
    await this.findById(id, tenantId)

    const [dispatches, inbound] = await Promise.all([
      this.prisma.campaignDispatchLog.findMany({
        where:   { leadId: id },
        orderBy: { sentAt: 'asc' },
      }),
      this.prisma.campaignInboundMessage.findMany({
        where:   { leadId: id },
        orderBy: { receivedAt: 'asc' },
      }),
    ])

    const outMessages = dispatches.map((d) => ({
      id:        d.id,
      direction: 'out' as const,
      content:   d.messageSent,
      status:    d.status,
      errorMsg:  d.errorMsg,
      at:        d.sentAt,
    }))

    const inMessages = inbound.map((m) => ({
      id:        m.id,
      direction: 'in' as const,
      content:   m.content,
      status:    'RECEIVED' as const,
      errorMsg:  null,
      at:        m.receivedAt,
    }))

    return [...outMessages, ...inMessages].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    )
  }

  async importFile(
    campaignId:  string,
    tenantId:    string,
    buffer:      Buffer,
    mimetype:    string,
    originalname: string,
  ): Promise<ImportResult> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    })
    if (!campaign) throw new NotFoundException('Campanha não encontrada')
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Só é possível importar contatos para campanhas em DRAFT')
    }

    let rows: RawRow[]
    const name = originalname.toLowerCase()
    if (name.endsWith('.csv') || mimetype.includes('csv') || mimetype.includes('text/plain')) {
      rows = parseCsv(buffer)
    } else if (name.endsWith('.xls') || name.endsWith('.xlsx') || mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
      rows = parseXlsx(buffer)
    } else {
      throw new BadRequestException('Formato não suportado. Use CSV, XLS ou XLSX.')
    }

    if (rows.length === 0) {
      throw new BadRequestException('Arquivo vazio ou sem linhas de dados.')
    }

    this.logger.log(`Importando ${rows.length} linhas para campanha ${campaignId}`)

    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    const phoneCol = detectPhoneColumn(headers, rows)
    if (!phoneCol) {
      throw new BadRequestException(
        'Coluna de telefone não encontrada. Use um cabeçalho reconhecível ' +
        '(ex: "telefone", "whatsapp", "celular").',
      )
    }
    this.logger.log(`Coluna de telefone detectada: "${phoneCol}"`)

    const varLabels: string[] = (campaign.varLabels as string[] | null) ?? []
    const VAR_ALIASES = [
      ['var1', '1', 'variavel1', 'nome', 'name'],
      ['var2', '2', 'variavel2', 'empresa', 'company'],
      ['var3', '3', 'variavel3', 'cargo', 'role'],
      ['var4', '4', 'variavel4'],
      ['var5', '5', 'variavel5'],
    ]
    const varCols: (string | null)[] = VAR_ALIASES.map((aliases, idx) => {
      const lbl = varLabels[idx]?.trim().toLowerCase()
      if (lbl && headers.includes(lbl)) return lbl
      for (const alias of aliases) {
        if (headers.includes(alias)) return alias
      }
      return null
    })

    const usedCols = new Set([phoneCol])
    const remainingCols = headers.filter((h) => !usedCols.has(h) && !PHONE_COLS.includes(h))
    for (let idx = 0; idx < 5; idx++) {
      if (varCols[idx] === null && remainingCols.length > 0) {
        varCols[idx] = remainingCols.shift()!
      }
    }

    this.logger.log(`Mapeamento de variáveis: ${varCols.map((c, i) => `{{${i+1}}}=${c ?? '-'}`).join(', ')}`)

    const existing = await this.prisma.campaignLead.findMany({
      where:  { campaignId },
      select: { phone: true },
    })
    const existingPhones = new Set(existing.map((l) => l.phone))

    const toCreate: any[] = []
    const errors:   string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i]
      const lineN = i + 2

      const phoneRaw = row[phoneCol] ?? ''
      const phone    = normalizePhone(phoneRaw)

      if (!phone) {
        if (String(phoneRaw).trim()) {
          errors.push(`Linha ${lineN}: telefone inválido "${phoneRaw}"`)
        }
        continue
      }

      if (existingPhones.has(phone)) continue
      existingPhones.add(phone)

      const getVar = (idx: number) => {
        const col = varCols[idx]
        if (!col) return null
        const val = String(row[col] ?? '').trim()
        return val || null
      }

      toCreate.push({
        tenantId,
        campaignId,
        phone,
        var1: getVar(0),
        var2: getVar(1),
        var3: getVar(2),
        var4: getVar(3),
        var5: getVar(4),
        status: 'PENDING',
      })
    }

    const skipped = rows.length - toCreate.length - errors.length

    if (toCreate.length > 0) {
      await this.prisma.campaignLead.createMany({ data: toCreate, skipDuplicates: true })
      const total = await this.prisma.campaignLead.count({ where: { campaignId } })
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data:  { totalLeads: total },
      })
    }

    const result: ImportResult = {
      total:    rows.length,
      imported: toCreate.length,
      skipped,
      errors:   errors.slice(0, 20),
    }

    this.logger.log(
      `Import ${campaignId}: ${result.imported} importados, ` +
      `${result.skipped} duplicados, ${result.errors.length} erros`,
    )

    return result
  }

  async markReplied(phone: string, channelId?: string): Promise<void> {
    const normalized = normalizePhone(phone)
    const withoutCountry = phone.replace(/^55/, '').replace(/\D/g, '')
    const candidates = new Set<string>([phone])
    if (normalized) candidates.add(normalized)
    if (withoutCountry) candidates.add(withoutCountry)
    if (withoutCountry) candidates.add('55' + withoutCountry)
    for (const v of brPhoneVariants(phone)) candidates.add(v)
    if (normalized) for (const v of brPhoneVariants(normalized)) candidates.add(v)
    const phoneCandidates = [...candidates]

    const where: any = {
      phone:  { in: phoneCandidates },
      status: 'SENT',
    }
    if (channelId) where.campaign = { channelId }

    const leads = await this.prisma.campaignLead.findMany({
      where,
      select: { id: true },
    })

    if (leads.length === 0) return

    await this.prisma.campaignLead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data:  { status: 'REPLIED', kanbanColumn: 'RESPONDEU', lastMessageAt: new Date() },
    })

    this.logger.log(`${leads.length} lead(s) marcados como REPLIED (phone=${phone})`)
  }
}
