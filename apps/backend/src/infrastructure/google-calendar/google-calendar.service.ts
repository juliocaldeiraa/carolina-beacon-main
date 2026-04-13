/**
 * GoogleCalendarService — OAuth2 + Calendar API
 *
 * Fluxo:
 * 1. getAuthUrl() → redireciona user para consent screen do Google
 * 2. handleCallback() → troca code por tokens, salva no DB
 * 3. getAvailableSlots() → consulta freebusy do Calendar
 * 4. createEvent() → cria evento no Calendar
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google, calendar_v3 } from 'googleapis'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name)

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  private getOAuth2Client() {
    return new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      this.config.get('GOOGLE_REDIRECT_URI'),
    )
  }

  // ─── OAuth Flow ───────────────────────────────────────────────────────────

  getAuthUrl(agentId: string, tenantId: string): string {
    const oauth2 = this.getOAuth2Client()
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt:      'consent',
      scope:       SCOPES,
      state:       JSON.stringify({ agentId, tenantId }),
    })
  }

  async handleCallback(code: string, state: string): Promise<{ agentId: string }> {
    const { agentId, tenantId } = JSON.parse(state)
    const oauth2 = this.getOAuth2Client()

    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Get calendar list to find primary
    const calendar = google.calendar({ version: 'v3', auth: oauth2 })
    const calList  = await calendar.calendarList.list()
    const primary  = calList.data.items?.find((c) => c.primary) ?? calList.data.items?.[0]

    // Upsert integration
    await this.prisma.googleCalendarIntegration.upsert({
      where:  { agentId },
      create: {
        tenantId,
        agentId,
        calendarId:   primary?.id ?? 'primary',
        calendarName: primary?.summary ?? 'Agenda Principal',
        accessToken:  tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        tokenExpiry:  new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      },
      update: {
        accessToken:  tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiry:  new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        calendarId:   primary?.id ?? 'primary',
        calendarName: primary?.summary ?? 'Agenda Principal',
      },
    })

    this.logger.log(`Google Calendar conectado para agente ${agentId}`)
    return { agentId }
  }

  // ─── Calendar Operations ──────────────────────────────────────────────────

  private async getAuthenticatedClient(agentId: string) {
    const integration = await this.prisma.googleCalendarIntegration.findUnique({
      where: { agentId },
    })
    if (!integration || !integration.isActive) {
      throw new NotFoundException('Google Calendar não configurado para este agente')
    }

    const oauth2 = this.getOAuth2Client()
    oauth2.setCredentials({
      access_token:  integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date:   integration.tokenExpiry.getTime(),
    })

    // Refresh if expired
    if (integration.tokenExpiry.getTime() < Date.now()) {
      const { credentials } = await oauth2.refreshAccessToken()
      await this.prisma.googleCalendarIntegration.update({
        where: { agentId },
        data: {
          accessToken: credentials.access_token!,
          tokenExpiry: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
        },
      })
      oauth2.setCredentials(credentials)
    }

    return { oauth2, integration }
  }

  async listCalendars(agentId: string) {
    const { oauth2 } = await this.getAuthenticatedClient(agentId)
    const calendar = google.calendar({ version: 'v3', auth: oauth2 })
    const res = await calendar.calendarList.list()
    return res.data.items?.map((c) => ({
      id:      c.id,
      summary: c.summary,
      primary: c.primary ?? false,
    })) ?? []
  }

  async getAvailableSlots(agentId: string, dateStr: string): Promise<string[]> {
    const { oauth2, integration } = await this.getAuthenticatedClient(agentId)
    const calendar = google.calendar({ version: 'v3', auth: oauth2 })

    const date     = new Date(dateStr + 'T00:00:00')
    const dayStart = new Date(dateStr + 'T08:00:00-03:00')  // 8h BRT
    const dayEnd   = new Date(dateStr + 'T18:00:00-03:00')  // 18h BRT

    // Get busy times
    const freebusy = await calendar.freebusy.query({
      requestBody: {
        timeMin:  dayStart.toISOString(),
        timeMax:  dayEnd.toISOString(),
        items:    [{ id: integration.calendarId }],
        timeZone: 'America/Sao_Paulo',
      },
    })

    const busy = freebusy.data.calendars?.[integration.calendarId]?.busy ?? []

    // Generate slots
    const slots: string[] = []
    const slotMs = integration.slotDuration * 60_000
    let current  = dayStart.getTime()

    while (current + slotMs <= dayEnd.getTime()) {
      const slotStart = current
      const slotEnd   = current + slotMs

      const isBusy = busy.some((b) => {
        const busyStart = new Date(b.start!).getTime()
        const busyEnd   = new Date(b.end!).getTime()
        return slotStart < busyEnd && slotEnd > busyStart
      })

      if (!isBusy) {
        const h = new Date(slotStart).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
        })
        slots.push(h)
      }

      current += slotMs
    }

    return slots
  }

  async createEvent(agentId: string, params: {
    date: string; time: string; name: string;
    phone?: string; email?: string; notes?: string;
  }): Promise<{ htmlLink: string; eventId: string }> {
    const { oauth2, integration } = await this.getAuthenticatedClient(agentId)
    const calendar = google.calendar({ version: 'v3', auth: oauth2 })

    // Usar formato ISO com timezone explícito para evitar problemas de UTC
    const startStr = `${params.date}T${params.time}:00-03:00`  // BRT
    const endStr   = (() => {
      const [h, m] = params.time.split(':').map(Number)
      const totalMin = h * 60 + m + integration.slotDuration
      const eh = String(Math.floor(totalMin / 60)).padStart(2, '0')
      const em = String(totalMin % 60).padStart(2, '0')
      return `${params.date}T${eh}:${em}:00-03:00`
    })()

    const title = integration.eventTitle
      .replace('{userName}', params.name)
      .replace('{userPhone}', params.phone ?? '')

    const description = [
      `Nome: ${params.name}`,
      params.phone ? `Telefone: ${params.phone}` : '',
      params.email ? `Email: ${params.email}` : '',
      params.notes ? `\nObservações: ${params.notes}` : '',
      '\n--- Agendado via Beacon AI ---',
    ].filter(Boolean).join('\n')

    const eventBody: calendar_v3.Schema$Event = {
      summary:     title,
      description,
      start:       { dateTime: startStr, timeZone: 'America/Sao_Paulo' },
      end:         { dateTime: endStr,  timeZone: 'America/Sao_Paulo' },
    }

    if (integration.googleMeet) {
      eventBody.conferenceData = {
        createRequest: {
          requestId:             `beacon-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    const res = await calendar.events.insert({
      calendarId:           integration.calendarId,
      requestBody:          eventBody,
      conferenceDataVersion: integration.googleMeet ? 1 : 0,
    })

    this.logger.log(`Evento criado: ${res.data.htmlLink}`)

    return {
      htmlLink: res.data.htmlLink ?? '',
      eventId:  res.data.id ?? '',
    }
  }

  async getIntegration(agentId: string) {
    return this.prisma.googleCalendarIntegration.findUnique({ where: { agentId } })
  }

  async updateConfig(agentId: string, config: {
    calendarId?: string; calendarName?: string; slotDuration?: number;
    googleMeet?: boolean; eventTitle?: string; collectName?: boolean;
    collectEmail?: boolean; collectPhone?: boolean; sendSummary?: boolean;
    consultHours?: boolean; restrictFull?: boolean;
  }) {
    return this.prisma.googleCalendarIntegration.update({
      where: { agentId },
      data: config,
    })
  }

  async disconnect(agentId: string) {
    await this.prisma.googleCalendarIntegration.delete({ where: { agentId } }).catch(() => {})
  }
}
