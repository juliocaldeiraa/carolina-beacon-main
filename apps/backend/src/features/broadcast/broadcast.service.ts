/**
 * BroadcastService — Lógica de negócio de campanhas
 *
 * Spec: SPEC.md §6.4
 * - Cria campanhas em DRAFT
 * - Lança campanha: muda para QUEUED + enfileira job BullMQ
 * - Processor atualiza status para RUNNING → COMPLETED/FAILED
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import {
  IBroadcastRepository,
  CreateBroadcastDto,
  BROADCAST_REPOSITORY,
} from '@/core/repositories/IBroadcastRepository'
import { BroadcastQueueService } from './broadcast-queue.service'

@Injectable()
export class BroadcastService {
  constructor(
    @Inject(BROADCAST_REPOSITORY) private readonly repo: IBroadcastRepository,
    private readonly queue: BroadcastQueueService,
  ) {}

  findAll() {
    return this.repo.findAll()
  }

  async findById(id: string) {
    const broadcast = await this.repo.findById(id)
    if (!broadcast) throw new NotFoundException('Campanha não encontrada')
    return broadcast
  }

  /** Cria a campanha em DRAFT — não enfileira ainda */
  async create(dto: CreateBroadcastDto) {
    return this.repo.create(dto)
  }

  /** Lança campanha: DRAFT → QUEUED → enfileira no BullMQ */
  async launch(id: string, tenantId?: string) {
    const broadcast = await this.findById(id)
    await this.repo.updateStatus(id, 'QUEUED')
    await this.queue.enqueue({
      broadcastId:            id,
      tenantId:               tenantId ?? process.env.DEFAULT_TENANT_ID!,
      channelId:              broadcast.channelId ?? undefined,
      contacts:               broadcast.audience,
      template:               broadcast.template,
      messageDelayMinSeconds: broadcast.messageDelayMinSeconds,
      messageDelayMaxSeconds: broadcast.messageDelayMaxSeconds,
    })
    return this.repo.findById(id)
  }

  // Chamados pelo BroadcastProcessorService
  markRunning(id: string)   { return this.repo.updateStatus(id, 'RUNNING') }
  markCompleted(id: string) { return this.repo.updateStatus(id, 'COMPLETED') }
  markFailed(id: string)    { return this.repo.updateStatus(id, 'FAILED') }
}
