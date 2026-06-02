export type ChannelType = 'EVOLUTION_API' | 'ZAPI' | 'WHATSAPP_OFFICIAL' | 'TELEGRAM' | 'INSTAGRAM'
export type ChannelStatus = 'CONNECTED' | 'DISCONNECTED' | 'BLOCKED' | 'UNKNOWN'

export interface ChannelConfig {
  instanceUrl?:  string
  instanceName?: string
  apiKey?:       string
  instanceId?:   string
  token?:        string
  phoneNumberId?: string
  accessToken?:  string
  pageId?:       string
  botToken?:     string
}

export interface Channel {
  id:            string
  name:          string
  type:          ChannelType
  phoneNumber?:  string
  status:        ChannelStatus
  config:        ChannelConfig
  lastCheckedAt?: string
  blockedAt?:    string
  // Anti-ban: aquecimento (warmup) e teto diário por número
  warmupEnabled?:   boolean
  warmupStartedAt?: string
  isWarmedUp?:      boolean
  dailyMessageCap?: number
  createdAt:     string
  updatedAt:     string
}

export interface CreateChannelPayload {
  name:        string
  type:        ChannelType
  phoneNumber?: string
  config:      ChannelConfig
}

export interface UpdateChannelPayload {
  name?:        string
  phoneNumber?: string
  config?:      ChannelConfig
  // Anti-ban
  warmupEnabled?:   boolean
  isWarmedUp?:      boolean
  dailyMessageCap?: number
}

export interface ChannelConflictChatIa {
  id:        string
  name:      string
  agentName: string
}

export interface ChannelConflictItem {
  channelId:   string
  channelName: string
  chatIa:      ChannelConflictChatIa[]
  automations: { id: string; name: string }[]
}
