/**
 * DispatchQueueService — Gerencia a fila BullMQ de disparo por Lead
 *
 * Cada lead tem seu próprio job com delay calculado em ms.
 * O delay é definido no momento do enfileiramento (resiliente a reinícios).
 *
 * Fila: beacon-campaign-dispatch (separada da beacon-broadcast existente)
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue, QueueEvents } from 'bullmq'

export const DISPATCH_QUEUE_NAME = 'beacon-campaign-dispatch'

export interface LeadJobData {
  leadId:      string
  campaignId:  string
  templateId:  string
  channelId:   string
}

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
      maxRetriesPerRequest: null as unknown as number,
      enableOfflineQueue:   false,
    }
  }
  return {
    host:                 config.get<string>('REDIS_HOST', 'localhost'),
    port:                 config.get<number>('REDIS_PORT', 6379),
    maxRetriesPerRequest: null as unknown as number,
    enableOfflineQueue:   false,
  }
}

@Injectable()
export class DispatchQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchQueueService.name)
  private queue!: Queue
  private queueEvents!: QueueEvents

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const connection = buildRedisConnection(this.config)
    this.queue = new Queue(DISPATCH_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts:         3,
        backoff:          { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail:     100,
      },
    })
    this.queueEvents = new QueueEvents(DISPATCH_QUEUE_NAME, { connection })
    this.logger.log(`Fila ${DISPATCH_QUEUE_NAME} inicializada`)
  }

  async enqueue(data: LeadJobData, delayMs: number): Promise<string> {
    const job = await this.queue.add('send-lead', data, { delay: delayMs })
    this.logger.debug(`Lead ${data.leadId} enfileirado com delay=${delayMs}ms (job ${job.id})`)
    return job.id!
  }

  async removeLeadJobs(leadId: string): Promise<void> {
    const jobs = await this.queue.getJobs(['delayed', 'waiting'])
    const toRemove = jobs.filter((j) => (j.data as LeadJobData)?.leadId === leadId)
    await Promise.all(toRemove.map((j) => j.remove()))
    if (toRemove.length) {
      this.logger.log(`Removidos ${toRemove.length} jobs pendentes do lead ${leadId}`)
    }
  }

  async getQueue() { return this.queue }

  async onModuleDestroy() {
    await this.queue.close()
    await this.queueEvents.close()
  }
}
