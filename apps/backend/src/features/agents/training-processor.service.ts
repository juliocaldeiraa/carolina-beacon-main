/**
 * TrainingProcessorService — Processa conteúdo raw com IA antes de virar training.
 *
 * Fluxo: texto raw -> IA extrai/categoriza/formata -> training(s) com status ready.
 * Suporta: texto manual, URL (single + crawl), documentos (MD, PDF, DOCX).
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { AiEngineService } from '@/infrastructure/ai-engine/ai-engine.service'
import * as cheerio from 'cheerio'

interface ProcessedTrainingItem {
  category: string
  title: string
  content: string
}

@Injectable()
export class TrainingProcessorService {
  private readonly logger = new Logger(TrainingProcessorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
  ) {}

  /**
   * Processa texto raw com IA e cria trainings categorizados.
   */
  async processText(agentId: string, rawText: string, sourceTitle?: string): Promise<void> {
    const training = await this.prisma.agentTraining.create({
      data: {
        agentId,
        type: 'text',
        title: sourceTitle ?? 'Processando...',
        content: rawText,
        status: 'processing',
        category: 'general',
        metadata: { charCount: rawText.length, source: 'text' },
      },
    })

    try {
      const items = await this.extractWithAi(rawText)
      await this.prisma.agentTraining.delete({ where: { id: training.id } })
      for (const item of items) {
        await this.prisma.agentTraining.create({
          data: {
            agentId,
            type: 'text',
            title: item.title,
            content: item.content,
            status: 'ready',
            category: item.category,
            metadata: { charCount: item.content.length, source: 'text', processedByAi: true },
          },
        })
      }
    } catch (error) {
      this.logger.error(`Failed to process training ${training.id}`, error)
      await this.prisma.agentTraining.update({
        where: { id: training.id },
        data: { status: 'error' },
      })
    }
  }

  /**
   * Faz scrape de uma URL (single page ou crawl) e processa com IA.
   */
  async processUrl(agentId: string, url: string, crawl = false, maxPages = 5): Promise<void> {
    const training = await this.prisma.agentTraining.create({
      data: {
        agentId,
        type: 'url',
        title: `Importando: ${url}`,
        content: url,
        status: 'processing',
        category: 'general',
        metadata: { url, crawl, source: 'url' },
      },
    })

    try {
      const fullText = crawl
        ? await this.crawlWebsite(url, maxPages)
        : await this.scrapePage(url)

      if (!fullText.trim()) {
        throw new Error('Nenhum conteúdo extraído da URL')
      }

      const items = await this.extractWithAi(fullText)
      await this.prisma.agentTraining.delete({ where: { id: training.id } })
      for (const item of items) {
        await this.prisma.agentTraining.create({
          data: {
            agentId,
            type: 'url',
            title: item.title,
            content: item.content,
            status: 'ready',
            category: item.category,
            metadata: { charCount: item.content.length, source: 'url', url, processedByAi: true },
          },
        })
      }
    } catch (error) {
      this.logger.error(`Failed to process URL ${url}`, error)
      await this.prisma.agentTraining.update({
        where: { id: training.id },
        data: { status: 'error', content: `Erro: ${(error as Error).message}` },
      })
    }
  }

  /**
   * Processa documento (MD, PDF, DOCX) e cria trainings.
   */
  async processDocument(agentId: string, buffer: Buffer, fileName: string, mimeType: string): Promise<void> {
    const training = await this.prisma.agentTraining.create({
      data: {
        agentId,
        type: 'document',
        title: `Processando: ${fileName}`,
        content: '',
        status: 'processing',
        category: 'general',
        metadata: { fileName, mimeType, source: 'document' },
      },
    })

    try {
      let text: string

      if (fileName.endsWith('.md') || mimeType === 'text/markdown') {
        text = buffer.toString('utf-8')
      } else if (fileName.endsWith('.pdf') || mimeType === 'application/pdf') {
        const pdfModule = await import('pdf-parse')
        const pdfParse = pdfModule.default ?? pdfModule
        const result = await (pdfParse as any)(buffer)
        text = result.text
      } else if (
        fileName.endsWith('.docx') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else {
        text = buffer.toString('utf-8')
      }

      if (!text.trim()) {
        throw new Error('Nenhum conteúdo extraído do documento')
      }

      const items = await this.extractWithAi(text)
      await this.prisma.agentTraining.delete({ where: { id: training.id } })
      for (const item of items) {
        await this.prisma.agentTraining.create({
          data: {
            agentId,
            type: 'document',
            title: item.title,
            content: item.content,
            status: 'ready',
            category: item.category,
            metadata: { charCount: item.content.length, source: 'document', fileName, processedByAi: true },
          },
        })
      }
    } catch (error) {
      this.logger.error(`Failed to process document ${fileName}`, error)
      await this.prisma.agentTraining.update({
        where: { id: training.id },
        data: { status: 'error', content: `Erro: ${(error as Error).message}` },
      })
    }
  }

  /**
   * Processa feedback de conversa e gera regra generalizada.
   */
  async processFeedback(
    feedbackId: string,
    clientMessage: string,
    agentResponse: string,
    feedbackText: string,
  ): Promise<string> {
    const prompt = [
      'Você é um especialista em qualidade de atendimento por IA.',
      '',
      'Analise a interação abaixo e o feedback do supervisor. Gere uma REGRA GENERALIZADA que a IA deve seguir em situações similares no futuro.',
      '',
      `Mensagem do cliente: "${clientMessage}"`,
      `Resposta do agente: "${agentResponse}"`,
      `Feedback do supervisor: "${feedbackText}"`,
      '',
      'Retorne APENAS a regra, em uma frase clara e direta. Exemplo:',
      '"Quando o cliente demonstrar intenção clara de agendar, ofereça horários disponíveis diretamente em vez de fazer perguntas adicionais."',
    ].join('\n')

    const result = await this.aiEngine.complete({
      messages:     [{ role: 'user', content: prompt }],
      model:        'claude-sonnet-4-20250514',
      temperature:  0.3,
      maxTokens:    300,
    })

    return result.content
  }

  // ── Private helpers ──

  private async extractWithAi(rawText: string): Promise<ProcessedTrainingItem[]> {
    const truncated = rawText.length > 15000 ? rawText.slice(0, 15000) + '\n\n[... conteúdo truncado]' : rawText

    const prompt = [
      'Analise o conteúdo abaixo e extraia informações estruturadas para ser usado como base de conhecimento de um agente de IA.',
      '',
      'Retorne um JSON válido com o seguinte formato:',
      '```json',
      '{ "items": [{ "category": "faq|services|pricing|policies|scripts|general", "title": "título descritivo", "content": "informação processada" }] }',
      '```',
      '',
      'Regras:',
      '- Remova informações vagas, ambíguas ou irrelevantes',
      '- Mantenha dados factuais (preços, nomes, horários, endereços) EXATOS',
      '- Se houver múltiplas categorias de informação, separe em múltiplos itens',
      '- Formato conciso — clareza e objetividade, não prosa',
      '- Cada item deve ser auto-contido (entendível sem os outros)',
      '- Use "pricing" para qualquer informação de valor/preço',
      '- Use "faq" para perguntas e respostas comuns',
      '- Use "services" para lista de serviços/produtos',
      '- Use "policies" para regras, horários, políticas',
      '- Use "scripts" para frases modelo ou roteiros de atendimento',
      '- Use "general" para contexto geral que não se encaixa nas outras',
      '',
      'Conteúdo para processar:',
      '---',
      truncated,
    ].join('\n')

    const result = await this.aiEngine.complete({
      messages:     [{ role: 'user', content: prompt }],
      model:        'claude-sonnet-4-20250514',
      temperature:  0.2,
      maxTokens:    4000,
    })

    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      this.logger.warn('AI did not return valid JSON, using raw content')
      return [{ category: 'general', title: 'Conteúdo importado', content: rawText.slice(0, 5000) }]
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      const items: ProcessedTrainingItem[] = (parsed.items || [parsed]).map((item: any) => ({
        category: item.category ?? 'general',
        title:    item.title ?? 'Sem título',
        content:  item.content ?? '',
      }))
      return items.filter((i) => i.content.trim().length > 0)
    } catch {
      this.logger.warn('Failed to parse AI response JSON')
      return [{ category: 'general', title: 'Conteúdo importado', content: rawText.slice(0, 5000) }]
    }
  }

  private async scrapePage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BeaconBot/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await response.text()
    return this.extractTextFromHtml(html)
  }

  private async crawlWebsite(baseUrl: string, maxPages: number): Promise<string> {
    const visited = new Set<string>()
    const toVisit = [baseUrl]
    const texts: string[] = []
    const baseHost = new URL(baseUrl).hostname

    while (toVisit.length > 0 && visited.size < maxPages) {
      const url = toVisit.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'BeaconBot/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        const html = await response.text()
        texts.push(this.extractTextFromHtml(html))

        const $ = cheerio.load(html)
        $('a[href]').each((_, el) => {
          try {
            const href = $(el).attr('href')
            if (!href) return
            const resolved = new URL(href, url)
            if (resolved.hostname === baseHost && !visited.has(resolved.href)) {
              toVisit.push(resolved.href)
            }
          } catch { /* ignore invalid URLs */ }
        })
      } catch (error) {
        this.logger.warn(`Failed to crawl ${url}: ${(error as Error).message}`)
      }
    }

    return texts.join('\n\n---\n\n')
  }

  private extractTextFromHtml(html: string): string {
    const $ = cheerio.load(html)
    $('script, style, nav, footer, header, noscript, iframe').remove()
    return $('body').text().replace(/\s+/g, ' ').trim()
  }
}
