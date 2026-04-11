export type AutomationStatus = 'ACTIVE' | 'INACTIVE'

export interface FollowupStep {
  afterHours: number    // horas de espera sem conversão antes de enviar esta etapa
  templates:  string[]  // pool de mensagens (aleatório por lead)
}

export interface AutomationLog {
  id:           string
  automationId: string
  executedAt:   Date
  sent:         number
  skipped:      number
  errors:       number
  reason:       string | null
  notes:        string | null
}

export interface Automation {
  id:                   string
  tenantId:             string
  name:                 string
  status:               AutomationStatus
  sourceTable:          string
  filterStatus:         string
  minHoursAfterCapture: number
  channelId:            string | null
  // Números de teste persistidos
  testPhones:           string[]
  // Novo: múltiplos templates (1–4)
  messageTemplates:     string[]
  messageTemplate:      string | null  // legado
  // Follow-up sequencial — etapas pós-contato inicial (só se não converteu)
  followupSteps:        FollowupStep[]
  // Novo: agente vinculado para IA
  linkedAgentId:        string | null
  aiPrompt:             string | null  // legado
  startHour:            number
  endHour:              number
  // Novo: ranges em minutos
  batchIntervalMinMinutes: number | null
  batchIntervalMaxMinutes: number | null
  batchIntervalHours:   number         // legado
  batchSizeMin:         number | null
  batchSizeMax:         number | null
  batchSize:            number         // legado
  // IA conversacional — canal e modelo próprios
  aiChannelId:          string | null
  aiModel:              string | null
  // Timing de resposta — sobrescreve ChannelAgent quando definido (null = usa ChannelAgent ou default)
  debounceMs:           number | null
  sendDelayMs:          number | null
  fragmentDelayMs:      number | null
  // Multi-canal fallback (anti-queda)
  primaryChannelId:     string | null
  fallbackChannelIds:   string[]
  // Follow-up habilitado — desativa todas as etapas de follow-up sem apagar configuração
  followupEnabled:      boolean
  // Lista de exclusão — audiência negativa
  useExclusionList:     boolean
  exclusionFilterStatus: string | null
  // Handoff para humano com dupla confirmação
  humanHandoffEnabled:  boolean
  humanHandoffPhone:    string | null
  humanHandoffMessage:  string | null
  // Delay anti-ban entre mensagens do lote (ms) — null = usa padrão 80–160s
  dispatchDelayMinMs:   number | null
  dispatchDelayMaxMs:   number | null
  lastBatchAt:          Date | null
  totalSent:            number
  totalReplied:         number
  totalConverted:       number
  createdAt:            Date
  updatedAt:            Date
  logs?:                AutomationLog[]
}
