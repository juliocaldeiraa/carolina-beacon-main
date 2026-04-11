/**
 * BroadcastQueueService — Gerencia a fila BullMQ de envio de campanhas
 *
 * Suporta Redis via REDIS_URL (Upstash/TLS) ou REDIS_HOST/REDIS_PORT (local)
 * Rate limiting: 10 mensagens/segundo
 * Retry: 3 tentativas com backoff exponencial (2s base)
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'

export interface BroadcastJobData {
  broadcastId:             string
  tenantId:                string
  channelId?:              string
  contacts:                string[]
  template:                string
  messageDelayMinSeconds:  number
  messageDelayMaxSeconds:  number
}

/** Cria a config de conexão Redis a partir de REDIS_URL (Upstash) ou REDIS_HOST/PORT */
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
export class BroadcastQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastQueueService.name)
  private queue!: Queue

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const connection = buildRedisConnection(this.config)
    this.queue = new Queue('beacon-broadcast', {
      connection,
      defaultJobOptions: {
        attempts:         3,
        backoff:          { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail:     50,
      },
    })
    this.logger.log('Fila beacon-broadcast inicializada')
  }

  async enqueue(data: BroadcastJobData): Promise<void> {
    await this.queue.add('send', data)
    this.logger.log(`Broadcast ${data.broadcastId} enfileirado (${data.contacts.length} contatos)`)
  }

  async onModuleDestroy() {
    await this.queue.close()
  }
}
