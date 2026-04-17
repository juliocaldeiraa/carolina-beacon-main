/**
 * WebhookIngestionService — Orquestra o loop conversacional inbound
 *
 * Fluxo (n8n-inspired):
 * 1.  Parse payload → { phone, name, text, type }
 * 2.  Verificar atendimento humano (humanTakeover flag na conversa)
 * 3.  Message debounce (DEBOUNCE_MS): coleta msgs rápidas consecutivas
 * 4.  Busca agente vinculado ao canal (via ChannelAgent)
 * 5.  FindOrCreate Conversa
 * 6.  Salva Mensagem USER
 * 7.  Verifica limite de trocas
 * 8.  Chama AiEngineService
 * 9.  Fallback se erro
 * 10. Fatia resposta via MessageSplitterService
 * 11. Salva resposta COMPLETA como ASSISTANT
 * 12. Envia cada fragmento via ChannelSendService
 *
 * Cada etapa é rastreada na tabela ingestion_logs para diagnóstico.
 */

import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService }          from '@/infrastructure/database/prisma/prisma.service'
import { AiEngineService }        from '@/infrastructure/ai-engine/ai-engine.service'
import { MessageSplitterService } from '@/infrastructure/ai-engine/message-splitter.service'
import { ChannelSendService }     from '@/infrastructure/channel-send/channel-send.service'
import { ContactsService }        from '@/features/contacts/contacts.service'
import { AutomationReplyHandlerService } from '@/features/automations/automation-reply-handler.service'
import { CampaignInboundService } from '@/features/campaigns/campaign-inbound.service'
import { TrainingsService } from '@/features/agents/trainings.service'
import { GoogleCalendarService } from '@/infrastructure/google-calendar/google-calendar.service'
import { CALENDAR_TOOLS, getCalendarSystemPrompt, executeCalendarTool } from '@/infrastructure/google-calendar/calendar-tools'
import { MediaProcessingService } from '@/infrastructure/media/media-processing.service'
import { ReminderService } from '@/features/reminders/reminder.service'
import { WhatsAppCrmService } from '@/features/crm/whatsapp-crm.service'
import { parseWebhookPayload }    from './webhook-ingestion.parser'
import { buildEnrichedSystemPrompt } from '@/core/entities/Agent'
import { brPhoneVariants }        from '@/shared/utils/phone.utils'
import type { Channel, ChannelType, ChannelConfig } from '@/core/entities/Channel'

const FRAGMENT_DELAY_MS      = 1500  // delay entre fragmentos (ms)
const AUTOMATION_SEND_DELAY  = 800   // delay inicial antes do 1º fragmento (apenas automações)
const DEBOUNCE_MS            = 3_000 // 3s — padrão para Chat IA passivo sem ChannelAgent
const AUTOMATION_DEBOUNCE_MS = 8_000 // 8s — padrão para automações sem debounceMs configurado

// ─── Limites de segurança ────────────────────────────────────────────────────
const MAX_MESSAGE_CHARS    = 4_000  // trunca mensagens gigantes antes de enviar à IA
const RATE_LIMIT_WINDOW_MS = 60_000 // janela de rate limit (1 min)
const RATE_LIMIT_MAX_MSGS  = 15     // máx msgs por número por janela
const AI_TIMEOUT_MS        = 30_000 // timeout máximo de chamada à IA (30s)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${ms}ms: ${label}`)), ms),
    ),
  ])
}

async function withRetry<T>(fn: () => Promise<T>, delaysMs: number[]): Promise<T> {
  let lastErr: unknown
  for (const delay of [0, ...delaysMs]) {
    if (delay > 0) await sleep(delay)
    try { return await fn() } catch (err) { lastErr = err }
  }
  throw lastErr
}

interface DebounceEntry {
  timer:   ReturnType<typeof setTimeout>
  texts:   string[]
  name:    string
  channel: Channel
  logId:   string  // ID do ingestion_log criado no 1º recebimento
  tl:      any     // test lead pré-buscado — evita re-lookup e viabiliza effectiveDebounceMs correto
  auto:    any     // automation pré-buscada — idem
}

interface RateLimitEntry {
  count:       number
  windowStart: number
}

@Injectable()
export class WebhookIngestionService {
  private readonly logger   = new Logger(WebhookIngestionService.name)
  private get tenantId()    { return process.env.DEFAULT_TENANT_ID! }

  private readonly debounce   = new Map<string, DebounceEntry>()
  private readonly rateLimits = new Map<string, RateLimitEntry>()

