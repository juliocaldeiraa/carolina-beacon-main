/**
 * BroadcastProcessorService — Worker BullMQ que processa campanhas
 *
 * Fluxo: QUEUED → RUNNING → COMPLETED/FAILED
 * Para cada contato do audience (formato "nome|telefone"):
 *   1. Extrai nome e telefone
 *   2. Substitui {nome} no template
 *   3. Envia via ChannelSendService (Evolution API / Z-API / Telegram)
 *
 * Suporta REDIS_URL (Upstash/TLS) ou REDIS_HOST/PORT (local)
 * Rate limiting: concurrency 5, 10 msgs/sec via limiter
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Worker, Job } from 'bullmq'
import { BroadcastService } from './broadcast.service'
import { ChannelSendService } from '@/infrastructure/channel-send/channel-send.service'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import type { BroadcastJobData } from './broadcast-queue.service'

/** Mesma lógica de buildRedisConnection do queue service */
function buildRedisConnection(config: ConfigService) {
  const url = config.get<string>('REDIS_URL')
  if (url) {
    const parsed = new URL(url)
    const isTls  = url.startsWith('rediss://')
    return {
      host:                 parsed.hostname,
      port:                 parseInt(parsed.port || '6379'),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(isTls ? { tls: {} } : {}),
      maxRetriesPerRequest: null  as unknown as number,  // obrigatório para BullMQ
      enableOfflineQueue:   false,                       // recomendado para Upstash
    }
  }
  return {
    host:                 config.get<string>('REDIS_HOST', 'localhost'),
    port:                 config.get<number>('REDIS_PORT', 6379),
    maxRetriesPerRequest: null  as unknown as number,
    enableOfflineQueue:   false,
  }
}

@Injectable()
export class BroadcastProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastProcessorService.name)
  private worker!: Worker

  constructor(
    private readonly config:           ConfigService,
    private readonly broadcastService: BroadcastService,
    private readonly channelSend:      ChannelSendService,
    private readonly prisma:           PrismaService,
  ) {}

  onModuleInit() {
    const connection = buildRedisConnection(this.config)

    this.worker = new Worker<BroadcastJobData>(
      'beacon-broadcast',
      (job) => this.process(job),
      {
        connection,
        concurrency: 5,
        limiter:     { max: 10, duration: 1000 }, // rate limiting: 10 envios/s
      },
    )

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} falhou: ${err.message}`)
      if (job?.data?.broadcastId) {
        this.broadcastService.markFailed(job.data.broadcastId).catch(() => null)
      }
    })

    this.worker.on('completed', (job) =>
      this.logger.log(`Job ${job.id} concluído (broadcast ${job.data.broadcastId})`),
    )

    this.logger.log('BroadcastProcessor (Worker BullMQ) iniciado')
  }

  private async process(job: Job<BroadcastJobData>): Promise<void> {
    const {
      broadcastId, channelId, contacts, template,
      messageDelayMinSeconds = 8, messageDelayMaxSeconds = 15,
    } = job.data

    await this.broadcastService.markRunning(broadcastId)
    this.logger.log(`Broadcast ${broadcastId}: enviando para ${contacts.length} contatos`)

    // Busca o canal configurado (necessário para envio real)
    const channel = channelId
      ? await this.prisma.channel.findUnique({ where: { id: channelId } })
      : null

    if (!channel) {
      this.logger.warn(`Broadcast ${broadcastId}: sem canal configurado — simulando envio`)
    }

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      try {
        // Formato do contato: "nome|telefone" ou apenas "telefone"
        const parts   = contact.split('|')
        const name    = parts[0]?.trim() ?? contact
        const phone   = parts[1]?.trim() ?? parts[0]?.trim() ?? contact
        const message = template.replace(/\{nome\}/g, name)

        if (channel) {
          await this.channelSend.send(channel as Parameters<typeof this.channelSend.send>[0], phone, message)
          this.logger.debug(`Broadcast ${broadcastId}: enviado para ${phone}`)
        } else {
          // Sem canal: apenas log (útil para testes)
          this.logger.debug(`[SIM] Broadcast ${broadcastId}: "${message}" → ${phone}`)
        }

        await job.updateProgress(Math.round(((i + 1) / contacts.length) * 100))

        // Delay randomizado anti-ban entre mensagens (exceto na última)
        if (i < contacts.length - 1) {
          const minMs = messageDelayMinSeconds * 1000
          const maxMs = messageDelayMaxSeconds * 1000
          const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
          this.logger.debug(`Broadcast ${broadcastId}: aguardando ${delay}ms antes do próximo envio`)
          await new Promise((r) => setTimeout(r, delay))
        }
      } catch (err) {
        this.logger.warn(`Falha ao enviar para ${contact}: ${err}`)
        // Não interrompe o loop — continua para o próximo contato
      }
    }

    await this.broadcastService.markCompleted(broadcastId)
  }

  async onModuleDestroy() {
    await this.worker.close()
  }
}
