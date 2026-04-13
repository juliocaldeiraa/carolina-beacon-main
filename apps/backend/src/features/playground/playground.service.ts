/**
 * PlaygroundService — Sessões de teste não persistidas
 *
 * Simula EXATAMENTE o fluxo de produção (WebhookIngestionService).
 * Suporta 3 modos de teste:
 *   - Agente: chat direto com um agente
 *   - Disparo: simula lead respondendo a uma campanha
 *   - Automação: simula lead respondendo a uma automação
 *
 * Contexto inicial (disparo/automação) é pré-semeado na sessão como
 * mensagens "assistant" (igual ao que o lead receberia na produção).
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { AiEngineService }        from '@/infrastructure/ai-engine/ai-engine.service'
import type { ChatMessage }       from '@/infrastructure/ai-engine/ai-engine.service'
import { MessageSplitterService } from '@/infrastructure/ai-engine/message-splitter.service'
import { PrismaService }          from '@/infrastructure/database/prisma/prisma.service'
import { IAgentRepository, AGENT_REPOSITORY } from '@/core/repositories/IAgentRepository'
import { buildEnrichedSystemPrompt } from '@/core/entities/Agent'
import { GoogleCalendarService }  from '@/infrastructure/google-calendar/google-calendar.service'
import { TrainingsService }       from '@/features/agents/trainings.service'
import { CALENDAR_TOOLS, getCalendarSystemPrompt, executeCalendarTool } from '@/infrastructure/google-calendar/calendar-tools'

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  metadata?: {
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    model?: string
  }
  timestamp: string
}

// ─── Tipos de retorno para listagens ──────────────────────────────────────────

export interface PlaygroundBroadcast {
  id: string
  name: string
  template: string
  agentId: string | null
  agentName: string | null
  status: string
}

export interface PlaygroundAutomation {
  id: string
  name: string
  linkedAgentId: string | null
  agentName: string | null
  messageTemplates: string[]
  status: string
}

@Injectable()
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name)
  private readonly sessions = new Map<string, SessionMessage[]>()

  constructor(
    private readonly aiEngine:  AiEngineService,
    private readonly splitter:  MessageSplitterService,
    private readonly prisma:    PrismaService,
    @Inject(AGENT_REPOSITORY) private readonly agentRepo: IAgentRepository,
    private readonly calendarService: GoogleCalendarService,
    private readonly trainingsService: TrainingsService,
  ) {}

  // ─── Gerenciamento de sessão ──────────────────────────────────────────────

  /**
   * Cria sessão opcionalmente pré-semeada com mensagens de contexto.
   * Usado por Disparo e Automação para injetar o que foi "enviado ao lead".
   */
  createSession(contextMessages: SessionMessage[] = []): string {
    const id = randomUUID()
    this.sessions.set(id, contextMessages)
    return id
  }

  clearSession(sessionId: string): void {
    this.sessions.set(sessionId, [])
  }

  // ─── Chat principal ───────────────────────────────────────────────────────

  async chat(agentId: string, sessionId: string, message: string, model?: string) {
    const agent = await this.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundException('Agente não encontrado')

    const history = this.sessions.get(sessionId) ?? []

    // Verifica limite de trocas (igual ao webhook ingestion)
    if (agent.limitTurns && agent.maxTurns > 0) {
      const userMsgs = history.filter((m) => m.role === 'user').length
      if (userMsgs >= agent.maxTurns) {
        return {
          messages: ['[Conversa encerrada: limite de trocas atingido]'],
          metadata: { latencyMs: 0, inputTokens: 0, outputTokens: 0, model: model ?? agent.model },
          session:  history,
          closed:   true,
        }
      }
    }

    const chatHistory: ChatMessage[] = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ]

    const resolvedModel = model ?? agent.model
    // Monta system prompt enriquecido
    let trainingsByCategory: Record<string, Array<{ title?: string; content: string }>> = {}
    try { trainingsByCategory = await this.trainingsService.getTrainingsByCategory(agentId) } catch {}

    let calendarIntegration: any = null
    try { calendarIntegration = await this.calendarService.getIntegration(agentId) } catch {}

    const systemPrompt = buildEnrichedSystemPrompt({
      agent,
      trainingsByCategory,
      calendarPrompt: calendarIntegration?.isActive ? getCalendarSystemPrompt() : undefined,
    })

    const tools = calendarIntegration?.isActive ? CALENDAR_TOOLS : undefined
    const onToolCall = calendarIntegration?.isActive
      ? (toolName: string, input: any) => executeCalendarTool(toolName, input, agentId, this.calendarService, this.prisma)
      : undefined

    // Chama IA principal
    let result: Awaited<ReturnType<AiEngineService['complete']>>
    try {
      result = await this.aiEngine.complete({
        messages:    chatHistory,
        systemPrompt: systemPrompt || undefined,
        model:       resolvedModel,
        temperature: agent.temperature,
        maxTokens:   agent.maxTokens,
        tools,
        onToolCall,
      })
    } catch (err) {
      this.logger.error(`Playground: IA falhou — ${err}`)
      const fallbackMsg = agent.fallbackEnabled && agent.fallbackMessage
        ? agent.fallbackMessage
        : null
      history.push({ role: 'user', content: message, timestamp: new Date().toISOString() })
      this.sessions.set(sessionId, history)
      return {
        messages: fallbackMsg ? [fallbackMsg] : ['[Erro: IA indisponível]'],
        metadata: { latencyMs: 0, inputTokens: 0, outputTokens: 0, model: resolvedModel },
        session:  history,
        error:    true,
      }
    }

    // Fatia resposta via IA Central
    const splitMsgs = await this.splitter.split(result.content)

    // Persiste com resposta COMPLETA (contexto correto para a próxima troca)
    history.push({ role: 'user',      content: message,        timestamp: new Date().toISOString() })
    history.push({
      role:      'assistant',
      content:   result.content,
      timestamp: new Date().toISOString(),
      metadata:  {
        latencyMs:    result.latencyMs,
        inputTokens:  result.inputTokens,
        outputTokens: result.outputTokens,
        model:        resolvedModel,
      },
    })
    this.sessions.set(sessionId, history)

    // Persistir no banco para supervisão (feedback loop)
    this.persistConversation(agentId, sessionId, message, result).catch(() => {})

    return {
      messages: splitMsgs,
      metadata: {
        latencyMs:    result.latencyMs,
        inputTokens:  result.inputTokens,
        outputTokens: result.outputTokens,
        model:        resolvedModel,
      },
      session: history,
    }
  }

  // ─── Persistência para feedback loop ──────────────────────────────────────

  private async persistConversation(
    agentId: string,
    sessionId: string,
    userMessage: string,
    aiResult: { content: string; inputTokens?: number; outputTokens?: number; latencyMs?: number },
  ) {
    const tenantId = process.env.DEFAULT_TENANT_ID!

    // FindOrCreate conversa do playground usando sessionId como contactPhone
    let conv = await this.prisma.conversation.findFirst({
      where: { agentId, channelId: 'PLAYGROUND', contactPhone: sessionId },
    })

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          tenantId,
          agentId,
          channelId: 'PLAYGROUND',
          contactPhone: sessionId,
          contactName: 'Playground',
          status: 'OPEN',
        },
      })
    }

    // Salvar mensagens
    await this.prisma.message.createMany({
      data: [
        { conversationId: conv.id, role: 'USER', content: userMessage },
        {
          conversationId: conv.id,
          role: 'ASSISTANT',
          content: aiResult.content,
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          latencyMs: aiResult.latencyMs,
        },
      ],
    })

    // Atualizar contadores
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: {
        turns: { increment: 1 },
        lastMessageAt: new Date(),
      },
    })
  }

  // ─── Listagens para seleção no playground ────────────────────────────────

  async getBroadcasts(): Promise<PlaygroundBroadcast[]> {
    const tenantId = process.env.DEFAULT_TENANT_ID!
    const rows = await this.prisma.broadcast.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })

    // Busca nomes dos agentes em batch
    const agentIds = [...new Set(rows.map((r) => r.agentId).filter(Boolean))] as string[]
    const agents = agentIds.length > 0
      ? await this.prisma.agent.findMany({ where: { id: { in: agentIds }, deletedAt: null } })
      : []
    const agentMap = new Map(agents.map((a) => [a.id, a.name]))

    return rows.map((r) => ({
      id:        r.id,
      name:      r.name,
      template:  r.template,
      agentId:   r.agentId ?? null,
      agentName: r.agentId ? (agentMap.get(r.agentId) ?? null) : null,
      status:    r.status,
    }))
  }

  async getAutomations(): Promise<PlaygroundAutomation[]> {
    const tenantId = process.env.DEFAULT_TENANT_ID!
    const rows = await this.prisma.automation.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })

    const agentIds = [...new Set(rows.map((r) => r.linkedAgentId).filter(Boolean))] as string[]
    const agents = agentIds.length > 0
      ? await this.prisma.agent.findMany({ where: { id: { in: agentIds }, deletedAt: null } })
      : []
    const agentMap = new Map(agents.map((a) => [a.id, a.name]))

    return rows.map((r) => {
      // messageTemplates é Json[] — normaliza para string[]
      const templates: string[] = Array.isArray(r.messageTemplates)
        ? (r.messageTemplates as unknown[])
            .map((t) => (typeof t === 'string' ? t : ''))
            .filter(Boolean)
        : r.messageTemplate
          ? [r.messageTemplate]
          : []

      return {
        id:               r.id,
        name:             r.name,
        linkedAgentId:    r.linkedAgentId ?? null,
        agentName:        r.linkedAgentId ? (agentMap.get(r.linkedAgentId) ?? null) : null,
        messageTemplates: templates,
        status:           r.status,
      }
    })
  }
}
