/**
 * AiEngineService — Motor de IA direto (Anthropic + OpenAI)
 *
 * Substitui o proxy LangGraph. Chama os SDKs de IA diretamente,
 * usando as chaves configuradas na tabela ai_providers.
 * Fallback: variáveis de ambiente ANTHROPIC_API_KEY / OPENAI_API_KEY.
 */

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiCompleteParams {
  messages: ChatMessage[]
  systemPrompt?: string
  model: string
  temperature?: number  // 0.0–1.0, default 0.6
  maxTokens?: number    // default 300
}

export interface AiCompleteResult {
  content: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ─── Roteamento por modelo ────────────────────────────────────────────────

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    // Prioridade 1: IA Central ativa (centralAiConfig) — fonte única de verdade
    const central = await this.prisma.centralAiConfig.findFirst({ where: { isActive: true } })
    if (central) {
      const centralParams = { ...params, model: central.model }
      if (central.provider === 'ANTHROPIC') {
        return this.callAnthropicWithKey(centralParams, central.apiKey)
      } else {
        return this.callOpenAIWithKey(centralParams, central.apiKey)
      }
    }

    // Prioridade 2: roteamento legado por nome de modelo (ai_providers)
    const { model } = params
    if (model.startsWith('claude-')) return this.callAnthropic(params)
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return this.callOpenAI(params)

    this.logger.warn(`Modelo desconhecido "${model}", tentando Anthropic como fallback`)
    return this.callAnthropic(params)
  }

  // ─── Anthropic ────────────────────────────────────────────────────────────

  private async callAnthropic(params: AiCompleteParams): Promise<AiCompleteResult> {
    return this.callAnthropicWithKey(params, await this.getApiKey('ANTHROPIC'))
  }

  private async callAnthropicWithKey(params: AiCompleteParams, apiKey: string): Promise<AiCompleteResult> {
    const client = new Anthropic({ apiKey })
    const start  = Date.now()

    try {
      const response = await client.messages.create({
        model:       params.model,
        max_tokens:  params.maxTokens ?? 300,
        temperature: params.temperature ?? 0.6,
        system:      params.systemPrompt || undefined,
        messages:    params.messages.map((m) => ({ role: m.role, content: m.content })),
      })

      const content = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('')

      return {
        content,
        inputTokens:  response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs:    Date.now() - start,
      }
    } catch (err: any) {
      this.logger.error('Anthropic call failed', err?.message)
      throw new ServiceUnavailableException(`Erro ao chamar Anthropic: ${err?.message ?? 'desconhecido'}`)
    }
  }

  // ─── OpenAI ───────────────────────────────────────────────────────────────

  private async callOpenAI(params: AiCompleteParams): Promise<AiCompleteResult> {
    return this.callOpenAIWithKey(params, await this.getApiKey('OPENAI'))
  }

  private async callOpenAIWithKey(params: AiCompleteParams, apiKey: string): Promise<AiCompleteResult> {
    const client = new OpenAI({ apiKey })
    const start  = Date.now()

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt })
    }
    messages.push(...params.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })))

    try {
      const response = await client.chat.completions.create({
        model:       params.model,
        messages,
        temperature: params.temperature ?? 0.6,
        max_tokens:  params.maxTokens   ?? 300,
      })

      const content = response.choices[0]?.message?.content ?? ''

      return {
        content,
        inputTokens:  response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        latencyMs:    Date.now() - start,
      }
    } catch (err: any) {
      this.logger.error('OpenAI call failed', err?.message)
      throw new ServiceUnavailableException(`Erro ao chamar OpenAI: ${err?.message ?? 'desconhecido'}`)
    }
  }

  // ─── Busca de chave de API ────────────────────────────────────────────────

  private async getApiKey(type: 'ANTHROPIC' | 'OPENAI'): Promise<string> {
    // 1. Busca provedor ativo na tabela ai_providers
    const provider = await this.prisma.aiProvider.findFirst({
      where: { type, isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    if (provider?.apiKey) {
      this.logger.debug(`Usando chave de ai_providers (${type})`)
      return provider.apiKey
    }

    // 2. Fallback: variável de ambiente
    const envKey = type === 'ANTHROPIC'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY

    if (envKey) {
      this.logger.debug(`Usando chave de env (${type})`)
      return envKey
    }

    throw new ServiceUnavailableException(
      `Nenhuma chave de API ${type} configurada. Adicione em Configurações → Provedores de IA.`,
    )
  }
}
