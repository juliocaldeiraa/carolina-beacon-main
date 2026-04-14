/**
 * MediaProcessingService — Transcricao de audio (Whisper) e analise de imagem (Vision)
 *
 * Recebe base64 ou URL de midia e retorna texto processado.
 * Usado pelo webhook-ingestion para processar audio/imagem antes de enviar pra IA.
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transcreve audio usando OpenAI Whisper API.
   * Aceita base64 ou URL. Retorna texto transcrito.
   */
  async transcribeAudio(base64?: string, url?: string, mime = 'audio/ogg'): Promise<string | null> {
    const apiKey = await this.getOpenAiKey()
    if (!apiKey) {
      this.logger.warn('OpenAI API key not found — cannot transcribe audio')
      return null
    }

    try {
      let audioBuffer: Buffer

      if (base64) {
        audioBuffer = Buffer.from(base64, 'base64')
      } else if (url) {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`)
        audioBuffer = Buffer.from(await res.arrayBuffer())
      } else {
        return null
      }

      // Determine file extension from mime
      const ext = mime.includes('ogg') ? 'ogg'
        : mime.includes('mp4') ? 'm4a'
        : mime.includes('mpeg') ? 'mp3'
        : mime.includes('webm') ? 'webm'
        : 'ogg'

      // Build multipart form data
      const blob = new Blob([audioBuffer], { type: mime })
      const formData = new FormData()
      formData.append('file', blob, `audio.${ext}`)
      formData.append('model', 'whisper-1')
      formData.append('language', 'pt')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const err = await response.text()
        this.logger.error(`Whisper API error: ${response.status} — ${err}`)
        return null
      }

      const result = await response.json() as { text: string }
      this.logger.log(`Audio transcribed: ${result.text.slice(0, 80)}...`)
      return result.text.trim() || null
    } catch (error) {
      this.logger.error(`Audio transcription failed: ${error}`)
      return null
    }
  }

  /**
   * Analisa imagem usando OpenAI GPT-4o Vision.
   * Aceita base64 ou URL. Retorna descricao textual.
   */
  async analyzeImage(base64?: string, url?: string, mime = 'image/jpeg', caption?: string): Promise<string | null> {
    const apiKey = await this.getOpenAiKey()
    if (!apiKey) {
      this.logger.warn('OpenAI API key not found — cannot analyze image')
      return null
    }

    try {
      let imageContent: { type: 'image_url'; image_url: { url: string } }

      if (base64) {
        imageContent = {
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${base64}` },
        }
      } else if (url) {
        imageContent = {
          type: 'image_url',
          image_url: { url },
        }
      } else {
        return null
      }

      const userContent: any[] = [imageContent]
      if (caption) {
        userContent.push({ type: 'text', text: `Legenda da imagem: ${caption}` })
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Descreva o conteudo da imagem de forma objetiva e concisa em portugues. Se for uma foto de parte do corpo ou area de interesse estetico, descreva o que voce ve. Maximo 2 frases.',
            },
            {
              role: 'user',
              content: userContent,
            },
          ],
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const err = await response.text()
        this.logger.error(`Vision API error: ${response.status} — ${err}`)
        return null
      }

      const result = await response.json() as any
      const text = result.choices?.[0]?.message?.content?.trim()
      this.logger.log(`Image analyzed: ${text?.slice(0, 80)}...`)
      return text || null
    } catch (error) {
      this.logger.error(`Image analysis failed: ${error}`)
      return null
    }
  }

  /**
   * Busca API key do OpenAI no CentralAiConfig.
   * Procura config com provider OPENAI, ou usa qualquer uma disponivel.
   */
  private async getOpenAiKey(): Promise<string | null> {
    // Primeiro tenta env
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY

    // Busca no CentralAiConfig
    const config = await this.prisma.centralAiConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    if (config?.provider === 'OPENAI') return config.apiKey

    // Busca no AiProvider
    const provider = await this.prisma.aiProvider.findFirst({
      where: { type: 'OPENAI', isActive: true },
    })

    return provider?.apiKey ?? null
  }
}
