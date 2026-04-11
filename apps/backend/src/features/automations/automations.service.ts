import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import {
  IAutomationRepository,
  CreateAutomationDto,
  UpdateAutomationDto,
  AUTOMATION_REPOSITORY,
} from '@/core/repositories/IAutomationRepository'
import { PrismaService }          from '@/infrastructure/database/prisma/prisma.service'
import { ChannelSendService }     from '@/infrastructure/channel-send/channel-send.service'
import { ChannelResolverService } from './channel-resolver.service'
import type { Channel, ChannelType, ChannelConfig } from '@/core/entities/Channel'

export interface TestFireLead {
  phone: string
  name?: string
}

export interface TestFireDto {
  phones?:        string[]
  leads?:         TestFireLead[]  // phone + nome por lead (substitui phones quando presente)
  templateIndex?: number          // undefined = aleatório
}

export interface TestFireResult {
  phone:   string
  message: string
  ok:      boolean
  error?:  string
}

export interface TestClearDto {
  phones?: string[]
}

export interface PhoneConversationTurn {
  role:      string
  content:   string
  timestamp: string
}

export interface PhoneTestStatus {
  phone:           string
  leadFound:       boolean
  leadStatus:      string | null
  mensagemEnviada: string | null
  conversation:    PhoneConversationTurn[]
  ingestionLogs:   {
    id:        string
    status:    string
    model:     string | null
    latencyMs: number | null
    errorMsg:  string | null
    createdAt: string
  }[]
}

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name)

  constructor(
    @Inject(AUTOMATION_REPOSITORY) private readonly repo: IAutomationRepository,
    private readonly prisma:          PrismaService,
    private readonly channelSend:     ChannelSendService,
    private readonly channelResolver: ChannelResolverService,
  ) {}

  findAll() {
    return this.repo.findAll()
  }

  async findById(id: string) {
    const automation = await this.repo.findById(id)
    if (!automation) throw new NotFoundException('Automação não encontrada')
    return automation
  }

  async create(dto: CreateAutomationDto) {
    return this.repo.create(dto)
  }

  async update(id: string, dto: UpdateAutomationDto) {
    await this.findById(id)
    return this.repo.update(id, dto)
  }

  async remove(id: string) {
    await this.findById(id)
    return this.repo.remove(id)
  }

  async getLeadStatuses(): Promise<string[]> {
    const rows = await this.prisma.leadManyInsta.findMany({
      where:    { status: { not: null } },
      select:   { status: true },
      distinct: ['status'],
      orderBy:  { status: 'asc' },
    })
    return rows.map((r) => r.status).filter((s): s is string => !!s)
  }

  async getDispatchLogs(id: string, limit = 50) {
    return this.prisma.automationDispatchLog.findMany({
      where:   { automationId: id },
      orderBy: { executedAt: 'desc' },
      take:    limit,
    })
  }

  async getStats(id: string) {
    const automation = await this.findById(id)

    const minHoursAgo    = new Date(Date.now() - automation.minHoursAfterCapture * 60 * 60 * 1000)
    const filterStatuses = automation.filterStatus
      .split(',').map((s) => s.trim()).filter(Boolean)
    const filterWhere = filterStatuses.length === 1
      ? { status: filterStatuses[0] }
      : { status: { in: filterStatuses } }
    const leadsNaFila = await this.prisma.leadManyInsta.count({
      where: {
        ...filterWhere,
        tentativasFollowup: 0,
        dataCaptura:        { lte: minHoursAgo },
        converteu:          false,
        NOT: { status: { in: ['opt_out', 'conversa_encerrada'] } },
      },
    })

    const exclTags = automation.useExclusionList && automation.exclusionFilterStatus
      ? automation.exclusionFilterStatus.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const leadsExcluidos = exclTags.length > 0
      ? await this.prisma.leadManyInsta.count({ where: { status: { in: exclTags } } })
      : 0

    return {
      totalSent:      automation.totalSent,
      totalReplied:   automation.totalReplied,
      totalConverted: automation.totalConverted,
      leadsNaFila,
      leadsExcluidos,
      conversionRate: automation.totalSent > 0
        ? Math.round((automation.totalConverted / automation.totalSent) * 100)
        : 0,
    }
  }

  // ─── Modo de Teste ─────────────────────────────────────────────────────────

  /**
   * Dispara o template imediatamente para os números de teste.
   * Ignora horário comercial, intervalo de lote e guardrails de produção.
   * Cria ou reseta o lead de teste — nunca incrementa totalSent/totalReplied.
   */
  async testFire(id: string, dto: TestFireDto): Promise<{ results: TestFireResult[] }> {
    const automation = await this.findById(id)

    // Normaliza entrada: suporta `leads` (phone+name) ou `phones` legado
    const rawLeads: TestFireLead[] = dto.leads?.length
      ? dto.leads
      : (dto.phones?.length ? dto.phones : automation.testPhones).map((p) => ({ phone: p }))
    if (!rawLeads.length) {
      throw new BadRequestException('Nenhum número de teste informado. Adicione números no painel de teste.')
    }

    // Resolve canal de envio — tenta primaryChannelId → channelId → fallbackChannelIds
    const channel = await this.channelResolver.resolveForAutomation(automation)
    if (!channel) throw new BadRequestException('Nenhum canal disponível (principal e reservas estão offline).')

    // Resolve pool de templates
    const templates = automation.messageTemplates.length > 0
      ? automation.messageTemplates
      : (automation.messageTemplate ? [automation.messageTemplate] : [])

    if (!templates.length) {
      throw new BadRequestException('Automação sem templates configurados.')
    }

    const results: TestFireResult[] = []

    for (const rawLead of rawLeads) {
      const phone = rawLead.phone.replace(/\D/g, '').trim()
      if (!phone) {
        results.push({ phone: rawLead.phone, message: '', ok: false, error: 'Número inválido' })
        continue
      }

      // Escolhe template (índice específico ou aleatório)
      const tplIndex = dto.templateIndex !== undefined
        ? Math.min(dto.templateIndex, templates.length - 1)
        : Math.floor(Math.random() * templates.length)

      // Nome: usa o fornecido no lead; fallback para DB; fallback para vazio
      let nome = rawLead.name?.trim() ?? ''
      if (!nome) {
        const existingLead = await this.prisma.leadManyInsta.findFirst({
          where: { OR: [{ whatsappLimpo: phone }, { whatsapp: phone }] },
          select: { nome: true },
        })
        nome = existingLead?.nome?.trim() ?? ''
      }
      const message = templates[tplIndex].replace(/\{nome\}/g, nome)

      try {
        await this.channelSend.send(channel, phone, message)

        // Upsert lead de teste — sempre atualiza o lead existente ou cria um novo
        // Não usa upsert({ where: { id: 'noop' } }) pois sem unique constraint em whatsapp
        // o upsert criaria um lead duplicado ao invés de atualizar o existente.
        const existingLead = await this.prisma.leadManyInsta.findFirst({
          where: { OR: [{ whatsappLimpo: phone }, { whatsapp: phone }] },
        })
        if (existingLead) {
          await this.prisma.leadManyInsta.update({
            where: { id: existingLead.id },
            data:  { status: 'teste', tentativasFollowup: 1, mensagemEnviada: message, historicoCId: [] },
          })
        } else {
          await this.prisma.leadManyInsta.create({
            data: {
              nome:               nome || 'Teste',
              whatsapp:           phone,
              whatsappLimpo:      phone,
              status:             'teste',
              tentativasFollowup: 1,
              mensagemEnviada:    message,
            },
          })
        }

        results.push({ phone, message, ok: true })
        this.logger.log(`[testFire] enviado → ${phone}: "${message.substring(0, 50)}"`)

        // Registra mensagem inicial na infraestrutura de conversas (quando há linkedAgent)
        // Sempre inicia sessão nova: apaga conversa existente para evitar histórico acumulado
        const linkedAgentId = (automation as any).linkedAgentId as string | null
        if (linkedAgentId) {
          try {
            const tenantId   = process.env.DEFAULT_TENANT_ID!
            const channelId2 = channel.id
            const existing = await this.prisma.conversation.findMany({
              where: { agentId: linkedAgentId, channelId: channelId2, contactPhone: phone, tenantId, status: 'OPEN' },
              select: { id: true },
            })
            if (existing.length) {
              const ids = existing.map((c) => c.id)
              await this.prisma.message.deleteMany({ where: { conversationId: { in: ids } } })
              await this.prisma.conversation.deleteMany({ where: { id: { in: ids } } })
            }
            const testConv = await this.prisma.conversation.create({
              data: { tenantId, agentId: linkedAgentId, channelId: channelId2, contactPhone: phone, contactName: nome || undefined, status: 'OPEN' },
            })
            await this.prisma.message.create({
              data: { conversationId: testConv.id, role: 'ASSISTANT', content: message },
            })
          } catch (convErr) {
            this.logger.warn(`[testFire] falha ao registrar conversa: ${convErr}`)
          }
        }
      } catch (err) {
        const error = String(err)
        results.push({ phone, message, ok: false, error })
        this.logger.warn(`[testFire] falha → ${phone}: ${error}`)
      }
    }

    return { results }
  }

  /**
   * Reseta o histórico dos leads de teste — permite rodar o teste novamente do zero.
   * Não apaga o lead, apenas limpa: historicoCId, mensagemEnviada, tentativasFollowup=0, status='teste'.
   */
  async testClear(id: string, dto: TestClearDto): Promise<{ cleared: number }> {
    const automation = await this.findById(id)

    const phones = dto.phones?.length ? dto.phones : automation.testPhones
    if (!phones.length) {
      throw new BadRequestException('Nenhum número de teste para limpar.')
    }

    const cleaned = phones.map((p) => p.replace(/\D/g, '').trim()).filter(Boolean)

    const linkedAgentId = (automation as any).linkedAgentId as string | null
    const tenantId      = process.env.DEFAULT_TENANT_ID!

    // Apaga conversas + mensagens da infra unificada para esses phones
    if (linkedAgentId) {
      const convs = await this.prisma.conversation.findMany({
        where: { contactPhone: { in: cleaned }, agentId: linkedAgentId, tenantId },
        select: { id: true },
      })
      if (convs.length) {
        const ids = convs.map((c) => c.id)
        await this.prisma.message.deleteMany({ where: { conversationId: { in: ids } } })
        await this.prisma.conversation.deleteMany({ where: { id: { in: ids } } })
      }
    }

    const [result, logsResult] = await Promise.all([
      this.prisma.leadManyInsta.updateMany({
        where: {
          OR: [
            { whatsappLimpo: { in: cleaned } },
            { whatsapp:      { in: cleaned } },
          ],
        },
        data: {
          status:             'teste',
          tentativasFollowup: 0,
          mensagemEnviada:    null,
          historicoCId:       {},
        },
      }),
      this.prisma.ingestionLog.deleteMany({
        where: { contactPhone: { in: cleaned } },
      }),
    ])

    this.logger.log(`[testClear] ${result.count} lead(s) resetados, ${logsResult.count} log(s) apagados`)
    return { cleared: result.count }
  }

  /**
   * Retorna o estado atual dos leads de teste + histórico de conversa + logs de ingestão.
   * Usado para o monitor em tempo real do painel de teste.
   */
  async testStatus(id: string, dto: { phones: string[] }): Promise<{ phones: PhoneTestStatus[] }> {
    const cleaned = dto.phones.map((p) => p.replace(/\D/g, '').trim()).filter(Boolean)
    if (!cleaned.length) return { phones: [] }

    const automation    = await this.findById(id)
    const linkedAgentId = (automation as any).linkedAgentId as string | null
    const tenantId      = process.env.DEFAULT_TENANT_ID!

    const [leads, logs] = await Promise.all([
      this.prisma.leadManyInsta.findMany({
        where: { OR: [{ whatsappLimpo: { in: cleaned } }, { whatsapp: { in: cleaned } }] },
        select: { whatsapp: true, whatsappLimpo: true, status: true, mensagemEnviada: true, historicoCId: true },
      }),
      this.prisma.ingestionLog.findMany({
        where:   { contactPhone: { in: cleaned } },
        orderBy: { createdAt: 'desc' },
        take:    cleaned.length * 20,
        select:  { id: true, contactPhone: true, status: true, model: true, latencyMs: true, errorMsg: true, createdAt: true },
      }),
    ])

    // Busca histórico de conversa na infraestrutura unificada (quando há linkedAgent)
    const convByPhone = new Map<string, PhoneConversationTurn[]>()
    if (linkedAgentId) {
      const conversations = await this.prisma.conversation.findMany({
        where:   { contactPhone: { in: cleaned }, agentId: linkedAgentId, tenantId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { startedAt: 'desc' },
      })
      for (const conv of conversations) {
        if (!conv.contactPhone || convByPhone.has(conv.contactPhone)) continue
        convByPhone.set(conv.contactPhone, conv.messages.map((m) => ({
          role:      m.role.toLowerCase() as 'user' | 'assistant',
          content:   m.content,
          timestamp: m.createdAt.toISOString(),
        })))
      }
    }

    const logsByPhone = new Map<string, typeof logs>()
    for (const log of logs) {
      if (!log.contactPhone) continue
      const arr = logsByPhone.get(log.contactPhone) ?? []
      arr.push(log)
      logsByPhone.set(log.contactPhone, arr)
    }

    const phones = cleaned.map((phone) => {
      const lead      = leads.find((l) => l.whatsappLimpo === phone || l.whatsapp === phone)
      const phoneLogs = logsByPhone.get(phone) ?? []

      // Prefere dados relacionais; fallback para historicoCId legado
      const conversation: PhoneConversationTurn[] = convByPhone.has(phone)
        ? convByPhone.get(phone)!
        : Array.isArray(lead?.historicoCId)
          ? (lead!.historicoCId as any[]).map((t: any) => ({
              role:      t.role      ?? 'user',
              content:   t.content   ?? '',
              timestamp: t.timestamp ?? '',
            }))
          : []

      return {
        phone,
        leadFound:       !!lead,
        leadStatus:      lead?.status        ?? null,
        mensagemEnviada: lead?.mensagemEnviada ?? null,
        conversation,
        ingestionLogs: phoneLogs.map((l) => ({
          id:        l.id,
          status:    l.status,
          model:     l.model,
          latencyMs: l.latencyMs,
          errorMsg:  l.errorMsg,
          createdAt: l.createdAt.toISOString(),
        })),
      }
    })

    return { phones }
  }
}