  constructor(
    private readonly prisma:       PrismaService,
    private readonly aiEngine:     AiEngineService,
    private readonly splitter:     MessageSplitterService,
    private readonly channelSend:  ChannelSendService,
    private readonly contacts:     ContactsService,
    private readonly automationReplyHandler: AutomationReplyHandlerService,
    private readonly campaignInbound: CampaignInboundService,
    private readonly trainingsService: TrainingsService,
    private readonly calendarService: GoogleCalendarService,
    private readonly mediaProcessing: MediaProcessingService,
    private readonly reminderService: ReminderService,
    private readonly whatsappCrm: WhatsAppCrmService,
  ) {}

  // ─── Helpers de log ─────────────────────────────────────────────────────────

  private async createLog(data: {
    channelId?: string; channelName?: string
    contactPhone?: string; contactName?: string
    messagePreview?: string; status: string
    step?: string; errorMsg?: string; model?: string; latencyMs?: number
    messageId?: string | null
  }): Promise<string> {
    try {
      const log = await this.prisma.ingestionLog.create({
        data: { tenantId: this.tenantId, ...data },
      })
      return log.id
    } catch {
      return ''
    }
  }

  private updateLog(id: string, data: {
    status?: string; step?: string; errorMsg?: string
    model?: string; latencyMs?: number
    contactPhone?: string; contactName?: string; messagePreview?: string
  }): void {
    if (!id) return
    this.prisma.ingestionLog.update({ where: { id }, data })
      .catch((err) => this.logger.error(`[updateLog] falhou id=${id}: ${err?.message}`))
  }

  // ─── Ingest ──────────────────────────────────────────────────────────────────

  async ingest(channelId: string, payload: unknown, initialLogId?: string): Promise<void> {
    // 1. Busca canal
    const channelRow = await this.prisma.channel.findUnique({ where: { id: channelId } })
    if (!channelRow) {
      this.logger.warn(`Canal ${channelId} não encontrado`)
      this.createLog({ channelId, status: 'no_channel', step: 'channel_lookup', errorMsg: 'Canal não encontrado no banco' })
      return
    }

    const channel: Channel = {
      id:        channelRow.id,
      name:      channelRow.name,
      type:      channelRow.type as ChannelType,
      status:    channelRow.status as Channel['status'],
      config:    (channelRow.config ?? {}) as ChannelConfig,
      createdAt: channelRow.createdAt,
      updatedAt: channelRow.updatedAt,
    }

    // 2. Parse payload
    const parsed = parseWebhookPayload(channel.type, payload)
    if (!parsed) {
      // Não loga parse_error para eventos do sistema (connection update, etc.)
      this.logger.debug(`Payload ignorado (canal ${channel.name}) — fromMe ou evento não-mensagem`)
      // Atualiza o log criado pelo controller com o canal correto
      return
    }

    // 2a. Deduplicação — Evolution re-entrega o mesmo webhook quando não recebe 200 a tempo
    if (parsed.messageId) {
      const dup = await this.prisma.ingestionLog.findFirst({
        where:  { messageId: parsed.messageId },
        select: { id: true },
      })
      if (dup) {
        this.logger.debug(`[ingest] webhook duplicado ignorado messageId=${parsed.messageId}`)
        return
      }
    }

    const { phone, name, isGroup } = parsed
    let { text } = parsed

    // ── Media processing: transcreve audio e analisa imagem ─────────────────────
    if (parsed.type === 'audio' && (parsed.mediaBase64 || parsed.mediaUrl)) {
      try {
        const transcription = await this.mediaProcessing.transcribeAudio(parsed.mediaBase64, parsed.mediaUrl, parsed.mediaMime)
        if (transcription) {
          text = transcription
          this.logger.log(`[media] Audio transcrito para ${phone}: "${transcription.slice(0, 60)}..."`)
        }
      } catch (err) {
        this.logger.warn(`[media] Falha ao transcrever audio de ${phone}: ${err}`)
      }
    }

    if (parsed.type === 'image' && (parsed.mediaBase64 || parsed.mediaUrl)) {
      try {
        const caption = parsed.text.replace('[Imagem recebida]', '').trim() || undefined
        const description = await this.mediaProcessing.analyzeImage(parsed.mediaBase64, parsed.mediaUrl, parsed.mediaMime, caption)
        if (description) {
          text = caption
            ? `[Cliente enviou imagem: ${description}] Legenda: ${caption}`
            : `[Cliente enviou imagem: ${description}]`
          this.logger.log(`[media] Imagem analisada de ${phone}: "${description.slice(0, 60)}..."`)
        }
      } catch (err) {
        this.logger.warn(`[media] Falha ao analisar imagem de ${phone}: ${err}`)
      }
    }

    // ── Segurança 1: número malformado ──────────────────────────────────────────
    const phoneClean = phone.replace(/[^0-9@._\-]/g, '')
    if (phoneClean.length < 8) {
      this.logger.warn(`[segurança] número inválido ignorado: "${phone}"`)
      return
    }

    // ── Segurança 2: mensagem vazia ──────────────────────────────────────────────
    if (!text.trim()) {
      this.logger.debug(`[segurança] mensagem vazia ignorada (${phone})`)
      return
    }

    // ── Segurança 3: mensagem gigante — trunca em MAX_MESSAGE_CHARS ─────────────
    if (text.length > MAX_MESSAGE_CHARS) {
      this.logger.warn(`[segurança] mensagem de ${phone} truncada: ${text.length} → ${MAX_MESSAGE_CHARS} chars`)
      text = text.substring(0, MAX_MESSAGE_CHARS) + '\n[mensagem truncada por excesso de tamanho]'
    }

    // ── Segurança 4: rate limit por número ──────────────────────────────────────
    const now = Date.now()
    const rl  = this.rateLimits.get(phone)
    if (rl && now - rl.windowStart < RATE_LIMIT_WINDOW_MS) {
      rl.count++
      if (rl.count > RATE_LIMIT_MAX_MSGS) {
        this.logger.warn(`[segurança] rate limit atingido para ${phone} (${rl.count} msgs/min) — ignorando`)
        return
      }
    } else {
      this.rateLimits.set(phone, { count: 1, windowStart: now })
    }
    // Limpa entradas antigas da memória (a cada 500 entradas)
    if (this.rateLimits.size > 500) {
      for (const [key, val] of this.rateLimits) {
        if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) this.rateLimits.delete(key)
      }
    }

