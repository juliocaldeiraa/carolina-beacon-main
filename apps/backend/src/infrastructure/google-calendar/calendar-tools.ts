/**
 * Calendar Tools — Tool definitions + executor para o agente IA
 *
 * Duas tools:
 * 1. check_available_slots — consulta horários livres
 * 2. create_appointment — cria evento no Calendar
 */

import type { AiTool } from '@/infrastructure/ai-engine/ai-engine.service'
import type { GoogleCalendarService } from './google-calendar.service'

export const CALENDAR_TOOLS: AiTool[] = [
  {
    name: 'check_available_slots',
    description: 'Consulta horários disponíveis na agenda do profissional para uma data específica. Use quando o cliente perguntar sobre disponibilidade.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Data no formato YYYY-MM-DD (ex: 2026-04-15)' },
      },
      required: ['date'],
    },
  },
  {
    name: 'create_appointment',
    description: 'Cria um agendamento na agenda do profissional. Use APENAS após confirmar data, horário e nome com o cliente.',
    input_schema: {
      type: 'object',
      properties: {
        date:  { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        time:  { type: 'string', description: 'Horário no formato HH:MM (ex: 14:30)' },
        name:  { type: 'string', description: 'Nome completo do cliente' },
        phone: { type: 'string', description: 'Telefone do cliente (opcional)' },
        email: { type: 'string', description: 'Email do cliente (opcional)' },
        notes: { type: 'string', description: 'Observações adicionais (opcional)' },
      },
      required: ['date', 'time', 'name'],
    },
  },
]

export const CALENDAR_SYSTEM_PROMPT = `
Você tem acesso à agenda do profissional via ferramentas. Use-as quando o cliente:
- Perguntar sobre horários disponíveis → use check_available_slots
- Quiser agendar → colete nome, data e horário preferido, depois use create_appointment
- Sempre confirme os dados com o cliente ANTES de agendar
- Apresente os horários de forma amigável (ex: "Temos disponível às 09:00, 10:00 e 14:30")
- Após agendar, confirme o agendamento com os detalhes
`.trim()

export async function executeCalendarTool(
  toolName: string,
  input: any,
  agentId: string,
  calendarService: GoogleCalendarService,
): Promise<string> {
  try {
    if (toolName === 'check_available_slots') {
      const slots = await calendarService.getAvailableSlots(agentId, input.date)
      if (slots.length === 0) {
        return JSON.stringify({
          available: false,
          message: 'Não há horários disponíveis nesta data.',
        })
      }
      return JSON.stringify({
        available: true,
        date:  input.date,
        slots,
        count: slots.length,
      })
    }

    if (toolName === 'create_appointment') {
      const event = await calendarService.createEvent(agentId, {
        date:  input.date,
        time:  input.time,
        name:  input.name,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      })
      return JSON.stringify({
        success:   true,
        eventLink: event.htmlLink,
        message:   `Agendamento criado com sucesso para ${input.date} às ${input.time}.`,
      })
    }

    return JSON.stringify({ error: `Tool "${toolName}" não encontrada` })
  } catch (err: any) {
    return JSON.stringify({ error: err?.message ?? 'Erro ao executar tool' })
  }
}
