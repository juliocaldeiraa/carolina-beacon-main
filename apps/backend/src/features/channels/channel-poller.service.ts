/**
 * ChannelPollerService — Verifica status de todos os canais a cada 30s
 *
 * Suporta 5 provedores:
 * - Evolution API: GET {instanceUrl}/instance/connectionState/{instanceName}
 * - Z-API:         GET https://api.z-api.io/instances/{instanceId}/token/{token}/status
 * - WhatsApp Official: GET https://graph.facebook.com/v17.0/{phoneNumberId}
 * - Telegram:      GET https://api.telegram.org/bot{botToken}/getMe
 * - Instagram:     GET https://graph.facebook.com/v17.0/me?access_token={accessToken}
 */

import { Injectable, Inject, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { IChannelRepository, CHANNEL_REPOSITORY } from '@/core/repositories/IChannelRepository'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import type { Channel, ChannelStatus } from '@/core/entities/Channel'

@Injectable()
export class ChannelPollerService {
  private readonly logger = new Logger(ChannelPollerService.name)

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly repo: IChannelRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Interval(30_000)
  async pollAll(): Promise<void> {
    try {
      const channels = await this.repo.findAll()
      await Promise.allSettled(channels.map((ch) => this.checkChannel(ch)))
    } catch (err) {
      this.logger.error('Erro ao fazer polling de canais', err)
    }
  }

  async checkChannel(channel: Channel): Promise<Channel> {
    try {
      const status = await this.fetchStatus(channel)
      const blockedAt = status === 'BLOCKED' && !channel.blockedAt ? new Date() : channel.blockedAt
      const updated = await this.repo.updateStatus(channel.id, status, blockedAt)

      // Alerta de desconexão: dispara apenas na transição CONNECTED → DISCONNECTED
      if (channel.status === 'CONNECTED' && status === 'DISCONNECTED') {
        this.dispatchDisconnectAlert(channel).catch(() => {})
      }

      return updated
    } catch (err) {
      this.logger.warn(`Falha ao verificar canal ${channel.id} (${channel.name}): ${err}`)

      // Considera desconectado se o fetch falhou e antes estava conectado
      if (channel.status === 'CONNECTED') {
        this.dispatchDisconnectAlert(channel).catch(() => {})
      }

      return this.repo.updateStatus(channel.id, 'DISCONNECTED')
    }
  }

  private async dispatchDisconnectAlert(channel: Channel): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { isActive: true },
    })
    const matching = webhooks.filter((wh) => {
      const events = (wh.events ?? []) as string[]
      return events.includes('channel.disconnected') || events.includes('*')
    })
    if (!matching.length) return

    const body = JSON.stringify({
      event:     'channel.disconnected',
      timestamp: new Date().toISOString(),
      data: {
        channelId:   channel.id,
        channelName: channel.name,
        channelType: channel.type,
      },
    })

    for (const wh of matching) {
      fetch(wh.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Beacon-Event': 'channel.disconnected' },
        body,
        signal:  AbortSignal.timeout(8_000),
      }).catch((err) => this.logger.warn(`[channelAlert] falha ao notificar ${wh.url}: ${err}`))
    }
  }

  private async fetchStatus(channel: Channel): Promise<ChannelStatus> {
    const { config } = channel

    switch (channel.type) {
      case 'EVOLUTION_API':
        return this.checkEvolutionApi(config.instanceUrl!, config.instanceName!, config.apiKey!)

      case 'ZAPI':
        return this.checkZApi(config.instanceId!, config.token!)

      case 'WHATSAPP_OFFICIAL':
        return this.checkWhatsAppOfficial(config.phoneNumberId!, config.accessToken!)

      case 'TELEGRAM':
        return this.checkTelegram(config.botToken!)

      case 'INSTAGRAM':
        return this.checkInstagram(config.accessToken!)

      default:
        return 'UNKNOWN'
    }
  }

  private async checkEvolutionApi(
    instanceUrl: string,
    instanceName: string,
    apiKey: string,
  ): Promise<ChannelStatus> {
    const url = `${instanceUrl}/instance/connectionState/${instanceName}`
    const res = await fetch(url, { headers: { apikey: apiKey } })
    if (!res.ok) return 'DISCONNECTED'
    const data = await res.json() as { instance?: { state?: string } }
    const state = data?.instance?.state?.toLowerCase()
    if (state === 'open') return 'CONNECTED'
    if (state === 'close' || state === 'closed') return 'DISCONNECTED'
    return 'UNKNOWN'
  }

  private async checkZApi(instanceId: string, token: string): Promise<ChannelStatus> {
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`
    const res = await fetch(url)
    if (!res.ok) return 'DISCONNECTED'
    const data = await res.json() as { connected?: boolean }
    return data?.connected ? 'CONNECTED' : 'DISCONNECTED'
  }

  private async checkWhatsAppOfficial(phoneNumberId: string, accessToken: string): Promise<ChannelStatus> {
    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}?access_token=${accessToken}`
    const res = await fetch(url)
    if (!res.ok) return 'DISCONNECTED'
    const data = await res.json() as { id?: string; error?: { code?: number } }
    if (data?.error) return 'DISCONNECTED'
    return data?.id ? 'CONNECTED' : 'UNKNOWN'
  }

  private async checkTelegram(botToken: string): Promise<ChannelStatus> {
    const url = `https://api.telegram.org/bot${botToken}/getMe`
    const res = await fetch(url)
    if (!res.ok) return 'DISCONNECTED'
    const data = await res.json() as { ok?: boolean }
    return data?.ok ? 'CONNECTED' : 'DISCONNECTED'
  }

  private async checkInstagram(accessToken: string): Promise<ChannelStatus> {
    const url = `https://graph.facebook.com/v17.0/me?access_token=${accessToken}`
    const res = await fetch(url)
    if (!res.ok) return 'DISCONNECTED'
    const data = await res.json() as { id?: string; error?: { code?: number } }
    if (data?.error) return 'DISCONNECTED'
    return data?.id ? 'CONNECTED' : 'UNKNOWN'
  }
}
