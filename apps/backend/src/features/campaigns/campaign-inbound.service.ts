/**
 * CampaignInboundService — Side-effect do webhook ingestion para campanhas
 *
 * Quando um lead de campanha responde:
 * 1. Marca lead como REPLIED + kanban RESPONDEU
 * 2. Cancela follow-ups pendentes na fila
 * 3. Salva InboundMessage
 * 4. Se a campanha tem agentId → inicia/continua conversa IA com o agente
 *
 * Chamado como non-blocking (try/catch) pelo webhook-ingestion.
 * Erros aqui NUNCA impedem o pipeline normal de Chat IA.
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService }       from '@/infrastructure/database/prisma/prisma.service'
import { AiEngineService }     from '@/infrastructure/ai-engine/ai-engine.service'
import { ChannelSendService }  from '@/infrastructure/channel-send/channel-send.service'
import { DispatchQueueService } from '@/features/dispatch/dispatch-queue.service'
import { brPhoneVariants }     from '@/shared/utils/phone.utils'

@Injectable()
export class CampaignInboundService {
  private readonly logger = new Logger(CampaignInboundService.name)

  constructor(
    private readonly prisma:       PrismaService,
    private readonly aiEngine:     AiEngineService,
    private readonly channelSend:  ChannelSendService,
    private readonly dispatchQueue: DispatchQueueService,
  ) {}

  /**
   * Processa resposta de um lead de campanha.
   * Retorna true se encontrou lead, false se não.
   */
  async handleReply(phone: string, channelId: string, text: string, contactName?: string): Promise<boolean> {
    // Gera variantes do telefone
    const candidates = new Set<string>([phone])
    const digits = phone.replace(/\D/g, '')
    if (digits) {
      candidates.add(digits)
      if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        candidates.add('55' + digits)
      }
    }
    for (const v of brPhoneVariants(phone)) candidates.add(v)
    for (const v of brPhoneVariants(digits)) candidates.add(v)

    // Busca leads SENT com este telefone
    const leads = await this.prisma.campaignLead.findMany({
      where: {
        phone:  { in: [...candidates] },
        status: { in: ['SENT', 'QUEUED'] },
        campaign: { channelId },
      },
      include: {
        campaign: { select: { id: true, agentId: true, channelId: true } },
      },
    })

    if (leads.length === 0) return false

    // Marca todos como REPLIED
    const leadIds = leads.map((l) => l.id)
    await this.prisma.campaignLead.updateMany({
      where: { id: { in: leadIds } },
      data:  { status: 'REPLIED', kanbanColumn: 'RESPONDEU', lastMessageAt: new Date() },
    })

    // Cancela follow-ups pendentes
    for (const leadId of leadIds) {
      await this.dispatchQueue.removeLeadJobs(leadId).catch(() => {})
    }

    // Salva InboundMessage
    for (const lead of leads) {
      await this.prisma.campaignInboundMessage.create({
        data: { leadId: lead.id, content: text, fromPhone: phone },
      }).catch(() => {})
    }

    this.logger.log(`${leads.length} lead(s) marcados REPLIED via campanha (phone=${phone})`)

    // Se alguma campanha tem agente vinculado, inicia/continua conversa IA
    const campaignWithAgent = leads.find((l) => l.campaign.agentId)
    if (campaignWithAgent) {
      await this.triggerAgentResponse(
        campaignWithAgent.campaign.agentId!,
        campaignWithAgent.campaign.channelId!,
        phone,
        text,
        contactName,
      ).catch((err) => {
        this.logger.warn(`Falha ao acionar agente IA para lead ${campaignWithAgent.id}: ${err?.message}`)
      })
    }

    return true
  }

  private async triggerAgentResponse(
    agentId:   string,
    channelId: string,
    phone:     string,
    text:      string,
    name?:     string,
  ): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true, tenantId: true, model: true, personality: true,
        actionPrompt: true, systemPrompt: true, temperature: true,
        maxTokens: true, historyLimit: true, fallbackEnabled: true,
        fallbackMessage: true, status: true,
      },
    })

    if (!agent || agent.status !== 'ACTIVE') {
      this.logger.debug(`Agente ${agentId} não está ativo — ignorando resposta de campanha`)
      return
    }

    // FindOrCreate conversa
    let conversation = await this.prisma.conversation.findFirst({
      where: { agentId, channelId, contactPhone: phone, tenantId: agent.tenantId, status: 'OPEN' },
    })
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId:     agent.tenantId,
          agentId,
          channelId,
          contactPhone: phone,
          contactName:  name ?? null,
          status:       'OPEN',
        },
      })
    }

    // Salva mensagem do usuário
    await this.prisma.message.create({
      data: { conversationId: conversation.id, role: 'USER', content: text },
    })

    // Monta contexto com histórico
    const history = await this.prisma.message.findMany({
      where:   { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take:    agent.historyLimit,
    })

    const messages = history.map((m) => ({
      role:    m.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))

    const systemPrompt = agent.personality
      ? `${agent.personality}\n\n${agent.actionPrompt ?? ''}`
      : agent.systemPrompt ?? ''

    // Chama IA
    try {
      const result = await this.aiEngine.complete({
        messages,
        systemPrompt,
        model:       agent.model,
        temperature: agent.temperature,
        maxTokens:   agent.maxTokens,
      })

      // Salva resposta
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role:           'ASSISTANT',
          content:        result.content,
          inputTokens:    result.inputTokens,
          outputTokens:   result.outputTokens,
          latencyMs:      result.latencyMs,
        },
      })

      // Atualiza conversa
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data:  { turns: { increment: 1 }, lastMessageAt: new Date() },
      })

      // Envia resposta via canal
      const channel = await this.prisma.channel.findUnique({ where: { id: channelId } })
      if (channel) {
        await this.channelSend.send(channel as any, phone, result.content)
      }

      this.logger.log(`Agente ${agentId} respondeu lead de campanha → ${phone}`)
    } catch (err: any) {
      this.logger.warn(`Erro IA campanha agente ${agentId}: ${err?.message}`)

      if (agent.fallbackEnabled && agent.fallbackMessage) {
        const channel = await this.prisma.channel.findUnique({ where: { id: channelId } })
        if (channel) {
          await this.channelSend.send(channel as any, phone, agent.fallbackMessage)
        }
      }
    }
  }
}
