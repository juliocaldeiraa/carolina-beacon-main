/**
 * FeedbackService — Supervisão humana de conversas.
 *
 * O operador pontua mensagens do agente em conversas reais.
 * O feedback é processado por IA e vira training tipo 'feedback'.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { TrainingProcessorService } from './training-processor.service'

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: TrainingProcessorService,
  ) {}

  /**
   * Lista feedbacks de uma conversa.
   */
  async findByConversation(conversationId: string) {
    return this.prisma.conversationFeedback.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Lista feedbacks de um agente.
   */
  async findByAgent(agentId: string) {
    return this.prisma.conversationFeedback.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Cria feedback, processa com IA, e gera training.
   */
  async create(dto: {
    conversationId: string
    agentId: string
    messageIndex: number
    feedbackText: string
  }) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) throw new NotFoundException('Conversa não encontrada')

    const targetMessage = conversation.messages[dto.messageIndex]
    if (!targetMessage) throw new NotFoundException('Mensagem não encontrada no índice informado')

    const previousMessage = dto.messageIndex > 0
      ? conversation.messages[dto.messageIndex - 1]
      : null

    const feedback = await this.prisma.conversationFeedback.create({
      data: {
        conversationId: dto.conversationId,
        agentId: dto.agentId,
        messageIndex: dto.messageIndex,
        feedbackText: dto.feedbackText,
        status: 'processing',
      },
    })

    // Processar com IA (async, não bloqueia a resposta HTTP)
    this.processAsync(
      feedback.id,
      dto.agentId,
      previousMessage?.content ?? '',
      targetMessage.content,
      dto.feedbackText,
    ).catch((err) => this.logger.error(`Failed to process feedback ${feedback.id}`, err))

    return feedback
  }

  /**
   * Descartar um feedback.
   */
  async dismiss(feedbackId: string) {
    return this.prisma.conversationFeedback.update({
      where: { id: feedbackId },
      data: { status: 'dismissed' },
    })
  }

  private async processAsync(
    feedbackId: string,
    agentId: string,
    clientMessage: string,
    agentResponse: string,
    feedbackText: string,
  ) {
    try {
      const processedContent = await this.processor.processFeedback(
        feedbackId, clientMessage, agentResponse, feedbackText,
      )

      await this.prisma.conversationFeedback.update({
        where: { id: feedbackId },
        data: { processedContent, status: 'ready' },
      })

      await this.prisma.agentTraining.create({
        data: {
          agentId,
          type: 'feedback',
          title: `Feedback: ${feedbackText.slice(0, 80)}`,
          content: processedContent,
          status: 'ready',
          category: 'feedback',
          metadata: { feedbackId, source: 'conversation_feedback' },
        },
      })
    } catch (error) {
      this.logger.error(`Failed to process feedback ${feedbackId}`, error)
      await this.prisma.conversationFeedback.update({
        where: { id: feedbackId },
        data: { status: 'error' },
      })
    }
  }
}
