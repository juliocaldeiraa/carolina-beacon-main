/**
 * Metric — Entidade de domínio para Observabilidade
 * Ref: PRD — Dashboard & Key Metrics (4 categorias)
 */

export interface Metric {
  id: string
  tenantId: string
  agentId: string
  conversationId?: string

  // Performance
  latencyMs?: number
  ttftMs?: number
  successRate?: number
  fallbackRate?: number

  // Financial
  inputTokens?: number
  outputTokens?: number
  costUsd?: number

  // Quality
  sentimentScore?: number
  hallucinationScore?: number
  userRating?: number
  relevanceScore?: number

  // Engagement
  turnsCount?: number

  recordedAt: Date
}
