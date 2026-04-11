/**
 * MessageSplitterService — Fatia respostas de IA em mensagens WhatsApp-style
 *
 * Usa a IA Central ativa (central_ai_config) para dividir a resposta de forma
 * natural, aplicando formatação WhatsApp e separando em múltiplos fragmentos.
 *
 * Baseado no fluxo n8n de WhatsApp (Parser Chain + OutputParser).
 * Fallback: retorna o texto original como array de 1 item se não houver
 * IA Central ativa ou se a chamada falhar.
 */

import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI    from 'openai'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

const SPLIT_SYSTEM_PROMPT = `Por favor, gere a saída no seguinte formato JSON:
{
  "messages": [
    "splitedMessage",
    "splitedMessage"
  ]
}

As mensagens devem ser divididas de forma natural, afinal estamos conversando com um humano, não é mesmo?

Certifique-se de que a resposta siga exatamente essa estrutura, incluindo os colchetes e as aspas.

### Jamais separe uma mensagem vazia.

### Certifique-se de que a resposta siga exatamente essa estrutura abaixo, deixando somente entre '*' para negrito e nunca fugindo das demais regras de markdown do whatsapp:
  - *negrito* (substitua '**' por '*')
  - ~tachado~ (caso seja algo que foi excluído ou alterado)
  - _itálico_.(extremamente raro)

### REGRA CRÍTICA SOBRE LINKS/URLs:
- NUNCA envolva URLs em backticks (\`), asteriscos, underscores ou qualquer outra formatação.
- NUNCA quebre uma URL em múltiplas linhas ou adicione espaços dentro de uma URL.
- Preserve toda URL exatamente como foi recebida, sem qualquer modificação.
- URLs devem aparecer cruas no texto, ex: https://exemplo.com/pagina`

@Injectable()
export class MessageSplitterService {
  private readonly logger = new Logger(MessageSplitterService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Divide um texto em múltiplos fragmentos WhatsApp-style via IA Central.
   * Retorna array de 1 item (texto original) se não houver IA Central ativa.
   */
  async split(text: string): Promise<string[]> {
    const config = await this.prisma.centralAiConfig.findFirst({
      where: { isActive: true },
    })

    if (!config) {
      this.logger.debug('Nenhuma IA Central ativa — retornando texto sem fatiar')
      return [text]
    }

    const userPrompt = `Whatsapp message to be splitted and formatted: ${text}`

    try {
      let rawContent: string

      if (config.provider === 'ANTHROPIC') {
        const client = new Anthropic({ apiKey: config.apiKey })
        const res = await client.messages.create({
          model:      config.model,
          max_tokens: 1024,
          system:     SPLIT_SYSTEM_PROMPT,
          messages:   [{ role: 'user', content: userPrompt }],
        })
        rawContent = res.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as Anthropic.TextBlock).text)
          .join('')
      } else {
        // OPENAI ou GOOGLE (OpenAI-compatible)
        const client = new OpenAI({ apiKey: config.apiKey })
        const res = await client.chat.completions.create({
          model:      config.model,
          max_tokens: 1024,
          messages:   [
            { role: 'system', content: SPLIT_SYSTEM_PROMPT },
            { role: 'user',   content: userPrompt },
          ],
        })
        rawContent = res.choices[0]?.message?.content ?? ''
      }

      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return [text]

      const parsed = JSON.parse(jsonMatch[0]) as { messages?: unknown[] }
      const msgs = parsed.messages

      if (!Array.isArray(msgs) || msgs.length === 0) return [text]

      const filtered = msgs.filter(
        (m): m is string => typeof m === 'string' && m.trim().length > 0,
      )

      return filtered.length > 0 ? filtered : [text]
    } catch (err) {
      this.logger.warn(`split falhou: ${err} — retornando texto original`)
      return [text]
    }
  }
}
