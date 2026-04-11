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
  name:          string
  type:          ChannelType
  phoneNumber?:  string
  status:        ChannelStatus
  config:        ChannelConfig
  lastCheckedAt?: Date
  blockedAt?:    Date
  createdAt:     Date
  updatedAt:     Date
}
