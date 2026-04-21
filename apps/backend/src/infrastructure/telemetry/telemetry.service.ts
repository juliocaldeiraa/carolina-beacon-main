/**
 * TelemetryService — Captura de métricas via OpenTelemetry
 *
 * Ref: PRD — "LLM Instrumentation"
 * Instrumenta chamadas ao LLM e persiste métricas assíncronamente via BullMQ
 */

import { Injectable, Logger } from '@nestjs/common'
import { MetricsService } from '../../features/metrics/metrics.service'

export interface LLMCallEvent {
  tenantId:      string
  agentId:       string
  conversationId?: string
  // Performance
  latencyMs:     number
  ttftMs?:       number
  success:       boolean
  fallback:      boolean
  // Financial
  inputTokens:   number
  outputTokens:  number
  model:         string
  // Quality
  sentimentScore?:     number
  hallucinationScore?: number
  userRating?:         number
  relevanceScore?:     number
  // Engagement
  turnsCount?: number
}

const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 0.003,  output: 0.015 },
  'claude-opus-4-6':   { input: 0.015,  output: 0.075 },
  'claude-haiku-4-5':  { input: 0.00025,output: 0.00125 },
  'gpt-4o':            { input: 0.0025, output: 0.01 },
  'gpt-4o-mini':       { input: 0.00015,output: 0.0006 },
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name)

  constructor(private readonly metricsService: MetricsService) {}

  /** Registra um evento de chamada LLM e calcula custo */
  async recordLLMCall(event: LLMCallEvent): Promise<void> {
    try {
      const costs = TOKEN_COST_PER_1K[event.model]
      const costUsd = costs
        ? (event.inputTokens / 1000) * costs.input +
          (event.outputTokens / 1000) * costs.output
        : undefined

      await this.metricsService.record({
        tenantId:       event.tenantId,
        agentId:        event.agentId,
        conversationId: event.conversationId,
        latencyMs:      event.latencyMs,
        ttftMs:         event.ttftMs,
        successRate:    event.success ? 1 : 0,
        fallbackRate:   event.fallback ? 1 : 0,
        inputTokens:    event.inputTokens,
        outputTokens:   event.outputTokens,
        costUsd,
        sentimentScore:     event.sentimentScore,
        hallucinationScore: event.hallucinationScore,
        userRating:         event.userRating,
        relevanceScore:     event.relevanceScore,
        turnsCount:         event.turnsCount,
      })
    } catch (err) {
      this.logger.error('Failed to record LLM metric', err)
    }
  }
}
