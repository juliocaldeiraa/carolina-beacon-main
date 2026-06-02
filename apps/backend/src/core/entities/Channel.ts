export type ChannelType = 'EVOLUTION_API' | 'ZAPI' | 'WHATSAPP_OFFICIAL' | 'TELEGRAM' | 'INSTAGRAM'
export type ChannelStatus = 'CONNECTED' | 'DISCONNECTED' | 'BLOCKED' | 'UNKNOWN'

export interface ChannelConfig {
  // Evolution API
  instanceUrl?: string
  instanceName?: string
  apiKey?: string
  // Z-API
  instanceId?: string
  token?: string
  // WhatsApp Official / Instagram
  phoneNumberId?: string
  accessToken?: string
  pageId?: string
  // Telegram
  botToken?: string
}

export interface Channel {
  id:            string
  tenantId:      string
  name:          string
  type:          ChannelType
  phoneNumber?:  string
  status:        ChannelStatus
  config:        ChannelConfig
  lastCheckedAt?: Date
  blockedAt?:    Date
  // Anti-ban: aquecimento (warmup) e teto diário por número.
  // Opcionais na entidade: só o repositório (loader canônico) e o Prisma os
  // preenchem; outros construtores de Channel (automations, reminders, webhooks)
  // não carregam dados de warmup. A lógica de teto (channelDailyCap) lê do tipo
  // do Prisma, onde os campos são obrigatórios por @default.
  warmupEnabled?:   boolean
  warmupStartedAt?: Date
  isWarmedUp?:      boolean
  dailyMessageCap?: number
  createdAt:     Date
  updatedAt:     Date
}