    this.logger.log(`Inbound [${channel.name}] ${phone} (${name}): "${text.substring(0, 60)}"`)

    // 2b. Verificar filtros do ChannelAgent (grupos, gatilhos) antes de criar log
    const channelAgentFilters = await this.prisma.channelAgent.findFirst({
      where:  { channelId, tenantId: this.tenantId, isActive: true },
      select: { allowGroups: true, triggerMode: true, triggerKeywords: true, debounceMs: true },
    })

    // Filtro de grupos: bloqueia sempre, exceto quando há ChannelAgent explicitamente
    // configurado com allowGroups=true. Automações (sem ChannelAgent) nunca devem
    // responder a grupos.
    if (isGroup && (!channelAgentFilters || !channelAgentFilters.allowGroups)) {
      this.logger.debug(`Mensagem de grupo ignorada [${phone}] — allowGroups não permitido`)
      if (initialLogId) {
        this.prisma.ingestionLog.update({
          where: { id: initialLogId },
          data:  { status: 'ignored_group', step: 'group_filter', channelId, channelName: channel.name },
        }).catch(() => {})
      }
      return
    }

    // Atualiza o log inicial do controller (já tem rawPayload) ou cria novo
    const logData = {
      channelId,
      channelName:    channel.name,
      contactPhone:   phone,
      contactName:    name,
      messagePreview: text.substring(0, 120),
      status:         'received',
      messageId:      parsed.messageId ?? null,
    }
    const logId = initialLogId
      ? await this.prisma.ingestionLog.update({ where: { id: initialLogId }, data: logData })
          .then(() => initialLogId)
          .catch(() => this.createLog(logData))
      : await this.createLog(logData)

    // 2c. Verificar se é resposta a lembrete de agendamento (antes de humanTakeover)
    try {
      const agentForReminder = await this.prisma.channelAgent.findFirst({
        where: { channelId, isActive: true },
        select: { agentId: true },
      })
      if (agentForReminder) {
        const isReminderReply = await this.reminderService.handleConfirmationReply(agentForReminder.agentId, phone, text, channel)
        if (isReminderReply) {
          this.logger.log(`[reminder] Resposta de confirmação processada para ${phone}`)
          this.updateLog(logId, { status: 'completed', step: 'reminder_confirmation' })
          return
        }
      }
    } catch {}

    // 3. Atendimento humano — verificado antes do debounce para resposta imediata
    const existingConv = await this.prisma.conversation.findFirst({
      where: { channelId, contactPhone: phone, tenantId: this.tenantId, status: 'OPEN' },
    })
    if (existingConv?.humanTakeover) {
      this.logger.debug(`Conversa ${existingConv.id} em atendimento humano — salva msg sem IA`)
      this.updateLog(logId, { status: 'human_takeover', step: 'human_takeover_check' })
      await this.prisma.message.create({
        data: { conversationId: existingConv.id, role: 'USER', content: text },
      })
      await this.prisma.conversation.update({
        where: { id: existingConv.id },
        data:  { lastMessageAt: new Date(), contactName: name },
      })
      return
    }

