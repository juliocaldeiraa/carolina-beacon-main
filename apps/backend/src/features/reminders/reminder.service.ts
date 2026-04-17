/**
 * ReminderService — Envia lembretes e processa confirmações de agendamento.
 *
 * Cron roda a cada 5 minutos:
 * 1. Verifica agendamentos que precisam de lembrete → envia WhatsApp
 * 2. Quando paciente responde, a IA interpreta e confirma/cancela
 */

import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { ChannelSendService } from '@/infrastructure/channel-send/channel-send.service'
import { GoogleCalendarService } from '@/infrastructure/google-calendar/google-calendar.service'
import { AiEngineService } from '@/infrastructure/ai-engine/ai-engine.service'
import type { Channel } from '@/core/entities/Channel'

// Cores do Google Calendar
const COLOR_GREEN = '2'   // confirmado
const COLOR_RED   = '11'  // cancelado

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelSend: ChannelSendService,
    private readonly calendarService: GoogleCalendarService,
    private readonly aiEngine: AiEngineService,
  ) {}

  /**
   * Cron: verifica e envia lembretes de agendamento.
   */
  @Cron('*/5 * * * *')
  async checkReminders(): Promise<void> {
    this.logger.debug('[reminder cron] Verificando lembretes...')

    const agents = await this.prisma.agent.findMany({
      where: { reminderEnabled: true, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, reminderMinutes: true, reminderMessage: true, channelId: true },
    })

    this.logger.debug(`[reminder cron] ${agents.length} agente(s) com lembrete ativo`)
    if (agents.length === 0) return

    for (const agent of agents) {
      const reminderMs = (agent.reminderMinutes ?? 120) * 60_000
      const now = new Date()
      const windowStart = new Date(now.getTime() + reminderMs - 5 * 60_000)
      const windowEnd   = new Date(now.getTime() + reminderMs + 5 * 60_000)

      const events = await this.prisma.calendarEvent.findMany({
        where: {
          agentId: agent.id,
          status: 'scheduled',
          reminderSentAt: null,
          startTime: { gte: windowStart, lte: windowEnd },
        },
      })

      this.logger.debug(`[reminder cron] Agente ${agent.name}: janela ${windowStart.toISOString()} - ${windowEnd.toISOString()}, ${events.length} evento(s)`)
      if (events.length === 0) continue

      const channel = await this.getAgentChannel(agent.id)
      if (!channel) continue

      for (const event of events) {
        if (!event.clientPhone) continue

        const message = this.buildReminderMessage(agent, event)

        try {
          await this.channelSend.send(channel, event.clientPhone, message)
          await this.prisma.calendarEvent.update({
            where: { id: event.id },
            data: { reminderSentAt: new Date(), status: 'awaiting_confirmation' },
          })
          this.logger.log(`[reminder] Lembrete enviado para ${event.clientPhone}`)
        } catch (err) {
          this.logger.error(`[reminder] Falha: ${err}`)
        }
      }
    }
  }

  /**
   * Chamado pelo webhook-ingestion quando um paciente responde a um lembrete.
   * Retorna true se processou (era resposta a lembrete), false se não.
   */
  async handleConfirmationReply(
    agentId: string,
    phone: string,
    text: string,
    channel: Channel,
  ): Promise<boolean> {
    // Buscar evento pendente de confirmação pra esse telefone
    const event = await this.prisma.calendarEvent.findFirst({
      where: {
        agentId,
        clientPhone: phone,
        status: 'awaiting_confirmation',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!event) return false

    // Usar IA pra interpretar a resposta
    const interpretation = await this.interpretResponse(text)

    const dateStr = new Date(event.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = new Date(event.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

    if (interpretation === 'confirmed') {
      // Confirmar
      await this.prisma.calendarEvent.update({
        where: { id: event.id },
        data: { status: 'confirmed' },
      })

      // Mudar cor no Google Calendar (verde)
      await this.calendarService.updateEventColor(agentId, event.googleEventId, COLOR_GREEN)

      // CRM: mover pra confirmed
      try {
        await this.prisma.whatsAppLead.updateMany({
          where: { agentId, contactPhone: phone },
          data: { stage: 'confirmed', updatedAt: new Date() },
        })
      } catch {}

      // Responder ao paciente
      await this.channelSend.send(channel, phone, `Agendamento confirmado! Te esperamos dia ${dateStr} as ${timeStr}. Ate la!`)

      // Notificar equipe
      await this.notifyTeam(agentId, event, 'CONFIRMADO', channel)

    } else {
      // Cancelar / não confirmado
      await this.prisma.calendarEvent.update({
        where: { id: event.id },
        data: { status: 'cancelled' },
      })

      // Mudar cor no Google Calendar (vermelho)
      await this.calendarService.updateEventColor(agentId, event.googleEventId, COLOR_RED)

      // CRM: mover pra lost
      try {
        await this.prisma.whatsAppLead.updateMany({
          where: { agentId, contactPhone: phone },
          data: { stage: 'lost', lostReason: 'Cancelou via lembrete', updatedAt: new Date() },
        })
      } catch {}

      // Perguntar motivo e oferecer reagendamento
      await this.channelSend.send(channel, phone, `Entendi! Cancelei seu agendamento do dia ${dateStr}. Posso te ajudar a remarcar pra outro dia?`)

      // Notificar equipe
      await this.notifyTeam(agentId, event, 'CANCELADO', channel)

      // Reabrir conversa pra IA continuar atendendo (reagendamento)
      if (event.conversationId) {
        await this.prisma.conversation.update({
          where: { id: event.conversationId },
          data: { humanTakeover: false, status: 'OPEN' },
        })
      }
    }

    return true
  }

  // ── Private helpers ──

  private async interpretResponse(text: string): Promise<'confirmed' | 'cancelled'> {
    const lower = text.toLowerCase().trim()

    // Atalhos diretos sem IA — NEGATIVAS primeiro (evita "não vou" matchando "vou")
    const negativeWords = ['nao vou', 'não vou', 'nao posso', 'não posso', 'nao consigo', 'não consigo', 'cancela', 'cancelar', 'desmarcar', 'remarcar', 'nao da', 'não da', 'nao vai dar', 'não vai dar', 'infelizmente']
    const positiveWords = ['sim', 'confirmo', 'confirmado', 'vou sim', 'vou', 'ok', 'certo', 'pode ser', 'com certeza', 'estarei', 'estarei la', 'la estarei', 'combinado']

    if (negativeWords.some((w) => lower.includes(w))) return 'cancelled'
    if (positiveWords.some((w) => lower.includes(w))) return 'confirmed'

    // Ambíguo — usar IA
    try {
      const result = await this.aiEngine.complete({
        messages: [{ role: 'user', content: `O paciente respondeu a um lembrete de agendamento com: "${text}"\n\nEle está CONFIRMANDO ou CANCELANDO a presença? Responda apenas "confirmed" ou "cancelled".` }],
        model: 'claude-haiku-4-5-20251001',
        temperature: 0,
        maxTokens: 10,
      })
      return result.content.toLowerCase().includes('confirmed') ? 'confirmed' : 'cancelled'
    } catch {
      return 'confirmed' // fallback: assume confirmado
    }
  }

  private buildReminderMessage(agent: any, event: any): string {
    const startDate = new Date(event.startTime)
    const dateStr = startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

    const defaultMsg = `Oi {nome}! Lembrando do seu agendamento dia {data} as {horario}. Pode confirmar sua presenca?`

    return (agent.reminderMessage ?? defaultMsg)
      .replace(/\{nome\}/gi, event.clientName)
      .replace(/\{data\}/gi, dateStr)
      .replace(/\{hora\}/gi, timeStr)
      .replace(/\{horario\}/gi, timeStr)
  }

  private async notifyTeam(agentId: string, event: any, status: string, channel: Channel): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { leadDispatchEnabled: true, leadDispatchPhone: true, name: true },
    })

    if (!agent?.leadDispatchEnabled || !agent.leadDispatchPhone) return

    const dateStr = new Date(event.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = new Date(event.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    const emoji = status === 'CONFIRMADO' ? '✅' : '❌'

    const message = `${emoji} *${status}*\n\n👤 ${event.clientName}\n📱 https://wa.me/${event.clientPhone?.replace(/\D/g, '')}\n📅 ${dateStr} às ${timeStr}\n🤖 ${agent.name}`

    try {
      await this.channelSend.send(channel, agent.leadDispatchPhone, message)
    } catch (err) {
      this.logger.error(`[reminder] Falha ao notificar equipe: ${err}`)
    }
  }

  private async getAgentChannel(agentId: string): Promise<Channel | null> {
    const channelAgent = await this.prisma.channelAgent.findFirst({
      where: { agentId, isActive: true },
      select: { channelId: true },
    })
    if (!channelAgent) return null

    const row = await this.prisma.channel.findUnique({ where: { id: channelAgent.channelId } })
    if (!row) return null

    return { id: row.id, name: row.name, type: row.type as any, config: row.config as any, status: row.status as any, createdAt: row.createdAt, updatedAt: row.updatedAt }
  }
}
