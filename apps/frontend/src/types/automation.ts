export type AutomationStatus = 'ACTIVE' | 'INACTIVE'

export interface FollowupStep {
  afterHours: number    // horas de espera sem conversão antes de enviar esta etapa
  templates:  string[]  // pool de mensagens (aleatório por lead)
}

export interface DispatchLog {
  id:           string
  automationId: string
  phone:        string
  name:         string | null
  message:      string | null
  status:       'sent' | 'error' | 'skipped'
  errorMsg:     string | null
  channelId:    string | null
  channelName:  string | null
  step:         number
  executedAt:   string
}

export interface AutomationLog {
  id:           string
  automationId: string
  executedAt:   string
  sent:         number
  skipped:      number
  errors:       number
  reason:       string | null
  notes:        string | null
}

export interface Automation {
  id:                       string
  tenantId:                 string
  name:                     string
  status:                   AutomationStatus
  sourceTable:              string
  filterStatus:             string
  minHoursAfterCapture:     number
  channelId:                string | null
  // números de teste persistidos
  testPhones:               string[]
  // follow-up sequencial configurável
  followupSteps:            FollowupStep[]
  followupEnabled:          boolean
  // novo: até 4 templates; legado: messageTemplate
  messageTemplates:         string[]
  messageTemplate:          string | null
  // novo: vincula agente; legado: aiPrompt
  linkedAgentId:            string | null
  aiPrompt:                 string | null
  startHour:                number
  endHour:                  number
  // novo: range de intervalo (minutos); legado: batchIntervalHours
  batchIntervalMinMinutes:  number | null
  batchIntervalMaxMinutes:  number | null
  batchIntervalHours:       number
  // novo: range de tamanho; legado: batchSize
  batchSizeMin:             number | null
  batchSizeMax:             number | null
  batchSize:                number
  // IA conversacional — canal e modelo próprios
  aiChannelId:              string | null
  aiModel:                  string | null
  // Timing de resposta da IA (null = usa padrão do ChannelAgent)
  debounceMs:               number | null
  sendDelayMs:              number | null
  fragmentDelayMs:          number | null
  // Multi-canal fallback (anti-queda)
  primaryChannelId:         string | null
  fallbackChannelIds:       string[]
  // Lista de exclusão — audiência negativa
  useExclusionList:         boolean
  exclusionFilterStatus:    string | null
  // Handoff para humano com dupla confirmação
  humanHandoffEnabled:      boolean
  humanHandoffPhone:        string | null
  humanHandoffMessage:      string | null
  // Delay anti-ban entre mensagens do lote (ms)
  dispatchDelayMinMs:       number | null
  dispatchDelayMaxMs:       number | null
  lastBatchAt:              string | null
  totalSent:                number
  totalReplied:             number
  totalConverted:           number
  createdAt:                string
  updatedAt:                string
  logs?:                    AutomationLog[]
  stats?: {
    totalSent:      number
    totalReplied:   number
    totalConverted: number
    leadsNaFila:    number
    leadsExcluidos: number
    conversionRate: number
  }
}

export interface TestLead {
  phone: string
  name:  string
}

export interface TestFireResult {
  phone:         string
  message:       string
  ok:            boolean
  error?:        string
  variantIndex?: number
  firedAt?:      string
}

export interface ConversationTurn {
  role:      'user' | 'assistant'
  content:   string
  timestamp: string
}

export interface TestIngestionLog {
  id:        string
  status:    string
  model:     string | null
  latencyMs: number | null
  errorMsg:  string | null
  createdAt: string
}

export interface PhoneTestStatus {
  phone:          string
  leadFound:      boolean
  leadStatus:     string | null
  mensagemEnviada: string | null
  conversation:   ConversationTurn[]
  ingestionLogs:  TestIngestionLog[]
}

export interface TestStatusResponse {
  phones: PhoneTestStatus[]
}

export interface CreateAutomationPayload {
  name:                      string
  followupSteps?:            FollowupStep[]
  followupEnabled?:          boolean
  channelId?:                string
  primaryChannelId?:         string
  fallbackChannelIds?:       string[]
  testPhones?:               string[]
  messageTemplates?:         string[]
  linkedAgentId?:            string
  filterStatus?:             string
  minHoursAfterCapture?:     number
  startHour?:                number
  endHour?:                  number
  batchIntervalMinMinutes?:  number
  batchIntervalMaxMinutes?:  number
  batchSizeMin?:             number
  batchSizeMax?:             number
  aiChannelId?:              string
  aiModel?:                  string
  debounceMs?:               number | null
  sendDelayMs?:              number | null
  fragmentDelayMs?:          number | null
  useExclusionList?:         boolean
  exclusionFilterStatus?:    string | null
  humanHandoffEnabled?:      boolean
  humanHandoffPhone?:        string | null
  humanHandoffMessage?:      string | null
  dispatchDelayMinMs?:       number | null
  dispatchDelayMaxMs?:       number | null
}

export interface UpdateAutomationPayload extends Partial<CreateAutomationPayload> {
  status?: AutomationStatus
}