    // 3b. Campaign lead reply — marca REPLIED, cancela follow-ups, aciona agente IA se vinculado (non-blocking)
    this.campaignInbound.handleReply(phone, channelId, text, name).catch((err) => {
      this.logger.debug(`[campaign-inbound] handleReply falhou para ${phone}: ${err?.message}`)
    })

    // 4. Debounce — coleta msgs rápidas para TODOS os paths (automação + Chat IA)
    //    A decisão de roteamento (automação vs Chat IA) ocorre APÓS o silêncio,
    //    garantindo que "sim\nli\nmuito legal" se torne UMA chamada de IA.
    //
    //    FIX arquitetural: tl + auto são buscados ANTES de criar o timer para que
    //    effectiveDebounceMs possa honrar automation.debounceMs corretamente.
    //    Nas msgs subsequentes da mesma janela, reutilizamos os valores do entry
    //    (sem novo round-trip ao banco).
    const key   = `${channelId}:${phone}`
    const entry = this.debounce.get(key)

    if (entry) {
      clearTimeout(entry.timer)
      entry.texts.push(text)
      entry.name = name
    }

    // Lookup tl + auto apenas na 1ª mensagem da janela
    let tl   = entry?.tl   ?? null
    let auto = entry?.auto ?? null
    if (!entry) {
      const pv = brPhoneVariants(phone)
      tl = await this.prisma.leadManyInsta.findFirst({
        where:  { status: 'teste', OR: pv.flatMap((p) => [{ whatsappLimpo: p }, { whatsapp: p }]) },
        select: { id: true, nome: true, campanha: true, mensagemEnviada: true },
      })
      if (tl) {
        // Lead de teste: prefere automação com linkedAgentId (fluxo de IA) —
        // necessário quando há múltiplas automações no canal
        auto = await this.prisma.automation.findFirst({
          where: {
            linkedAgentId: { not: null },
            OR: [{ channelId }, { primaryChannelId: channelId }, { fallbackChannelIds: { array_contains: channelId } }],
          },
        }) ?? await this.prisma.automation.findFirst({
          where: { OR: [{ channelId }, { primaryChannelId: channelId }, { fallbackChannelIds: { array_contains: channelId } }] },
        })
      } else {
        auto = await this.prisma.automation.findFirst({
          where: {
            status: 'ACTIVE',
            OR: [{ channelId }, { primaryChannelId: channelId }, { fallbackChannelIds: { array_contains: channelId } }],
          },
        })
      }
    }

    // Prioridade: ChannelAgent.debounceMs → automation.debounceMs → AUTOMATION_DEBOUNCE_MS (auto) → DEBOUNCE_MS
    const effectiveDebounceMs =
      channelAgentFilters?.debounceMs
      ?? (auto as any)?.debounceMs
      ?? (auto ? AUTOMATION_DEBOUNCE_MS : DEBOUNCE_MS)

    const texts      = entry ? entry.texts : [text]
    const firstLogId = entry ? entry.logId : logId
    const timer = setTimeout(async () => {
      this.debounce.delete(key)
      const combined = texts.join('\n')

      try {
        await this.prisma.ingestionLog.update({
          where: { id: firstLogId },
          data: { status: 'processing', step: 'debounce_fired' },
        })
      } catch (e) {
        this.logger.error(`[debounce] updateLog processing falhou [${key}]: ${e}`)
      }

      try {
        // 4a. Automação tem prioridade TOTAL — usa tl+auto pré-buscados na closure (sem re-lookup)
        // automationReplyHandler centraliza: CRM, status do lead, opt-out, handoff, linkedAgentId
        if (auto) {
          this.updateLog(firstLogId, { status: 'automation', step: 'automation_intercept' })
          await this.automationReplyHandler.handleReply(channelId, phone, combined)
          return
        }

        // 4b. Chat IA — aplica filtro de palavra-chave antes de processar
        if (channelAgentFilters?.triggerMode === 'keywords') {
          const keywords   = (channelAgentFilters.triggerKeywords as string[]) ?? []
          const combinedLo = combined.toLowerCase()
          const triggered  = keywords.some((kw) => combinedLo.includes(kw.toLowerCase().trim()))
          if (!triggered) {
            this.logger.debug(`Mensagem de ${phone} ignorada — nenhuma palavra-chave encontrada`)
            this.updateLog(firstLogId, { status: 'ignored_trigger', step: 'keyword_filter' })
            return
          }
        }

        await withRetry(
          () => this.processMessage(channelId, phone, name, combined, channel, firstLogId),
          [3_000, 8_000],
        )
      } catch (err) {
        this.logger.error(`[debounce] pipeline falhou [${key}]: ${err}`)
        try {
          await this.prisma.ingestionLog.update({
            where: { id: firstLogId },
            data: { status: 'failed', step: 'process_error', errorMsg: String(err) },
          })
        } catch (e2) {
          this.logger.error(`[debounce] updateLog failed também falhou [${key}]: ${e2}`)
        }
      }
    }, effectiveDebounceMs)

