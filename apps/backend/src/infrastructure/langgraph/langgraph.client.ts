/**
 * LangGraphClient — Proxy HTTP para o microservice Python de orquestração
 * Ref: PRD — Core Orchestration (LangGraph)
 *
 * O microservice Python expõe:
 *   POST /invoke  → { agentId, systemPrompt, tools, model, message }
 *                ← { reply, inputTokens, outputTokens, latencyMs }
 */

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Agent } from '../../core/entities/Agent'

interface LangGraphResponse {
  reply: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

@Injectable()
export class LangGraphClient {
  private readonly logger = new Logger(LangGraphClient.name)
  private readonly baseUrl: string

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('LANGGRAPH_URL', 'http://localhost:8000')
  }

  async invoke(agent: Agent, message: string): Promise<LangGraphResponse> {
    const start = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId:     agent.id,
          model:       agent.model,
          systemPrompt: agent.systemPrompt ?? '',
          tools:       agent.tools ?? [],
          message,
        }),
      })

      if (!response.ok) {
        throw new Error(`LangGraph responded with ${response.status}`)
      }

      const data = (await response.json()) as LangGraphResponse
      return {
        ...data,
        latencyMs: data.latencyMs ?? Date.now() - start,
      }
    } catch (err) {
      this.logger.error('LangGraph invocation failed', err)
      throw new ServiceUnavailableException('Serviço de agente indisponível no momento')
    }
  }
}
