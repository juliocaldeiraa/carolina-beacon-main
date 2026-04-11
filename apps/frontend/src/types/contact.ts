export interface Contact {
  id:            string
  tenantId?:     string
  name?:         string
  phone:         string
  email?:        string
  notes?:        string
  tags:          string[]
  channelId?:    string
  convCount:     number
  lastContactAt?: string
  createdAt:     string
  updatedAt:     string
}

export interface UpdateContactPayload {
  name?:  string
  email?: string
  notes?: string
  tags?:  string[]
}

export interface ContactDetail extends Contact {
  conversations: ContactConversation[]
}

export interface ContactConversation {
  id:            string
  status:        string
  startedAt:     string
  lastMessageAt?: string
  turns:         number
  channelId?:    string
  agent?:        { id: string; name: string }
  messages:      { content: string; role: string }[]
}
