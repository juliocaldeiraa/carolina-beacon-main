export type BroadcastStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface Broadcast {
  id:        string
  tenantId:  string
  agentId:   string | null
  channelId: string | null
  name:      string
  template:  string
  audience:  string[]   // lista de contatos: "nome|telefone"
  status:    BroadcastStatus
  sentAt:    Date | null
  // Timing anti-ban
  messageDelayMinSeconds:  number
  messageDelayMaxSeconds:  number
  batchSizeMin:            number
  batchSizeMax:            number
  batchIntervalMinMinutes: number
  batchIntervalMaxMinutes: number
  createdAt: Date
  updatedAt: Date
}