    this.debounce.set(key, { timer, texts, name, channel, logId: firstLogId, tl, auto })

    if (entry) {
      this.updateLog(logId, { status: 'debounced', step: 'debounce_merge' })
    }
  }

  // ─── Process ─────────────────────────────────────────────────────────────────

  // Exposto para o endpoint de diagnóstico
  async runProcessMessage(
    channelId: string,
    phone:     string,
    name:      string,
    text:      string,
    channel:   Channel,
    logId:     string,
  ): Promise<void> {
    return this.processMessage(channelId, phone, name, text, channel, logId)
  }

  private async processMessage(
    channelId:     string,
    phone:         string,
    name:          string,
    text:          string,
    channel:       Channel,
    logId:         string,
    agentOverride?: { agentId: string; automationId?: string; extraSystemCtx?: string; sendDelayMs?: number; fragmentDelayMs?: number; modelOverride?: string },
  ): Promise<void> {
    const startMs = Date.now()

    // 1. Busca agente — usa override de automação ou busca via ChannelAgent
    let channelAgentRow: Awaited<ReturnType<typeof this.prisma.channelAgent.findFirst>> = null
    let agentRow: Awaited<ReturnType<typeof this.prisma.agent.findFirst>>

    if (agentOverride?.agentId) {
      agentRow = await this.prisma.agent.findFirst({ where: { id: agentOverride.agentId, deletedAt: null } })
      // Busca channelAgent do canal para aplicar sendDelayMs / fragmentDelayMs configurados
      channelAgentRow = await this.prisma.channelAgent.findFirst({
        where: { channelId, tenantId: this.tenantId, isActive: true },
      })
    } else {
      channelAgentRow = await this.prisma.channelAgent.findFirst({
        where: { channelId, tenantId: this.tenantId, isActive: true },
      })
      agentRow = channelAgentRow
        ? await this.prisma.agent.findFirst({ where: { id: channelAgentRow.agentId, deletedAt: null } })
        : await this.prisma.agent.findFirst({ where: { channelId, deletedAt: null, status: 'ACTIVE', tenantId: this.tenantId } })
    }

    if (!agentRow) {
      this.logger.debug(`Canal ${channelId} sem agente ACTIVE vinculado`)
      this.updateLog(logId, { status: 'no_agent', step: 'agent_lookup', errorMsg: 'Nenhum agente ativo vinculado ao canal' })
      return
    }

    // Prioridade: automation.aiModel → agentRow.model → channelAgentRow.llmModel
    // channelAgent.llmModel só se aplica ao Chat IA passivo (sem agentOverride)
    const resolvedModel = agentOverride?.modelOverride
      ?? (agentOverride?.agentId ? agentRow.model : (channelAgentRow?.llmModel ?? agentRow.model))

    // 2. FindOrCreate conversa — scoped por agentId para isolar automações do Chat IA
    // Verifica variantes do número (com/sem 9º dígito) para compatibilidade com Evolution API
    const convPhoneVariants = brPhoneVariants(phone)
    let conv = await this.prisma.conversation.findFirst({
      where: { channelId, contactPhone: { in: convPhoneVariants }, agentId: agentRow.id, tenantId: this.tenantId, status: 'OPEN' },
    })

    // Fallback cross-canal: se o número foi migrado (ex: JRWHATS001 caiu → JRWHATS002),
    // reutiliza a conversa existente de qualquer canal para preservar o histórico completo.
    if (!conv) {
      const crossChanConv = await this.prisma.conversation.findFirst({
        where: { contactPhone: { in: convPhoneVariants }, agentId: agentRow.id, tenantId: this.tenantId, status: 'OPEN' },
        orderBy: { lastMessageAt: 'desc' },
      })
      if (crossChanConv && crossChanConv.channelId !== channelId) {
        conv = await this.prisma.conversation.update({
          where: { id: crossChanConv.id },
          data:  { channelId },
        })
        this.logger.log(`[conv] migrou conversa ${conv.id} do canal ${crossChanConv.channelId} → ${channelId}`)
      }
    }

    // Re-checa humanTakeover (pode ter mudado durante o debounce)
    if (conv?.humanTakeover) {
      this.updateLog(logId, { status: 'human_takeover', step: 'human_takeover_check' })
      await this.prisma.message.create({
        data: { conversationId: conv.id, role: 'USER', content: text },
      })
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data:  { lastMessageAt: new Date(), contactName: name },
      })
      return
    }

    // Verificar se é resposta a lembrete de agendamento
    try {
      const isReminderReply = await this.reminderService.handleConfirmationReply(agentRow.id, phone, text, channel)
      if (isReminderReply) {
        this.logger.log(`[reminder] Resposta de confirmação processada para ${phone}`)
        this.updateLog(logId, { status: 'completed', step: 'reminder_confirmation' })
        return
      }
    } catch {}

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          tenantId:     this.tenantId,
          agentId:      agentRow.id,
          channelId,
          contactPhone: phone,
          contactName:  name,
          status:       'OPEN',
        },
      })

      // CRM: lead criado no primeiro contato
      this.whatsappCrm.upsertLead({ agentId: agentRow.id, phone, name, stage: 'contact_made', conversationId: conv.id, lastMessage: text }).catch(() => {})
    }

    // 3. Salva mensagem USER
    await this.prisma.message.create({
      data: { conversationId: conv.id, role: 'USER', content: text },
    })

    // 4. Histórico (últimas N msgs conforme historyLimit do agente)
    const history = await this.prisma.message.findMany({
      where:   { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      take:    agentRow.historyLimit ?? 20,
    })

    // 5. Verifica limite de trocas
    if (agentRow.limitTurns && agentRow.maxTurns > 0) {
      if (history.length > agentRow.maxTurns * 2) {
        this.logger.debug(`Conversa ${conv.id} encerrada por limite de trocas`)
        this.updateLog(logId, { status: 'completed', step: 'turn_limit', model: resolvedModel, latencyMs: Date.now() - startMs })
        await this.prisma.conversation.update({
          where: { id: conv.id },
          data:  { status: 'CLOSED', endedAt: new Date() },
        })
        return
      }
    }

    const messages = history.map((m) => ({
      role:    m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    }))

    // 6. Monta system prompt enriquecido
    let trainingsByCategory: Record<string, Array<{ title?: string; content: string }>> = {}
    try { trainingsByCategory = await this.trainingsService.getTrainingsByCategory(agentRow.id) } catch {}

    let calendarIntegration: any = null
    try { calendarIntegration = await this.calendarService.getIntegration(agentRow.id) } catch {}

    const composedSystemPrompt = buildEnrichedSystemPrompt({
      agent: {
        name:              agentRow.name,
        description:       agentRow.description ?? undefined,
        personality:       agentRow.personality ?? undefined,
        actionPrompt:      agentRow.actionPrompt ?? undefined,
        systemPrompt:      agentRow.systemPrompt ?? undefined,
        agentType:         (agentRow as any).agentType ?? 'PASSIVO',
        purpose:           (agentRow as any).purpose ?? 'support',
        companyName:       (agentRow as any).companyName ?? undefined,
        companyUrl:        (agentRow as any).companyUrl ?? undefined,
        communicationTone: (agentRow as any).communicationTone ?? 'normal',
        useEmojis:         (agentRow as any).useEmojis ?? true,
        splitResponse:     (agentRow as any).splitResponse ?? true,
        restrictTopics:    (agentRow as any).restrictTopics ?? false,
        signName:          (agentRow as any).signName ?? false,
        conversationFlow:  (agentRow as any).conversationFlow ?? undefined,
      },
      contactName: name ?? undefined,
      trainingsByCategory,
      extraSystemCtx: agentOverride?.extraSystemCtx,
      calendarPrompt: calendarIntegration?.isActive ? getCalendarSystemPrompt() : undefined,
    })

    const tools = calendarIntegration?.isActive ? CALENDAR_TOOLS : undefined
    const onToolCall = calendarIntegration?.isActive
      ? (toolName: string, input: any) => executeCalendarTool(toolName, input, agentRow.id, this.calendarService, this.prisma)
      : undefined

    // 7. Chama IA (com timeout de segurança)
    let aiResult: Awaited<ReturnType<AiEngineService['complete']>>
    try {
      aiResult = await withTimeout(
        this.aiEngine.complete({
          messages,
          systemPrompt: composedSystemPrompt || undefined,
          model:        resolvedModel,
          temperature:  agentRow.temperature ?? 0.6,
          maxTokens:    agentRow.maxTokens   ?? 300,
          tools,
          onToolCall,
        }),
        AI_TIMEOUT_MS,
        `aiEngine.complete [${phone}]`,
      )
    } catch (err) {
      const errMsg = String(err)
      this.logger.error(`IA falhou para conversa ${conv.id}: ${errMsg}`)
      this.updateLog(logId, { status: 'ai_error', step: 'ai_call', model: resolvedModel, errorMsg: errMsg, latencyMs: Date.now() - startMs })
      if (agentRow.fallbackEnabled && agentRow.fallbackMessage) {
        const fallback = agentRow.fallbackMessage.replace(/\{\{nome\}\}/gi, name || 'amigo')
        await this.channelSend.send(channel, phone, fallback)
      }
      return
    }

    // 8. Fatia resposta via IA Central (só se splitResponse estiver ativo)
    // Remove trigger "atendente humano" antes de enviar ao cliente (é comando interno)
    const cleanContent = aiResult.content.replace(/\n*atendente humano\n*/gi, '').trim()
    const shouldSplit = (agentRow as any).splitResponse !== false
    const fragments = shouldSplit ? await this.splitter.split(cleanContent) : [cleanContent]

    // 9. Salva resposta COMPLETA no DB
    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        role:           'ASSISTANT',
        content:        aiResult.content,
        inputTokens:    aiResult.inputTokens,
        outputTokens:   aiResult.outputTokens,
        latencyMs:      aiResult.latencyMs,
      },
    })

    // 10. Atualiza conversa
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data:  { lastMessageAt: new Date(), turns: { increment: 1 }, contactName: name },
    })

    // 11. Upsert contato
    await this.contacts.upsertByPhone({ phone, name, channelId })

    // 11b. CRM: lead em conversa
    this.whatsappCrm.upsertLead({ agentId: agentRow.id, phone, name, stage: 'in_conversation', conversationId: conv.id, lastMessage: cleanContent }).catch(() => {})

    // 12. Log de sucesso
    this.updateLog(logId, {
      status:    'completed',
      step:      'sent',
      model:     resolvedModel,
      latencyMs: Date.now() - startMs,
    })

    // 13. Atraso humanizado antes de começar a enviar (send delay)
    // Prioridade: automação.sendDelayMs → channelAgent.sendDelayMs → default (800ms se ATIVO, 0 se PASSIVO)
    const defaultSendDelay = agentOverride?.agentId ? AUTOMATION_SEND_DELAY : 0
    const effectiveSendDelayMs = agentOverride?.sendDelayMs ?? channelAgentRow?.sendDelayMs ?? defaultSendDelay
    if (effectiveSendDelayMs > 0) await sleep(effectiveSendDelayMs)

    // 14. Envia cada fragmento com indicador de digitando + delay humanizado
    // Delay proporcional ao tamanho da mensagem (simula tempo de digitação real)
    const baseFragmentDelayMs = agentOverride?.fragmentDelayMs ?? channelAgentRow?.fragmentDelayMs ?? FRAGMENT_DELAY_MS
    try {
      for (let i = 0; i < fragments.length; i++) {
        // Delay humanizado: base + proporcional ao tamanho (50ms por caractere, min 1s, max 6s)
        if (i > 0) {
          const charDelay = Math.min(6000, Math.max(1000, fragments[i].length * 50))
          const humanizedDelay = Math.max(baseFragmentDelayMs, charDelay)
          await this.channelSend.sendTyping(channel, phone)
          await sleep(humanizedDelay)
        } else {
          // Primeiro fragmento: typing indicator + delay curto
          await this.channelSend.sendTyping(channel, phone)
          await sleep(Math.min(2000, Math.max(800, fragments[i].length * 30)))
        }
        await this.channelSend.send(channel, phone, fragments[i])
      }
    } catch (sendErr) {
      this.logger.error(`[processMessage] falha ao enviar para ${phone} via canal ${channelId}: ${sendErr}`)
      this.updateLog(logId, { status: 'send_error', step: 'fragment_send', errorMsg: String(sendErr) })
    }

    // 15. Disparo de lead qualificado — se IA pediu transferência e dispatch está ativo
    if (aiResult.content.toLowerCase().includes('atendente humano')) {
      // Ativar humanTakeover
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data: { humanTakeover: true },
      })

      // Disparar resumo se configurado
      if ((agentRow as any).leadDispatchEnabled && (agentRow as any).leadDispatchPhone) {
        this.dispatchLeadSummary(conv.id, agentRow, phone, name, channel)
          .catch((err) => this.logger.error(`[leadDispatch] falha: ${err}`))
      }
    }
  }

  /**
   * Gera resumo estruturado da conversa e envia para o telefone de disparo.
   */
  private async dispatchLeadSummary(
    conversationId: string,
    agent: any,
    clientPhone: string,
    clientName: string,
    channel: Channel,
  ): Promise<void> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    })

    const historyText = messages
      .map((m) => `${m.role === 'USER' ? 'Cliente' : 'Agente'}: ${m.content}`)
      .join('\n')

    const phoneClean = clientPhone.replace(/\D/g, '')
    const waLink = `https://wa.me/${phoneClean}`
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

    const summaryPrompt = [
      'Analise a conversa abaixo e gere um resumo de triagem para a atendente humana.',
      '',
      'Retorne EXATAMENTE neste formato (use os emojis indicados):',
      '',
      '🔔 *NOVO LEAD - TRIAGEM*',
      '',
      `👤 *Nome:* [nome que o cliente informou, ou "${clientName || 'Não informado'}" se não informou]`,
      `📱 *WhatsApp:* ${waLink}`,
      `⏰ *Horário:* ${now}`,
      `🤖 *Agente:* ${agent.name}`,
      '',
      '🎯 *Interesse:* [procedimento ou área de interesse — extraia da conversa]',
      '💭 *Motivação:* [por que buscou — extraia da conversa em 1 linha]',
      '📝 *Observações:* [qualquer info relevante: dúvidas, inseguranças, urgência]',
      '',
      '---',
      '✅ Lead qualificado para abordagem',
      '',
      'REGRAS:',
      '- Extraia APENAS informações CONFIRMADAS na conversa',
      '- Se o cliente não informou algo, escreva "Não informado"',
      '- Seja conciso — a atendente precisa de info rápida',
      '- Mantenha os emojis e a formatação WhatsApp (*negrito*)',
      '- NÃO invente dados',
      '',
      'Conversa:',
      historyText,
    ].join('\n')

    try {
      const result = await this.aiEngine.complete({
        messages: [{ role: 'user', content: summaryPrompt }],
        model: agent.model,
        temperature: 0.2,
        maxTokens: 600,
      })

      const dispatchPhone = (agent as any).leadDispatchPhone
      await this.channelSend.send(channel, dispatchPhone, result.content)
      this.logger.log(`[leadDispatch] Resumo enviado para ${dispatchPhone} (conversa ${conversationId})`)
    } catch (err) {
      this.logger.error(`[leadDispatch] Erro ao gerar/enviar resumo: ${err}`)
    }
  }

  // ─── Cron: auto-retoma IA após timeout de atendimento humano ─────────────────

  @Cron('*/5 * * * *')
  async resumeHumanTakeoverOnTimeout(): Promise<void> {
    const channelAgents = await this.prisma.channelAgent.findMany({
      where: { tenantId: this.tenantId, isActive: true, humanTakeoverTimeoutMin: { gt: 0 } },
    })
    if (!channelAgents.length) return

    for (const ca of channelAgents) {
      const cutoff = new Date(Date.now() - ca.humanTakeoverTimeoutMin * 60_000)
      const staleConvs = await this.prisma.conversation.findMany({
        where: {
          channelId:     ca.channelId,
          tenantId:      this.tenantId,
          humanTakeover: true,
          status:        { in: ['OPEN', 'IN_PROGRESS'] },
          lastMessageAt: { lt: cutoff },
        },
        select: { id: true },
      })
      if (!staleConvs.length) continue

      await this.prisma.conversation.updateMany({
        where: { id: { in: staleConvs.map((c) => c.id) } },
        data:  { humanTakeover: false },
      })
      this.logger.log(`[humanTakeover cron] ${staleConvs.length} conversa(s) retomadas pela IA (canal ${ca.channelId}, timeout ${ca.humanTakeoverTimeoutMin}min)`)
    }
  }

  // ─── Cron: limpa logs travados em 'processing' (reinício de serviço, crash) ─

  @Cron('*/5 * * * *')
  async cleanStaleProcessingLogs(): Promise<void> {
    const cutoff = new Date(Date.now() - 5 * 60_000) // > 5 min em 'processing'
    const result = await this.prisma.ingestionLog.updateMany({
      where: {
        tenantId:  this.tenantId,
        status:    'processing',
        createdAt: { lt: cutoff },
      },
      data: {
        status:   'failed',
        step:     'timeout',
        errorMsg: 'Processamento não concluído — serviço reiniciado ou timeout interno',
      },
    })
    if (result.count > 0) {
      this.logger.warn(`[staleLog cron] ${result.count} log(s) de 'processing' marcados como 'failed'`)
    }
  }
}
