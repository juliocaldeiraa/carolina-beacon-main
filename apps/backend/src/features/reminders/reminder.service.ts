/**
 * ReminderService — Envia lembretes de agendamento via WhatsApp.
 *
 * Cron roda a cada 5 minutos e verifica agendamentos que precisam de lembrete.
 * Usa o channelSend pra enviar a mensagem pelo mesmo canal do agente.
 */

import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { ChannelSendService } from '@/infrastructure/channel-send/channel-send.service'
import type { Channel } from '@/core/entities/Channel'

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelSend: ChannelSendService,
  ) {}

  @Cron('*/5 * * * *')
  async checkReminders(): Promise<void> {
    // Buscar agentes com lembrete ativo
    const agents = await this.prisma.agent.findMany({
      where: {
        reminderEnabled: true,
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        reminderMinutes: true,
        reminderMessage: true,
        channelId: true,
      },
    })

    if (agents.length === 0) return

    for (const agent of agents) {
      const reminderMs = (agent.reminderMinutes ?? 120) * 60_000
      const now = new Date()
      const reminderWindowStart = new Date(now.getTime() + reminderMs - 5 * 60_000) // 5min de margem
      const reminderWindowEnd = new Date(now.getTime() + reminderMs + 5 * 60_000)

      // Buscar eventos que precisam de lembrete
      const events = await this.prisma.calendarEvent.findMany({
        where: {
          agentId: agent.id,
          status: 'scheduled',
          reminderSentAt: null,
          startTime: {
            gte: reminderWindowStart,
            lte: reminderWindowEnd,
          },
        },
      })

      if (events.length === 0) continue

      // Buscar canal do agente
      const channelAgent = await this.prisma.channelAgent.findFirst({
        where: { agentId: agent.id, isActive: true },
        select: { channelId: true },
      })

      if (!channelAgent) {
        this.logger.warn(`[reminder] Agente ${agent.name} sem canal ativo — lembretes não enviados`)
        continue
      }

      const channelRow = await this.prisma.channel.findUnique({
        where: { id: channelAgent.channelId },
      })

      if (!channelRow) continue

      const channel: Channel = {
        id: channelRow.id,
        name: channelRow.name,
        type: channelRow.type as any,
        config: channelRow.config as any,
      }

      for (const event of events) {
        if (!event.clientPhone) {
          this.logger.warn(`[reminder] Evento ${event.id} sem telefone — lembrete não enviado`)
          continue
        }

        // Montar mensagem
        const startDate = new Date(event.startTime)
        const dateStr = startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        const timeStr = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

        const defaultMessage = `Oi ${event.clientName}! Passando pra lembrar do seu agendamento amanha, dia ${dateStr} as ${timeStr}. Te esperamos!`

        const message = (agent.reminderMessage ?? defaultMessage)
          .replace(/\{nome\}/gi, event.clientName)
          .replace(/\{data\}/gi, dateStr)
          .replace(/\{hora\}/gi, timeStr)
          .replace(/\{horario\}/gi, timeStr)

        try {
          await this.channelSend.send(channel, event.clientPhone, message)
          await this.prisma.calendarEvent.update({
            where: { id: event.id },
            data: { reminderSentAt: new Date(), status: 'reminded' },
          })
          this.logger.log(`[reminder] Lembrete enviado para ${event.clientPhone} (evento ${event.id})`)
        } catch (err) {
          this.logger.error(`[reminder] Falha ao enviar lembrete para ${event.clientPhone}: ${err}`)
        }
      }
    }
  }
}
