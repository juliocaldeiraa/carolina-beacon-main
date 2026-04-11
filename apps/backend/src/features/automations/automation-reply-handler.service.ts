/**
 * AutomationReplyHandlerService — Trata respostas de leads vinculados a automações
 *
 * Usa o agente vinculado (linkedAgentId) para obter systemPrompt, modelo,
 * temperature, maxTokens e mensagem de fallback.
 * Fallback para aiPrompt legado se linkedAgentId não estiver definido.
 *
 * Fatia a resposta via MessageSplitterService (IA Central) e envia
 * cada fragmento com delay — comportamento idêntico ao WebhookIngestionService.
 *
 * Guardrails de comportamento humano imprevisível:
 * - Opt-out em tempo real: detecta keywords de saída e encerra sem chamar IA
 * - Conversa encerrada: leads com status 'conversa_encerrada' são ignorados
 * - Leads convertidos: não reengajados pelo fluxo de automação
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService }          from '@/infrastructure/database/prisma/prisma.service'
import { AiEngineService, ChatMessage } from '@/infrastructure/ai-engine/ai-engine.service'
import { MessageSplitterService } from '@/infrastructure/ai-engine/message-splitter.service'
import { ChannelSendService }     from '@/infrastructure/channel-send/channel-send.service'
import { CrmService }             from '@/features/crm/crm.service'
import { buildSystemPrompt }      from '@/core/entities/Agent'
import { normalizePhoneForSend, brPhoneVariants } from '@/shared/utils/phone.utils'
import type { Channel, ChannelType, ChannelConfig } from '@/core/entities/Channel'

const CONVERSATION_CLOSE_LIMIT = 16
const CLOSE_MESSAGE     = 'Obrigado pela conversa! Caso queira continuar, entre em contato novamente.'
const OPT_OUT_MESSAGE   = 'Tudo bem! Você foi removido da nossa lista e não receberá mais mensagens. Qualquer dúvida, é só chamar.'
const DEFAULT_MODEL     = 'gpt-4o-mini'
const FRAGMENT_DELAY_MS = 1200
const AI_TIMEOUT_MS     = 30_000

const HANDOFF_TRIGGER_PATTERNS = [
  /\bfalar com (um |uma |o |a )?(humano|pessoa|atendente|vendedor|consultor|especialista|responsável)\b/i,
  /\bquero (um |uma |o |a )?(humano|pessoa|atendente|vendedor|consultor|especialista)\b/i,
  /\batendimento humano\b/i,
  /\bfalar com algu[eé]m\b/i,
  /\bfalar com (uma pessoa|um especialista)\b/i,
  /\bme passa (pro|para o|para um) (atendente|vendedor|humano)\b/i,
  /\bpreciso (falar com|de) (um |uma )?(humano|pessoa|atendente|vendedor)\b/i,
  /\bpode me passar (para|pro) (um |uma )?(atendente|vendedor|humano|pessoa)\b/i,
]

const HANDOFF_CONFIRM_PATTERNS = [
  /\bsim\b/i,
  /\bquero\b/i,
  /\bconfirmo\b/i,
  /\bpode\b/i,
  /\bisso\b/i,
  /\bmanda\b/i,
  /\bpor favor\b/i,
  /\bprossig[ao]\b/i,
  /\bclaro\b/i,
  /\bcom certeza\b/i,
  /\bexato\b/i,
  /\bok\b/i,
]

const HANDOFF_CANCEL_PATTERNS = [
  /\bnão\b/i,
  /\bnao\b/i,
  /\bnega\b/i,
  /\bcancela\b/i,
  /\bdesiste\b/i,
  /\bdeixa\b/i,
]

function isHandoffTrigger(text: string): boolean {
  return HANDOFF_TRIGGER_PATTERNS.some((re) => re.test(text))
}

function isHandoffConfirm(text: string): boolean {
  return HANDOFF_CONFIRM_PATTERNS.some((re) => re.test(text))
}

function isHandoffCancel(text: string): boolean {
  return HANDOFF_CANCEL_PATTERNS.some((re) => re.test(text))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${label} after ${ms}ms`)), ms)
    promise.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

/**
 * Keywords de opt-out detectadas antes de qualquer processamento de IA.
 * Usam word-boundary para evitar falsos positivos (ex: "parabéns" ≠ "para").
 * Lista cobre variações comuns em PT-BR + EN.
 */
