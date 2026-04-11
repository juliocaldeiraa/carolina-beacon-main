/**
 * ChannelSendService — Envia mensagem de texto pelo canal correto
 *
 * Suporte a provedores:
 * - EVOLUTION_API: POST {instanceUrl}/message/sendText/{instanceName}
 *                  POST {instanceUrl}/chat/whatsappNumbers/{instanceName} (pré-validação)
 * - ZAPI:          POST https://api.z-api.io/instances/{id}/token/{token}/send-text
 * - TELEGRAM:      POST https://api.telegram.org/bot{token}/sendMessage
 * - WHATSAPP_OFFICIAL / INSTAGRAM: log warn (não implementado)
 *
 * Erros de envio são lançados para o chamador (processMessage) para rastreabilidade.
 * sendTyping() e checkWhatsAppNumbers() são best-effort (nunca lançam).
 */

import { Injectable, Logger } from '@nestjs/common'
import type { Channel } from '@/core/entities/Channel'

/** Lançado quando a Evolution API confirma que o número não está no WhatsApp */
export class PhoneNotOnWhatsAppError extends Error {
  constructor(public readonly phone: string) {
    super(`Número ${phone} não está no WhatsApp`)
    this.name = 'PhoneNotOnWhatsAppError'
  }
}

@Injectable()
export class ChannelSendService {
  private readonly logger = new Logger(ChannelSendService.name)

  async sendTyping(channel: Channel, phone: string): Promise<void> {
    try {
      if (channel.type === 'EVOLUTION_API') {
        const { instanceUrl, instanceName, apiKey } = channel.config
        if (!instanceUrl || !instanceName || !apiKey) return
        await fetch(`${instanceUrl}/chat/updatePresence/${instanceName}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body:    JSON.stringify({ number: phone, presence: 'composing' }),
        })
      }
    } catch {
      // typing indicator é best-effort — nunca bloqueia o envio
    }
  }

  /**
   * Pré-valida quais números de um lote têm WhatsApp ativo.
   * Exclusivo para Evolution API — demais provedores retornam todos como válidos.
   * Nunca lança: em caso de erro na chamada, assume todos válidos (fail-open).
   *
   * @returns Set com os números confirmados como válidos (mesmo formato enviado)
   */
  async checkWhatsAppNumbers(channel: Channel, phones: string[]): Promise<Set<string>> {
    if (channel.type !== 'EVOLUTION_API' || phones.length === 0) return new Set(phones)

    const { instanceUrl, instanceName, apiKey } = channel.config
    if (!instanceUrl || !instanceName || !apiKey) return new Set(phones)

    try {
      const res = await fetch(`${instanceUrl}/chat/whatsappNumbers/${instanceName}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body:    JSON.stringify({ numbers: phones }),
      })
      if (!res.ok) return new Set(phones)

      const data: Array<{ exists: boolean; number: string }> = await res.json()
      return new Set(
        data.filter((n) => n.exists).map((n) => n.number.replace(/\D/g, '')),
      )
    } catch {
      return new Set(phones) // fail-open: em dúvida tenta enviar
    }
  }

  async send(channel: Channel, phone: string, text: string): Promise<void> {
    switch (channel.type) {
      case 'EVOLUTION_API':
        await this.sendEvolutionApi(channel, phone, text)
        break
      case 'ZAPI':
        await this.sendZApi(channel, phone, text)
        break
      case 'TELEGRAM':
        await this.sendTelegram(channel, phone, text)
        break
      default:
        this.logger.warn(`ChannelSendService: provedor ${channel.type} não suportado para envio`)
    }
  }

  private async sendEvolutionApi(channel: Channel, phone: string, text: string): Promise<void> {
    const { instanceUrl, instanceName, apiKey } = channel.config
    if (!instanceUrl || !instanceName || !apiKey) {
      this.logger.warn(`Evolution API: configuração incompleta no canal ${channel.id}`)
      return
    }
    const url = `${instanceUrl}/message/sendText/${instanceName}`
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body:    JSON.stringify({ number: phone, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // Detecta resposta "exists: false" da Evolution API (número sem WhatsApp)
      try {
        const parsed = JSON.parse(body)
        const msgs = parsed?.response?.message
        if (Array.isArray(msgs) && msgs.some((m: { exists?: boolean }) => m.exists === false)) {
          throw new PhoneNotOnWhatsAppError(phone)
        }
      } catch (e) {
        if (e instanceof PhoneNotOnWhatsAppError) throw e
      }
      throw new Error(`Evolution API ${res.status}: ${body}`)
    }
  }

  private async sendZApi(channel: Channel, phone: string, text: string): Promise<void> {
    const { instanceId, token } = channel.config
    if (!instanceId || !token) {
      this.logger.warn(`Z-API: configuração incompleta no canal ${channel.id}`)
      return
    }
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, message: text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Z-API ${res.status}: ${body}`)
    }
  }

  private async sendTelegram(channel: Channel, phone: string, text: string): Promise<void> {
    const { botToken } = channel.config
    if (!botToken) {
      this.logger.warn(`Telegram: botToken não configurado no canal ${channel.id}`)
      return
    }
    // Para Telegram, `phone` é usado como chatId
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: phone, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Telegram ${res.status}: ${body}`)
    }
  }
}
