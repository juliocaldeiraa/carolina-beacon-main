export type BroadcastStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface Broadcast {
  id:        string
  tenantId:  string
  agentId:   string | null
  channelId: string | null
  name:      string
  template:  string
  audience:  string[]
  status:    BroadcastStatus
  sentAt:    string | null
  // Timing anti-ban
  messageDelayMinSeconds:  number
  messageDelayMaxSeconds:  number
  batchSizeMin:            number
  batchSizeMax:            number
  batchIntervalMinMinutes: number
  batchIntervalMaxMinutes: number
  createdAt: string
  updatedAt: string
}

export interface CreateBroadcastPayload {
  channelId?: string
  name:       string
  template:   string
  audience:   string[]
  // Timing anti-ban
  messageDelayMinSeconds?:  number
  messageDelayMaxSeconds?:  number
  batchSizeMin?:            number
  batchSizeMax?:            number
  batchIntervalMinMinutes?: number
  batchIntervalMaxMinutes?: number
}