const OPT_OUT_PATTERNS = [
  /\bstop\b/i,
  /\bsair\b/i,
  /\bpare\b/i,
  /\bparar\b/i,
  /\bcancela[r]?\b/i,
  /\bremove[r]?\b/i,
  /\bdesinscrever\b/i,
  /\bdescadastra[r]?\b/i,
  /\bn[aã]o quero\b/i,
  /\bn[aã]o tenho interesse\b/i,
  /\bn[aã]o me (mande|envie|contate)\b/i,
  /\bme (tire|remova|cancele|descadastre)\b/i,
  /\bchega\b/i,
  /\bnão (quero|preciso) mais\b/i,
  /\bnao (quero|preciso) mais\b/i,
  /\bopt.?out\b/i,
  /\bunsubscribe\b/i,
]

function isOptOutRequest(text: string): boolean {
  return OPT_OUT_PATTERNS.some((re) => re.test(text))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface HistoryEntry {
  role:      'user' | 'assistant'
  content:   string
  timestamp: string
}

type ScopedHistory = Record<string, HistoryEntry[]>

@Injectable()
export class AutomationReplyHandlerService {
  private readonly logger = new Logger(AutomationReplyHandlerService.name)

  constructor(
    private readonly prisma:      PrismaService,
    private readonly aiEngine:    AiEngineService,
    private readonly splitter:    MessageSplitterService,
    private readonly channelSend: ChannelSendService,
    private readonly crm:         CrmService,
  ) {}

  /** Lê o histórico isolado por automationId. Retrocompatível com o formato array legado. */
  private getHistory(raw: unknown, automationId: string): HistoryEntry[] {
    if (!raw || Array.isArray(raw)) return []
    const scoped = raw as ScopedHistory
    return Array.isArray(scoped[automationId]) ? scoped[automationId] : []
  }

  /** Escreve o histórico isolado por automationId preservando os demais slices. */
  private setHistory(raw: unknown, automationId: string, entries: HistoryEntry[]): ScopedHistory {
    const base: ScopedHistory = (!raw || Array.isArray(raw)) ? {} : (raw as ScopedHistory)
    return { ...base, [automationId]: entries }
  }

  async handleReply(channelId: string, phone: string, text: string): Promise<void> {
    try {
      await this.process(channelId, phone, text)
    } catch (err) {
      this.logger.error(`Falha ao tratar resposta (canal=${channelId}, phone=${phone}): ${err}`)
    }
  }

  private async process(channelId: string, phone: string, text: string): Promise<void> {
    this.logger.log(`[AutomationReply] process() iniciado — channelId=${channelId} phone=${phone}`)
    // Tenta automação ativa: canal primário, legado ou canal de fallback
    let automation = await this.prisma.automation.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [
          { channelId },
          { primaryChannelId: channelId },
          { fallbackChannelIds: { array_contains: channelId } },
        ],
      },
    })

    // Normaliza o phone e gera variantes para cobrir divergências de formato:
    // Evolution API envia "5511912345678" mas leads são armazenados como "+11912345678"
    const norm     = normalizePhoneForSend(phone)
    const variants = brPhoneVariants(norm)
    const allPhoneVariants = [
      ...variants,
      ...variants.map((v) => `+${v}`),
      ...variants.filter((v) => v.startsWith('55')).map((v) => `+${v.slice(2)}`),
    ]
    const phoneConditions = allPhoneVariants.flatMap((v) => [{ whatsappLimpo: v }, { whatsapp: v }])
    // Prefere lead de teste para que o fallback de automação inativa funcione corretamente.
    // Sem isso, se houver um lead antigo com outro status, ele seria encontrado primeiro.
    const lead =
      await this.prisma.leadManyInsta.findFirst({ where: { status: 'teste', OR: phoneConditions } }) ??
      await this.prisma.leadManyInsta.findFirst({ where: { OR: phoneConditions } })
    if (!lead) {
      this.logger.log(`[AutomationReply] lead não encontrado — phone=${phone} variantes=${allPhoneVariants.join(',')}`)
      return
    }

    // Fallback: campanha inativa pode atender leads de teste
    // Inclui fallbackChannelIds para cobrir canais de reserva
    if (!automation && lead.status === 'teste') {
      automation = await this.prisma.automation.findFirst({
        where: {
          OR: [
            { channelId },
            { primaryChannelId: channelId },
            { fallbackChannelIds: { array_contains: channelId } },
          ],
        },
      })
    }

    if (!automation) {
      this.logger.log(`[AutomationReply] automação não encontrada — channelId=${channelId} lead=${lead.id} status=${lead.status}`)
      return
    }

    // ── Guardrail 1: opt-out explícito já registrado ──────────────────────────
    if (lead.status === 'opt_out') {
      this.logger.debug(`Lead ${lead.id} já é opt_out — ignorando`)
      return
    }

    // ── Guardrail 2: conversa encerrada — não reengajar pelo fluxo ativo ─────
    if (lead.status === 'conversa_encerrada') {
      this.logger.debug(`Lead ${lead.id} com conversa_encerrada — ignorando reengajamento`)
      return
    }

    // ── Guardrail 2b: em atendimento humano — IA não interfere ───────────────
    if (lead.status === 'atendimento_humano') {
      this.logger.debug(`Lead ${lead.id} em atendimento_humano — IA não interfere`)
      return
    }

    // ── Guardrail 3: lead já converteu — não pertence mais ao fluxo ativo ────
    if (lead.converteu) {
      this.logger.debug(`Lead ${lead.id} já converteu — ignorando`)
      return
    }

    // ── CRM: lead respondeu → avança para "Respondido" ───────────────────────
    this.crm.upsertLeadCard({
      phone, name: lead.nome, automationId: automation.id, automationName: automation.name,
      targetStage: 'Respondido', note: 'Lead respondeu',
    }).catch(() => {})

    // Resolve canal de resposta: aiChannelId se CONNECTED, senão usa o canal de entrada.
    // Evita tentar enviar via canal desconectado quando o teste disparou pelo fallback.
    let responseChannelId = channelId
    if (automation.aiChannelId) {
      const aiCh = await this.prisma.channel.findUnique({
        where:  { id: automation.aiChannelId },
        select: { status: true },
      })
      if (aiCh?.status === 'CONNECTED') responseChannelId = automation.aiChannelId
    }
    const [channelRow, channelAgentRow] = await Promise.all([
      this.prisma.channel.findUnique({ where: { id: responseChannelId } }),
      this.prisma.channelAgent.findFirst({ where: { channelId: responseChannelId } }),
    ])
    if (!channelRow) {
      this.logger.log(`[AutomationReply] canal não encontrado — responseChannelId=${responseChannelId}`)
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

    // ── Guardrail 4: opt-out em tempo real — detecta intenção de saída ────────
    if (isOptOutRequest(text)) {
      this.logger.log(`Lead ${lead.id} solicitou opt-out: "${text.substring(0, 60)}"`)
      await this.channelSend.send(channel, phone, OPT_OUT_MESSAGE)
      await this.prisma.leadManyInsta.update({
        where: { id: lead.id },
        data:  { status: 'opt_out' },
      })
      this.crm.upsertLeadCard({
        phone, name: lead.nome, automationId: automation.id, automationName: automation.name,
        targetStage: 'Fechado Perdido', note: 'Lead solicitou opt-out',
      }).catch(() => {})
      return
    }

    // ── Guardrail 5: handoff para humano com dupla confirmação ────────────────
    if ((automation as any).humanHandoffEnabled) {
      const meta = (lead.metadata as Record<string, unknown>) ?? {}
      const aguardandoConfirmacao = meta['aguardando_confirmacao_humano'] === true

      if (aguardandoConfirmacao) {
        if (isHandoffCancel(text)) {
          // Lead desistiu — limpa flag e continua com IA normalmente
          const newMeta = { ...meta }
          delete newMeta['aguardando_confirmacao_humano']
          await this.prisma.leadManyInsta.update({
            where: { id: lead.id },
            data:  { metadata: newMeta as any },
          })
          this.logger.log(`Lead ${lead.id} cancelou handoff — retomando IA`)
          // Não retorna: deixa cair para o fluxo normal de IA abaixo
        } else if (isHandoffConfirm(text)) {
          // Lead confirmou — executa o handoff
          const handoffPhone   = (automation as any).humanHandoffPhone as string | null
          const handoffMessage = (automation as any).humanHandoffMessage as string | null
          const msg = handoffMessage
            ? handoffMessage
                .replace(/\{nome\}/gi, lead.nome || 'você')
                .replace(/\{whatsapp_atendente\}/gi, handoffPhone ? `https://wa.me/${handoffPhone}` : '')
            : `Ótimo! Conectando você agora com nosso atendente 👇${handoffPhone ? `\nhttps://wa.me/${handoffPhone}` : ''}`

          await this.channelSend.send(channel, phone, msg)
          const newMeta = { ...meta }
          delete newMeta['aguardando_confirmacao_humano']
          await this.prisma.leadManyInsta.update({
            where: { id: lead.id },
            data:  { status: 'atendimento_humano', metadata: newMeta as any },
          })
          this.crm.upsertLeadCard({
            phone, name: lead.nome, automationId: automation.id, automationName: automation.name,
            targetStage: 'Qualificado', note: 'Lead solicitou atendimento humano — handoff realizado',
          }).catch(() => {})
          this.logger.log(`Lead ${lead.id} → atendimento_humano`)
          return
        }
        // Se a resposta não é nem confirmação nem cancelamento, cai para a IA tratar
      } else if (isHandoffTrigger(text)) {
        // Primeira detecção — envia pergunta de confirmação e seta flag
        const confirmMsg = 'Entendido! Posso continuar te ajudando por aqui, mas se preferir um atendimento personalizado com nosso time, é só confirmar. Quer mesmo falar com um atendente?'
        await this.channelSend.send(channel, phone, confirmMsg)
        const newMeta = { ...meta, aguardando_confirmacao_humano: true }
        await this.prisma.leadManyInsta.update({
          where: { id: lead.id },
          data:  { metadata: newMeta as any },
        })
        this.logger.log(`Lead ${lead.id} solicitou handoff — aguardando confirmação`)
        return
      }
    }

    // Resolve agente vinculado uma única vez (usado para historyLimit + systemPrompt)
    const linkedAgent = automation.linkedAgentId
      ? await this.prisma.agent.findFirst({ where: { id: automation.linkedAgentId, deletedAt: null } })
      : null

    const historyLimit = linkedAgent?.historyLimit ?? 20
    const rawHistory = this.getHistory(lead.historicoCId, automation.id).slice(-historyLimit)

    const now             = new Date()
    const wasFollowupSent = lead.status === 'followup_enviado'

    // ── Guardrail 6: limite de turnos da conversa ─────────────────────────────
    if (rawHistory.length >= CONVERSATION_CLOSE_LIMIT) {
      await this.channelSend.send(channel, phone, CLOSE_MESSAGE)
      await this.prisma.leadManyInsta.update({
        where: { id: lead.id },
        data:  { status: 'conversa_encerrada' },
      })
      this.crm.upsertLeadCard({
        phone, name: lead.nome, automationId: automation.id, automationName: automation.name,
        targetStage: 'Fechado Perdido', note: 'Conversa encerrada: limite de turnos atingido',
      }).catch(() => {})
      return
    }

    const updatedHistory: HistoryEntry[] = [
      ...rawHistory,
      { role: 'user', content: text, timestamp: now.toISOString() },
    ]

    const messages: ChatMessage[] = updatedHistory.map((e) => ({
      role:    e.role,
      content: e.content,
    }))

    // Resolve IA: agente vinculado tem prioridade sobre aiPrompt legado
    let systemPrompt: string | undefined
    let model        = automation.aiModel ?? DEFAULT_MODEL
    let temperature  = 0.6
    let maxTokens    = 300
    let fallbackEnabled = true
    let fallbackMessage: string | undefined

    if (linkedAgent) {
      systemPrompt    = buildSystemPrompt({
        personality:  linkedAgent.personality  ?? undefined,
        actionPrompt: linkedAgent.actionPrompt ?? undefined,
        systemPrompt: linkedAgent.systemPrompt ?? undefined,
        agentType:    (linkedAgent as any).agentType ?? 'PASSIVO',
      })
      temperature     = linkedAgent.temperature
      maxTokens       = linkedAgent.maxTokens
      fallbackEnabled = linkedAgent.fallbackEnabled
      fallbackMessage = linkedAgent.fallbackMessage ?? undefined
      if (!automation.aiModel) model = linkedAgent.model ?? DEFAULT_MODEL
    } else if (automation.aiPrompt) {
      systemPrompt = automation.aiPrompt
    }

    // Injeta contexto do lead e da mensagem de abertura no system prompt
    systemPrompt = this.buildLeadContext(systemPrompt, lead, {
      name:             automation.name,
      messageTemplates: (automation.messageTemplates as string[]) ?? [],
      messageTemplate:  automation.messageTemplate,
    })

    // Chama IA (com timeout de segurança)
    let aiReply: string
    try {
      const result = await withTimeout(
        this.aiEngine.complete({
          messages,
          systemPrompt,
          model,
          temperature:  temperature  ?? 0.6,
          maxTokens:    maxTokens    ?? 300,
        }),
        AI_TIMEOUT_MS,
        'aiEngine.complete',
      )
      aiReply = result.content
    } catch (err) {
      this.logger.error(`IA falhou para lead ${lead.id}: ${err}`)
      if (fallbackEnabled && fallbackMessage) {
        const fb = fallbackMessage
          .replace(/\{\{nome\}\}/gi, lead.nome || 'amigo')
          .replace(/\{nome\}/gi,     lead.nome || 'amigo')
        await this.channelSend.send(channel, phone, fb)
      }
      return
    }

    // Fatia resposta via IA Central
    const fragments = await this.splitter.split(aiReply)

    const sendDelayMs    = channelAgentRow?.sendDelayMs    ?? 0
    const fragmentDelayMs = channelAgentRow?.fragmentDelayMs ?? FRAGMENT_DELAY_MS

    if (sendDelayMs > 0) await sleep(sendDelayMs)

    // Envia cada fragmento com typing indicator e delay humanizado
    for (let i = 0; i < fragments.length; i++) {
      if (i > 0) await sleep(fragmentDelayMs)
      await this.channelSend.sendTyping(channel, phone)
      await this.channelSend.send(channel, phone, fragments[i])
    }

    // Salva histórico com resposta completa (não os fragmentos)
    const finalHistory: HistoryEntry[] = [
      ...updatedHistory,
      { role: 'assistant', content: aiReply, timestamp: new Date().toISOString() },
    ]

    const hasLink   = /https?:\/\/[^\s]+/i.test(aiReply)
    const newStatus = hasLink ? 'link_enviado' : 'em_conversa'

    await this.prisma.leadManyInsta.update({
      where: { id: lead.id },
      data: {
        historicoCId:  this.setHistory(lead.historicoCId, automation.id, finalHistory) as any,
        status:        newStatus,
        ...(hasLink ? { dataLinkEnviado: now } : {}),
      },
    })

    this.crm.upsertLeadCard({
      phone, name: lead.nome, automationId: automation.id, automationName: automation.name,
      targetStage: hasLink ? 'Proposta Enviada' : 'Qualificado',
      note: hasLink ? 'Link enviado pela IA' : 'Lead em conversa com IA',
    }).catch(() => {})

    if (wasFollowupSent) {
      await this.prisma.automation.update({
        where: { id: automation.id },
        data:  { totalReplied: { increment: 1 } },
      })
    }

    this.logger.log(`AutomationReply: lead ${lead.id} → ${newStatus}`)

    // Espelha user + assistant na tabela Conversation/Message para o monitor de teste.
    // Fire-and-forget — não bloqueia nem quebra o fluxo principal.
    if (automation.linkedAgentId) {
      const tenantId = process.env.DEFAULT_TENANT_ID!
      this.prisma.conversation.findFirst({
        // Sem filtro status: qualquer conversa aberta ou ativa serve para o espelho
        where: { contactPhone: { in: allPhoneVariants }, agentId: automation.linkedAgentId, tenantId },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      }).then(async (conv) => {
        if (!conv) {
          this.logger.log(`[AutomationReply] mirror: conversa não encontrada para phone=${phone} agentId=${automation.linkedAgentId}`)
          return
        }
        await this.prisma.message.createMany({
          data: [
            { conversationId: conv.id, role: 'USER',      content: text },
            { conversationId: conv.id, role: 'ASSISTANT', content: aiReply },
          ],
        })
        await this.prisma.conversation.update({
          where: { id: conv.id },
          data:  { lastMessageAt: new Date() },
        })
      }).catch((err) => {
        this.logger.warn(`[AutomationReply] mirror falhou: ${err}`)
      })
    }
  }

  /**
   * Constrói o bloco de contexto do lead e da mensagem de abertura
   * e o anexa ao system prompt existente.
   *
   * Prioridade para a mensagem exata enviada (mensagemEnviada no lead).
   * Fallback para os templates da automação caso o campo ainda não esteja preenchido.
   */
  private buildLeadContext(
    base:       string | undefined,
    lead:       { nome?: string | null; campanha?: string | null; status?: string | null; mensagemEnviada?: string | null; origem?: string | null; lista?: string | null; metadata?: unknown; whatsapp?: string | null; whatsappLimpo?: string | null },
    automation: { messageTemplates: string[]; messageTemplate?: string | null; name: string },
  ): string | undefined {
    // Interpola variáveis {nome}, {campanha}, etc. diretamente no system prompt
    if (base) {
      const meta = (lead.metadata as Record<string, unknown>) ?? {}
      base = base
        .replace(/\{nome\}/g,      lead.nome      ?? '')
        .replace(/\{status\}/g,    lead.status    ?? '')
        .replace(/\{campanha\}/g,  lead.campanha  ?? '')
        .replace(/\{origem\}/g,    lead.origem    ?? '')
        .replace(/\{lista\}/g,     lead.lista     ?? '')
        .replace(/\{whatsapp\}/g,  lead.whatsappLimpo ?? lead.whatsapp ?? '')
      for (const [k, v] of Object.entries(meta)) {
        base = base.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''))
      }
    }

    const lines: string[] = []

    const nome     = lead.nome?.trim()
    const campanha = lead.campanha?.trim()
    const origem   = lead.origem?.trim()
    const lista    = lead.lista?.trim()

    if (nome || campanha || origem || lista) {
      lines.push('---')
      lines.push('Contexto da pessoa com quem você está conversando:')
      if (nome)     lines.push(`- Nome: ${nome}`)
      if (campanha) lines.push(`- Campanha: ${campanha}`)
      if (origem)   lines.push(`- Origem: ${origem}`)
      if (lista)    lines.push(`- Lista: ${lista}`)
    }

    // Campos custom do metadata
    const meta = (lead.metadata as Record<string, unknown>) ?? {}
    const metaEntries = Object.entries(meta).filter(([, v]) => v != null && v !== '')
    if (metaEntries.length > 0) {
      if (lines.length === 0) { lines.push('---'); lines.push('Contexto da pessoa:') }
      for (const [k, v] of metaEntries) {
        lines.push(`- ${k}: ${v}`)
      }
    }

    // Usa o template exato que foi enviado — rastreável por variação
    const mensagemExata = lead.mensagemEnviada?.trim()
    if (mensagemExata) {
      lines.push('')
      lines.push('Mensagem de abertura que você enviou para iniciar a conversa:')
      lines.push(`"${mensagemExata}"`)
    } else {
      // Fallback: lead ainda não tem mensagemEnviada (registros anteriores)
      const templates = automation.messageTemplates?.length > 0
        ? automation.messageTemplates
        : (automation.messageTemplate ? [automation.messageTemplate] : [])

      if (templates.length > 0) {
        lines.push('')
        const rendered = templates.map((t) => `"${t.replace(/\{nome\}/g, nome ?? 'a pessoa')}"`)
        if (rendered.length === 1) {
          lines.push('Mensagem de abertura que você enviou para iniciar a conversa:')
          lines.push(rendered[0])
        } else {
          lines.push('Você enviou uma destas mensagens de abertura (a escolha foi aleatória):')
          rendered.forEach((r) => lines.push(r))
        }
      }
    }

    if (lines.length === 0) return base

    const contextBlock = lines.join('\n')
    return base ? `${base}\n\n${contextBlock}` : contextBlock
  }
}
