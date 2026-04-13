/**
 * AiEngineService — Motor de IA direto (Anthropic + OpenAI)
 *
 * Suporta tool_use/function_calling:
 * 1. Chama LLM com tools disponíveis
 * 2. Se LLM responde com tool_use, executa via onToolCall callback
 * 3. Passa resultado de volta ao LLM
 * 4. Repete até LLM responder com texto final (máx 5 loops)
 */

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiTool {
  name: string
  description: string
  input_schema: Record<string, any>
}

export interface AiCompleteParams {
  messages: ChatMessage[]
  systemPrompt?: string
  model: string
  temperature?: number
  maxTokens?: number
  tools?: AiTool[]
  onToolCall?: (name: string, input: any) => Promise<any>
}

export interface AiCompleteResult {
  content: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

const MAX_TOOL_LOOPS = 5

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name)

  constructor(private readonly prisma: PrismaService) {}

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    const central = await this.prisma.centralAiConfig.findFirst({ where: { isActive: true } })
    if (central) {
      const centralParams = { ...params, model: central.model }
      if (central.provider === 'ANTHROPIC') {
        return this.callAnthropicWithKey(centralParams, central.apiKey)
      } else {
        return this.callOpenAIWithKey(centralParams, central.apiKey)
      }
    }

    const { model } = params
    if (model.startsWith('claude-')) return this.callAnthropic(params)
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return this.callOpenAI(params)

    this.logger.warn(`Modelo desconhecido "${model}", tentando Anthropic como fallback`)
    return this.callAnthropic(params)
  }

  // ─── Anthropic (com tool_use) ─────────────────────────────────────────────

  private async callAnthropic(params: AiCompleteParams): Promise<AiCompleteResult> {
    return this.callAnthropicWithKey(params, await this.getApiKey('ANTHROPIC'))
  }

  private async callAnthropicWithKey(params: AiCompleteParams, apiKey: string): Promise<AiCompleteResult> {
    const client = new Anthropic({ apiKey })
    const start  = Date.now()
    let totalInput  = 0
    let totalOutput = 0

    const anthropicTools = params.tools?.map((t) => ({
      name:         t.name,
      description:  t.description,
      input_schema: t.input_schema,
    }))

    // Build initial messages
    const messages: Anthropic.MessageParam[] = params.messages.map((m) => ({
      role: m.role, content: m.content,
    }))

    try {
      for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
        const createParams: any = {
          model:       params.model,
          max_tokens:  params.maxTokens ?? 300,
          temperature: params.temperature ?? 0.6,
          system:      params.systemPrompt || undefined,
          messages,
        }
        if (anthropicTools?.length) createParams.tools = anthropicTools
        const response = await client.messages.create(createParams)

        totalInput  += response.usage.input_tokens
        totalOutput += response.usage.output_tokens

        // Check if response has tool_use blocks
        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
        const textBlocks    = response.content.filter((b) => b.type === 'text')

        // If no tool calls or no callback, return text
        if (toolUseBlocks.length === 0 || !params.onToolCall) {
          const content = textBlocks
            .map((b) => (b as Anthropic.TextBlock).text)
            .join('')

          return {
            content,
            inputTokens:  totalInput,
            outputTokens: totalOutput,
            latencyMs:    Date.now() - start,
          }
        }

        // Execute tool calls and continue the loop
        // Add assistant message with tool_use
        messages.push({ role: 'assistant', content: response.content })

        // Execute each tool and add results
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of toolUseBlocks) {
          const toolBlock = block as Anthropic.ToolUseBlock
          this.logger.log(`Tool call: ${toolBlock.name}(${JSON.stringify(toolBlock.input)})`)

          try {
            const result = await params.onToolCall(toolBlock.name, toolBlock.input)
            toolResults.push({
              type:       'tool_result',
              tool_use_id: toolBlock.id,
              content:    typeof result === 'string' ? result : JSON.stringify(result),
            })
          } catch (err: any) {
            toolResults.push({
              type:       'tool_result',
              tool_use_id: toolBlock.id,
              content:    JSON.stringify({ error: err?.message ?? 'Tool execution failed' }),
              is_error:   true,
            })
          }
        }

        messages.push({ role: 'user', content: toolResults })
      }

      // Max loops reached — return whatever we have
      return {
        content: 'Desculpe, não consegui completar a operação. Tente novamente.',
        inputTokens:  totalInput,
        outputTokens: totalOutput,
        latencyMs:    Date.now() - start,
      }
    } catch (err: any) {
      this.logger.error('Anthropic call failed', err?.message)
      throw new ServiceUnavailableException(`Erro ao chamar Anthropic: ${err?.message ?? 'desconhecido'}`)
    }
  }

  // ─── OpenAI (com function_calling) ────────────────────────────────────────

  private async callOpenAI(params: AiCompleteParams): Promise<AiCompleteResult> {
    return this.callOpenAIWithKey(params, await this.getApiKey('OPENAI'))
  }

  private async callOpenAIWithKey(params: AiCompleteParams, apiKey: string): Promise<AiCompleteResult> {
    const client = new OpenAI({ apiKey })
    const start  = Date.now()
    let totalInput  = 0
    let totalOutput = 0

    const openaiTools: OpenAI.Chat.ChatCompletionTool[] | undefined = params.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name:        t.name,
        description: t.description,
        parameters:  t.input_schema,
      },
    }))

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt })
    }
    messages.push(...params.messages.map((m) => ({
      role: m.role as 'user' | 'assistant', content: m.content,
    })))

    try {
      for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
        const response = await client.chat.completions.create({
          model:       params.model,
          messages,
          temperature: params.temperature ?? 0.6,
          max_tokens:  params.maxTokens   ?? 300,
          ...(openaiTools?.length ? { tools: openaiTools } : {}),
        })

        totalInput  += response.usage?.prompt_tokens ?? 0
        totalOutput += response.usage?.completion_tokens ?? 0

        const choice = response.choices[0]
        const msg    = choice?.message

        // If no tool calls or no callback, return content
        if (!msg?.tool_calls?.length || !params.onToolCall) {
          return {
            content:      msg?.content ?? '',
            inputTokens:  totalInput,
            outputTokens: totalOutput,
            latencyMs:    Date.now() - start,
          }
        }

        // Add assistant message with tool calls
        messages.push(msg)

        // Execute each tool call
        for (const toolCall of msg.tool_calls) {
          const fn = (toolCall as any).function
          const fnName = fn.name
          let fnArgs: any = {}
          try { fnArgs = JSON.parse(fn.arguments) } catch {}

          this.logger.log(`Tool call: ${fnName}(${JSON.stringify(fnArgs)})`)

          try {
            const result = await params.onToolCall(fnName, fnArgs)
            messages.push({
              role:         'tool',
              tool_call_id: toolCall.id,
              content:      typeof result === 'string' ? result : JSON.stringify(result),
            })
          } catch (err: any) {
            messages.push({
              role:         'tool',
              tool_call_id: toolCall.id,
              content:      JSON.stringify({ error: err?.message ?? 'Tool execution failed' }),
            })
          }
        }
      }

      return {
        content: 'Desculpe, não consegui completar a operação. Tente novamente.',
        inputTokens:  totalInput,
        outputTokens: totalOutput,
        latencyMs:    Date.now() - start,
      }
    } catch (err: any) {
      this.logger.error('OpenAI call failed', err?.message)
      throw new ServiceUnavailableException(`Erro ao chamar OpenAI: ${err?.message ?? 'desconhecido'}`)
    }
  }

  // ─── Busca de chave de API ────────────────────────────────────────────────

  private async getApiKey(type: 'ANTHROPIC' | 'OPENAI'): Promise<string> {
    const provider = await this.prisma.aiProvider.findFirst({
      where: { type, isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    if (provider?.apiKey) return provider.apiKey

    const envKey = type === 'ANTHROPIC'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY

    if (envKey) return envKey

    throw new ServiceUnavailableException(
      `Nenhuma chave de API ${type} configurada. Adicione em Configurações → Provedores de IA.`,
    )
  }
}
