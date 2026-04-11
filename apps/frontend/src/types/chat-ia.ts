export interface ChannelAgent {
  id:              string
  tenantId:        string
  name:            string
  channelId:       string
  agentId:         string
  llmModel:        string
  isActive:        boolean
  debounceMs:               number
  fragmentDelayMs:          number
  humanTakeoverTimeoutMin:  number
  sendDelayMs:              number
  allowGroups:              boolean
  triggerMode:              string
  triggerKeywords:          string[]
  createdAt:                string
  updatedAt:                string
}

export interface CreateChannelAgentPayload {
  name:                      string
  channelId:                 string
  agentId:                   string
  llmModel:                  string
  isActive?:                 boolean
  debounceMs?:               number
  fragmentDelayMs?:          number
  humanTakeoverTimeoutMin?:  number
  sendDelayMs?:              number
  allowGroups?:              boolean
  triggerMode?:              string
  triggerKeywords?:          string[]
}

export interface UpdateChannelAgentPayload {
  name?:                     string
  channelId?:                string
  agentId?:                  string
  llmModel?:                 string
  isActive?:                 boolean
  debounceMs?:               number
  fragmentDelayMs?:          number
  humanTakeoverTimeoutMin?:  number
  sendDelayMs?:              number
  allowGroups?:              boolean
  triggerMode?:              string
  triggerKeywords?:          string[]
}
