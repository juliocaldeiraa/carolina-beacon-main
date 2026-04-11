/**
 * ChatIaService — CRUD de configurações Canal + Agente + Modelo LLM
 *
 * Cada entrada vincula um canal a um agente com um modelo LLM específico.
 * Ao criar ou ativar uma config para canal Evolution API, registra
 * automaticamente a URL do webhook no provedor.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

export interface CreateChannelAgentDto {
  name:      string
  channelId: string
  agentId:   string
  llmModel:  string
  isActive?: boolean
}

export interface UpdateChannelAgentDto {
  name?:      string
  channelId?: string
  agentId?:   string
  llmModel?:  string
  isActive?:  boolean
}

@Injectable()
export class ChatIaService {
  private readonly logger = new Logger(ChatIaService.name)
  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.channelAgent.findMany({
      where:   { tenantId: this.tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: string) {
    return this.prisma.channelAgent.findFirst({
      where: { id, tenantId: this.tenantId },
    })
  }

  findByChannelId(channelId: string) {
    return this.prisma.channelAgent.findFirst({
      where: { channelId, tenantId: this.tenantId, isActive: true },
    })
  }

  async create(dto: CreateChannelAgentDto) {
    // Valida que o agente é do tipo PASSIVO (Chat IA não suporta agentes ATIVO)
    const agent = await this.prisma.agent.findFirst({ where: { id: dto.agentId } })
    if (agent && (agent as any).agentType === 'ATIVO') {
      throw new BadRequestException(
        'Agentes do tipo ATIVO não podem ser vinculados ao Chat IA. Use um Agente Passivo ou acesse a área Vendedor.'
      )
    }

    const record = await this.prisma.channelAgent.create({
      data: {
        tenantId:  this.tenantId,
        name:      dto.name,
        channelId: dto.channelId,
        agentId:   dto.agentId,
        llmModel:  dto.llmModel,
        isActive:  dto.isActive ?? true,
      },
    })

    if (record.isActive) {
      await this.registerWebhook(record.channelId)
    }

    return record
  }

  async update(id: string, dto: UpdateChannelAgentDto) {
    const record = await this.prisma.channelAgent.update({
      where: { id },
      data: {
        ...(dto.name      !== undefined && { name:      dto.name      }),
        ...(dto.channelId !== undefined && { channelId: dto.channelId }),
        ...(dto.agentId   !== undefined && { agentId:   dto.agentId   }),
        ...(dto.llmModel  !== undefined && { llmModel:  dto.llmModel  }),
        ...(dto.isActive  !== undefined && { isActive:  dto.isActive  }),
      },
    })

    // Re-register webhook when activating or changing channel
    if (record.isActive && (dto.isActive === true || dto.channelId !== undefined)) {
      await this.registerWebhook(record.channelId)
    }

    return record
  }

  remove(id: string) {
    return this.prisma.channelAgent.delete({ where: { id } })
  }

  // ─── Connection Test ───────────────────────────────────────────────────────

  async testConnection(id: string): Promise<{
    ok:             boolean
    channelName:    string
    channelStatus:  string
    webhookMatch:   boolean
    registeredUrl:  string | null
    expectedUrl:    string | null
    error?:         string
  }> {
    const record = await this.prisma.channelAgent.findFirst({
      where: { id, tenantId: this.tenantId },
    })
    if (!record) {
      return { ok: false, channelName: '', channelStatus: 'UNKNOWN', webhookMatch: false, registeredUrl: null, expectedUrl: null, error: 'Configuração não encontrada' }
    }

    const channel = await this.prisma.channel.findUnique({ where: { id: record.channelId } })
    if (!channel) {
      return { ok: false, channelName: '', channelStatus: 'UNKNOWN', webhookMatch: false, registeredUrl: null, expectedUrl: null, error: 'Canal não encontrado' }
    }

    const channelStatus = channel.status
    const channelName   = channel.name
    const beaconUrl     = process.env.BEACON_PUBLIC_URL
    const expectedUrl   = beaconUrl ? `${beaconUrl}/inbound/${channel.id}` : null

    // For non-Evolution-API channels, only check connection status
    if (channel.type !== 'EVOLUTION_API') {
      const ok = channelStatus === 'CONNECTED'
      return { ok, channelName, channelStatus, webhookMatch: ok, registeredUrl: null, expectedUrl, error: ok ? undefined : `Canal ${channelStatus === 'DISCONNECTED' ? 'desconectado' : channelStatus.toLowerCase()}` }
    }

    // Evolution API: also verify webhook registration
    const config = channel.config as Record<string, string>
    const { instanceUrl, instanceName, apiKey } = config

    if (!instanceUrl || !instanceName || !apiKey) {
      return { ok: false, channelName, channelStatus, webhookMatch: false, registeredUrl: null, expectedUrl, error: 'Canal sem configuração completa (instanceUrl/instanceName/apiKey)' }
    }

    try {
      const res  = await fetch(`${instanceUrl}/webhook/find/${instanceName}`, {
        headers: { apikey: apiKey },
      })

      if (!res.ok) {
        return { ok: false, channelName, channelStatus, webhookMatch: false, registeredUrl: null, expectedUrl, error: `Evolution API retornou ${res.status}` }
      }

      const data = await res.json() as Record<string, unknown>
      // Evolution API v2: { webhook: { url, enabled } } | Evolution API v1: { url, enabled }
      const webhookObj    = (data['webhook'] ?? data) as Record<string, unknown>
      const registeredUrl = (webhookObj['url'] as string | undefined) ?? null
      const enabled       = webhookObj['enabled'] !== false // default true if not present

      const webhookMatch = !!(registeredUrl && expectedUrl && registeredUrl === expectedUrl && enabled)
      const ok           = channelStatus === 'CONNECTED' && webhookMatch

      return { ok, channelName, channelStatus, webhookMatch, registeredUrl, expectedUrl }
    } catch (err) {
      return { ok: false, channelName, channelStatus, webhookMatch: false, registeredUrl: null, expectedUrl, error: `Erro ao consultar Evolution API: ${err}` }
    }
  }

  // ─── Webhook Registration ──────────────────────────────────────────────────

  /**
   * Registra automaticamente a URL do webhook no Evolution API para o canal dado.
   * Silently ignores if channel is not EVOLUTION_API or if BEACON_PUBLIC_URL is not set.
   */
  private async registerWebhook(channelId: string): Promise<void> {
    const beaconUrl = process.env.BEACON_PUBLIC_URL
    if (!beaconUrl) {
      this.logger.warn('BEACON_PUBLIC_URL não configurado — webhook não registrado automaticamente')
      return
    }

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel || channel.type !== 'EVOLUTION_API') return

    const config = channel.config as Record<string, string>
    const { instanceUrl, instanceName, apiKey } = config
    if (!instanceUrl || !instanceName || !apiKey) {
      this.logger.warn(`Canal ${channelId} (${channel.name}) sem config completa para registrar webhook`)
      return
    }

    const webhookUrl = `${beaconUrl}/inbound/${channelId}`

    try {
      const res = await fetch(`${instanceUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          webhook: {
            url:          webhookUrl,
            enabled:      true,
            byEvents:     false,
            base64:       false,
            events:       ['MESSAGES_UPSERT'],
          },
        }),
      })

      if (res.ok) {
        this.logger.log(`Webhook registrado: ${webhookUrl} → ${channel.name}`)
      } else {
        const body = await res.text()
        this.logger.warn(`Falha ao registrar webhook no Evolution API (${res.status}): ${body}`)
      }
    } catch (err) {
      this.logger.warn(`Erro ao registrar webhook para canal ${channelId}: ${err}`)
    }
  }
}
