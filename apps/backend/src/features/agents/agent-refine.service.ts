/**
 * AgentRefineService — Refino e geração de conteúdo de agente com IA.
 *
 * Funcionalidades:
 * - Gerar DNA: cria personality + actionPrompt + conversationFlow a partir de info básica
 * - Refinar personality: melhora o texto existente
 * - Refinar actionPrompt: melhora as instruções existentes
 */

import { Injectable, Logger } from '@nestjs/common'
import { AiEngineService } from '@/infrastructure/ai-engine/ai-engine.service'

interface AgentContext {
  name: string
  companyName?: string
  companyUrl?: string
  description?: string
  purpose: string
  communicationTone: string
  personality?: string
  actionPrompt?: string
  conversationFlow?: string
}

@Injectable()
export class AgentRefineService {
  private readonly logger = new Logger(AgentRefineService.name)

  constructor(private readonly aiEngine: AiEngineService) {}

  /**
   * Gera DNA completo do agente: personality + actionPrompt + conversationFlow.
   */
  async generateDna(ctx: AgentContext): Promise<{ personality: string; actionPrompt: string; conversationFlow: string }> {
    const prompt = [
      'Voce e um especialista em criar agentes de IA para atendimento via WhatsApp.',
      '',
      `Preciso que gere o DNA completo de um agente com as seguintes informacoes:`,
      `- Nome do agente: ${ctx.name}`,
      `- Empresa: ${ctx.companyName ?? 'Nao informada'}`,
      `- Site: ${ctx.companyUrl ?? 'Nao informado'}`,
      `- Descricao: ${ctx.description ?? 'Nao informada'}`,
      `- Finalidade: ${ctx.purpose}`,
      `- Tom de comunicacao: ${ctx.communicationTone}`,
      '',
      'Retorne um JSON valido com exatamente estes 3 campos:',
      '```json',
      '{',
      '  "personality": "texto completo da personalidade do agente...",',
      '  "actionPrompt": "instrucoes de acao detalhadas...",',
      '  "conversationFlow": "1. Passo 1\\n2. Passo 2\\n..."',
      '}',
      '```',
      '',
      'REGRAS para o personality:',
      '- Defina quem o agente e (nome, funcao, empresa)',
      '- Como ele fala (tom, estilo, mensagens curtas)',
      '- Checklist mental antes de cada resposta',
      '- Adaptacao emocional (inseguro, entusiasmado, impaciente, desengajado)',
      '- Leitura indireta (sinais que substituem perguntas)',
      '- Secao NUNCA com restricoes explicitas (nao inventar, nao dar preco, etc)',
      '- Anti-patterns com exemplos de ERRADO vs CERTO',
      `- Tom ${ctx.communicationTone}: ajuste o estilo de escrita`,
      '- Maximo 300 caracteres por mensagem',
      '',
      'REGRAS para o actionPrompt:',
      '- Etapas numeradas claras (apresentacao, entender interesse, qualificar, direcionar, finalizar)',
      '- Minimo 4-5 trocas antes de transferir',
      '- Respostas padrao para preco, agendamento, pergunta medica, audio',
      '- Criterio claro de transferencia',
      '- Usar "atendente humano" como trigger interno (nao aparece pro cliente)',
      '- Nunca mencionar "transferir" ou "atendente" ao cliente',
      '',
      'REGRAS para o conversationFlow:',
      '- 5-7 passos numerados',
      '- Adaptado ao purpose (qualificacao, vendas, suporte, etc)',
      '- Claro e direto',
    ].join('\n')

    const result = await this.aiEngine.complete({
      messages: [{ role: 'user', content: prompt }],
      model: 'claude-sonnet-4-6',
      temperature: 0.4,
      maxTokens: 4000,
    })

    return this.parseJson(result.content, {
      personality: '',
      actionPrompt: '',
      conversationFlow: '',
    })
  }

  /**
   * Refina o campo personality existente.
   */
  async refinePersonality(ctx: AgentContext): Promise<string> {
    const prompt = [
      'Voce e um especialista em prompt engineering para agentes de WhatsApp.',
      '',
      'Refine o texto de PERSONALIDADE abaixo. Melhore sem mudar a essencia:',
      '',
      '- Torne mais especifico e acionavel (remova genericidades)',
      '- Adicione checklist mental se nao tiver',
      '- Adicione adaptacao emocional se nao tiver (inseguro, entusiasmado, impaciente, desengajado)',
      '- Adicione leitura indireta se nao tiver (sinais que substituem perguntas)',
      '- Reforce a secao NUNCA com linguagem enfatica',
      '- Adicione anti-patterns (ERRADO vs CERTO) se nao tiver',
      '- Mantenha o mesmo tom e estilo',
      '- Mantenha maximo 300 caracteres por mensagem como regra',
      '',
      `Contexto do agente:`,
      `- Nome: ${ctx.name}`,
      `- Empresa: ${ctx.companyName ?? 'N/A'}`,
      `- Finalidade: ${ctx.purpose}`,
      `- Tom: ${ctx.communicationTone}`,
      '',
      'Texto atual da personalidade:',
      '---',
      ctx.personality ?? '(vazio)',
      '---',
      '',
      'Retorne APENAS o texto refinado, sem explicacoes, sem JSON, sem markdown.',
    ].join('\n')

    const result = await this.aiEngine.complete({
      messages: [{ role: 'user', content: prompt }],
      model: 'claude-sonnet-4-6',
      temperature: 0.3,
      maxTokens: 3000,
    })

    return result.content.trim()
  }

  /**
   * Refina o campo actionPrompt existente.
   */
  async refineActionPrompt(ctx: AgentContext): Promise<string> {
    const prompt = [
      'Voce e um especialista em prompt engineering para agentes de WhatsApp.',
      '',
      'Refine as INSTRUCOES DE ACAO abaixo. Melhore sem mudar a essencia:',
      '',
      '- Torne as etapas mais claras e detalhadas',
      '- Adicione exemplos concretos de frases que o agente deve usar',
      '- Garanta que tem criterio claro de transferencia',
      '- Adicione respostas padrao se faltam (preco, agendamento, pergunta medica, audio)',
      '- Garanta minimo 4-5 trocas antes de transferir',
      '- Use "atendente humano" como trigger interno',
      '- Nunca mencionar "transferir" ou "atendente" ao cliente',
      '- Adicione regra de "responda a pergunta PRIMEIRO, depois avance"',
      '',
      `Contexto do agente:`,
      `- Nome: ${ctx.name}`,
      `- Empresa: ${ctx.companyName ?? 'N/A'}`,
      `- Finalidade: ${ctx.purpose}`,
      `- Tom: ${ctx.communicationTone}`,
      '',
      'Texto atual das instrucoes:',
      '---',
      ctx.actionPrompt ?? '(vazio)',
      '---',
      '',
      'Retorne APENAS o texto refinado, sem explicacoes, sem JSON, sem markdown.',
    ].join('\n')

    const result = await this.aiEngine.complete({
      messages: [{ role: 'user', content: prompt }],
      model: 'claude-sonnet-4-6',
      temperature: 0.3,
      maxTokens: 3000,
    })

    return result.content.trim()
  }

  private parseJson<T>(raw: string, fallback: T): T {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    try {
      return JSON.parse(match[0]) as T
    } catch {
      this.logger.warn('Failed to parse AI JSON response')
      return fallback
    }
  }
}
