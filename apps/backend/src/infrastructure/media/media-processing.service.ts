/**
 * MediaProcessingService — Transcricao de audio (Whisper) e analise de imagem (Vision)
 *
 * Recebe base64 ou URL de midia e retorna texto processado.
 * Usado pelo webhook-ingestion para processar audio/imagem antes de enviar pra IA.
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import type { Channel, ChannelConfig } from '@/core/entities/Channel'

export interface EvolutionDecryptHint {
  channel: Channel
  messageId: string
}

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * WhatsApp encripta mídia E2E — o URL retorna blob criptografado.
   * Chama a Evolution pra devolver o base64 decriptado.
   */
  private async decryptFromEvolution(hint: EvolutionDecryptHint): Promise<{ base64: string; mimetype?: string } | null> {
    if (hint.channel.type !== 'EVOLUTION_API') return null
    const cfg = hint.channel.config as ChannelConfig
    const instanceUrl  = cfg.instanceUrl
    const instanceName = cfg.instanceName
    const apiKey       = cfg.apiKey
    if (!instanceUrl || !instanceName || !apiKey) {
      this.logger.warn('Evolution decrypt skipped: instanceUrl/instanceName/apiKey ausentes no channel.config')
      return null
    }
    try {
      const url = `${instanceUrl.replace(/\/$/, '')}/chat/getBase64FromMediaMessage/${instanceName}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ message: { key: { id: hint.messageId } }, convertToMp4: false }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        const err = await res.text()
        this.logger.warn(`Evolution decrypt ${res.status}: ${err.slice(0, 200)}`)
        return null
      }
      const body = await res.json() as { base64?: string; mimetype?: string }
      if (!body.base64) {
        this.logger.warn('Evolution decrypt: resposta sem base64')
        return null
      }
      return { base64: body.base64, mimetype: body.mimetype }
    } catch (err) {
      this.logger.warn(`Evolution decrypt falhou: ${err}`)
      return null
    }
  }

  /**
   * Transcreve audio usando OpenAI Whisper API.
   * Aceita base64 ou URL. Retorna texto transcrito.
   * Se `decryptHint` for fornecido, tenta primeiro decriptar via Evolution (WhatsApp E2E).
   */
  async transcribeAudio(
    base64?: string,
    url?: string,
    mime = 'audio/ogg',
    decryptHint?: EvolutionDecryptHint,
  ): Promise<string | null> {
    const apiKey = await this.getOpenAiKey()
    if (!apiKey) {
      this.logger.warn('OpenAI API key not found — cannot transcribe audio')
      return null
    }

    try {
      let audioBuffer: Buffer
      let source: 'evolution' | 'base64' | 'url' = 'base64'

      // 1ª tentativa: decriptar via Evolution (WhatsApp manda mídia E2E encrypted)
      if (decryptHint) {
        const decrypted = await this.decryptFromEvolution(decryptHint)
        if (decrypted) {
          audioBuffer = Buffer.from(decrypted.base64, 'base64')
          if (decrypted.mimetype) mime = decrypted.mimetype
          source = 'evolution'
        } else if (base64 && base64.length > 100) {
          audioBuffer = Buffer.from(base64, 'base64')
        } else if (url) {
          source = 'url'
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
          if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`)
          audioBuffer = Buffer.from(await res.arrayBuffer())
        } else {
          this.logger.warn('Transcribe skipped: decrypt falhou e sem fallback')
          return null
        }
      } else if (base64 && base64.length > 100) {
        audioBuffer = Buffer.from(base64, 'base64')
      } else if (url) {
        source = 'url'
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`)
        audioBuffer = Buffer.from(await res.arrayBuffer())
      } else {
        this.logger.warn(`Transcribe skipped: sem base64 válido nem URL (base64.length=${base64?.length ?? 0})`)
        return null
      }

      if (audioBuffer.length < 200) {
        this.logger.warn(`Transcribe skipped: buffer muito pequeno (${audioBuffer.length} bytes, source=${source})`)
        return null
      }

      // Normaliza mime — remove parâmetros extras tipo ";codecs=opus"
      const cleanMime = mime.split(';')[0].trim().toLowerCase()

      // Escolhe extensão baseada no mime limpo (Whisper aceita: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm)
      // WhatsApp voice note é audio/ogg;codecs=opus → usa .oga (mais fiel que .ogg pro Whisper)
      const ext = cleanMime.includes('ogg') ? 'oga'
        : cleanMime.includes('mp4') || cleanMime.includes('m4a') ? 'm4a'
        : cleanMime.includes('mpeg') || cleanMime.includes('mp3') ? 'mp3'
        : cleanMime.includes('webm') ? 'webm'
        : cleanMime.includes('wav') ? 'wav'
        : 'oga'

      const magic = audioBuffer.slice(0, 8)
      const magicHex = magic.toString('hex')
      const magicAscii = magic.toString('ascii').replace(/[^\x20-\x7E]/g, '.')
      this.logger.log(`Transcribe: ${audioBuffer.length} bytes, mime=${mime}, source=${source}, ext=${ext}, magic=${magicHex} "${magicAscii}"`)

      // Build multipart form data
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: cleanMime })
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
  async analyzeImage(
    base64?: string,
    url?: string,
    mime = 'image/jpeg',
    caption?: string,
    decryptHint?: EvolutionDecryptHint,
  ): Promise<string | null> {
    const apiKey = await this.getOpenAiKey()
    if (!apiKey) {
      this.logger.warn('OpenAI API key not found — cannot analyze image')
      return null
    }

    try {
      let imageContent: { type: 'image_url'; image_url: { url: string } }

      // 1ª tentativa: decriptar via Evolution (imagem E2E do WhatsApp)
      if (decryptHint) {
        const decrypted = await this.decryptFromEvolution(decryptHint)
        if (decrypted) {
          const imgMime = decrypted.mimetype?.split(';')[0].trim() || mime
          imageContent = { type: 'image_url', image_url: { url: `data:${imgMime};base64,${decrypted.base64}` } }
          this.logger.log(`Image decrypted via Evolution: ${decrypted.base64.length} base64 chars`)
        } else if (base64) {
          imageContent = { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
        } else if (url) {
          imageContent = { type: 'image_url', image_url: { url } }
        } else {
          return null
        }
      } else if (base64) {
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
