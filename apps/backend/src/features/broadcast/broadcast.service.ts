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

  findAll(tenantId: string) {
    return this.repo.findAll(tenantId)
  }

  async findById(id: string, tenantId: string) {
    const broadcast = await this.repo.findById(id, tenantId)
    if (!broadcast) throw new NotFoundException('Campanha não encontrada')
    return broadcast
  }

  /** Cria a campanha em DRAFT — não enfileira ainda */
  async create(dto: CreateBroadcastDto, tenantId: string) {
    return this.repo.create(dto, tenantId)
  }

  /** Lança campanha: DRAFT → QUEUED → enfileira no BullMQ */
  async launch(id: string, tenantId: string) {
    const broadcast = await this.findById(id, tenantId)
    await this.repo.updateStatus(id, 'QUEUED')
    await this.queue.enqueue({
      broadcastId:            id,
      tenantId,
      channelId:              broadcast.channelId ?? undefined,
      contacts:               broadcast.audience,
      template:               broadcast.template,
      messageDelayMinSeconds: broadcast.messageDelayMinSeconds,
      messageDelayMaxSeconds: broadcast.messageDelayMaxSeconds,
    })
    return this.repo.findById(id, tenantId)
  }

  // Chamados pelo BroadcastProcessorService (worker — sem contexto de request)
  markRunning(id: string)   { return this.repo.updateStatus(id, 'RUNNING') }
  markCompleted(id: string) { return this.repo.updateStatus(id, 'COMPLETED') }
  markFailed(id: string)    { return this.repo.updateStatus(id, 'FAILED') }
}
