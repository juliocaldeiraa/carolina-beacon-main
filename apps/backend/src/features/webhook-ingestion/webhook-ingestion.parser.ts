/**
 * WebhookIngestionParser — Normaliza payloads de diferentes provedores
 *
 * Retorna { phone, name, text, type } ou null se a mensagem deve ser ignorada.
 * Mensagens `fromMe: true` são sempre ignoradas (evitar loop de resposta).
 * Stickers são ignorados (sem conteúdo textual relevante).
 *
 * type: 'text' | 'audio' | 'image' | 'document'
 * Para mídia não-texto: retorna placeholder como texto para o agente reagir.
 */

import type { ChannelType } from '@/core/entities/Channel'

export type MessageType = 'text' | 'audio' | 'image' | 'document'

export interface ParsedMessage {
  phone:     string
  name:      string
  text:      string
  type:      MessageType
  isGroup:   boolean
  messageId: string | null  // idempotency key (só Evolution API fornece)
}

export function parseWebhookPayload(
  type: ChannelType,
  payload: unknown,
): ParsedMessage | null {
  try {
    switch (type) {
      case 'EVOLUTION_API': return parseEvolutionApi(payload)
      case 'ZAPI':          return parseZApi(payload)
      case 'TELEGRAM':      return parseTelegram(payload)
      default:              return null
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Evolution API
// Payload: { data: { key: { remoteJid, fromMe }, pushName, message: { ... } } }
// ---------------------------------------------------------------------------
function parseEvolutionApi(raw: unknown): ParsedMessage | null {
  const p = raw as Record<string, unknown>
  const data = p['data'] as Record<string, unknown> | undefined
  if (!data) return null

  const key = data['key'] as Record<string, unknown> | undefined
  if (!key) return null

  if (key['fromMe'] === true) return null

  const remoteJid = key['remoteJid'] as string | undefined
  if (!remoteJid) return null

  const isGroup = remoteJid.endsWith('@g.us')
  const phone = remoteJid.replace(/@.*/, '').replace(/\D/g, '')
  if (!phone) return null

  const messageId = (key['id'] as string | undefined) ?? null

  const name = (data['pushName'] as string | undefined) ?? phone

  const message = data['message'] as Record<string, unknown> | undefined
  if (!message) return null

  // Sticker — ignorar
  if (message['stickerMessage']) return null

  // Audio / PTT
  if (message['audioMessage'] || message['pttMessage']) {
    return { phone, name, text: '[Áudio recebido — responda apenas com texto]', type: 'audio', isGroup, messageId }
  }

  // Image
  if (message['imageMessage']) {
    const caption = (message['imageMessage'] as Record<string, unknown>)['caption'] as string | undefined
    return { phone, name, text: caption ? `[Imagem recebida] ${caption}` : '[Imagem recebida]', type: 'image', isGroup, messageId }
  }

  // Document
  if (message['documentMessage'] || message['documentWithCaptionMessage']) {
    return { phone, name, text: '[Documento recebido]', type: 'document', isGroup, messageId }
  }

  // Text (conversation or extendedTextMessage)
  const text = (
    (message['conversation'] as string | undefined) ??
    (message['extendedTextMessage'] as Record<string, unknown> | undefined)?.['text'] as string | undefined
  )
  if (!text?.trim()) return null

  return { phone, name, text: text.trim(), type: 'text', isGroup, messageId }
}

// ---------------------------------------------------------------------------
// Z-API
// Payload: { phone, senderName, text: { message }, fromMe, type }
// ---------------------------------------------------------------------------
function parseZApi(raw: unknown): ParsedMessage | null {
  const p = raw as Record<string, unknown>
  if (p['fromMe'] === true) return null

  const phone = (p['phone'] as string | undefined)?.replace(/\D/g, '')
  if (!phone) return null

  const name    = (p['senderName'] as string | undefined) ?? phone
  const msgType = (p['type'] as string | undefined)?.toLowerCase()

  // Audio / PTT
  if (msgType === 'audio' || msgType === 'ptt') {
    return { phone, name, text: '[Áudio recebido — responda apenas com texto]', type: 'audio', isGroup: false, messageId: null }
  }

  // Image
  if (msgType === 'image') {
    const caption = (p['image'] as Record<string, unknown> | undefined)?.['caption'] as string | undefined
    return { phone, name, text: caption ? `[Imagem recebida] ${caption}` : '[Imagem recebida]', type: 'image', isGroup: false, messageId: null }
  }

  // Document
  if (msgType === 'document') {
    return { phone, name, text: '[Documento recebido]', type: 'document', isGroup: false, messageId: null }
  }

  // Sticker
  if (msgType === 'sticker') return null

  const textObj = p['text'] as Record<string, unknown> | undefined
  const text    = textObj?.['message'] as string | undefined
  if (!text?.trim()) return null

  return { phone, name, text: text.trim(), type: 'text', isGroup: false, messageId: null }
}

// ---------------------------------------------------------------------------
// Telegram
// Payload: { message: { chat: { id }, from: { first_name }, text, audio, photo, document } }
// Para Telegram, "phone" é o chat_id (usado como identificador único)
// ---------------------------------------------------------------------------
function parseTelegram(raw: unknown): ParsedMessage | null {
  const p = raw as Record<string, unknown>
  const message = p['message'] as Record<string, unknown> | undefined
  if (!message) return null

  const chat = message['chat'] as Record<string, unknown> | undefined
  const chatId = chat?.['id']
  if (chatId === undefined || chatId === null) return null

  const phone = String(chatId)
  const from  = message['from'] as Record<string, unknown> | undefined
  const name  = (from?.['first_name'] as string | undefined) ?? phone

  // Audio
  if (message['audio'] || message['voice']) {
    return { phone, name, text: '[Áudio recebido — responda apenas com texto]', type: 'audio', isGroup: false, messageId: null }
  }

  // Photo
  if (message['photo']) {
    const caption = message['caption'] as string | undefined
    return { phone, name, text: caption ? `[Imagem recebida] ${caption}` : '[Imagem recebida]', type: 'image', isGroup: false, messageId: null }
  }

  // Document
  if (message['document']) {
    return { phone, name, text: '[Documento recebido]', type: 'document', isGroup: false, messageId: null }
  }

  // Sticker
  if (message['sticker']) return null

  const text = message['text'] as string | undefined
  if (!text?.trim()) return null

  return { phone, name, text: text.trim(), type: 'text', isGroup: false, messageId: null }
}
