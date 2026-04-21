import type { Automation, AutomationLog, AutomationStatus, FollowupStep } from '@/core/entities/Automation'

export const AUTOMATION_REPOSITORY = Symbol('AUTOMATION_REPOSITORY')

export interface CreateAutomationDto {
  name:                    string
  followupSteps?:          FollowupStep[]
  channelId?:              string
  primaryChannelId?:       string
  fallbackChannelIds?:     string[]
  testPhones?:             string[]
  messageTemplates?:       string[]
  linkedAgentId?:          string
  filterStatus?:           string
  minHoursAfterCapture?:   number
  startHour?:              number
  endHour?:                number
  batchIntervalMinMinutes?: number
  batchIntervalMaxMinutes?: number
  batchSizeMin?:           number
  batchSizeMax?:           number
  aiChannelId?:            string
  aiModel?:                string
  debounceMs?:             number
  sendDelayMs?:            number
  fragmentDelayMs?:        number
  followupEnabled?:        boolean
  useExclusionList?:       boolean
  exclusionFilterStatus?:  string | null
  humanHandoffEnabled?:    boolean
  humanHandoffPhone?:      string | null
  humanHandoffMessage?:    string | null
  dispatchDelayMinMs?:     number | null
  dispatchDelayMaxMs?:     number | null
}

export interface UpdateAutomationDto {
  name?:                   string
  followupSteps?:          FollowupStep[]
  status?:                 AutomationStatus
  channelId?:              string | null
  primaryChannelId?:       string | null
  fallbackChannelIds?:     string[]
  testPhones?:             string[]
  messageTemplates?:       string[]
  linkedAgentId?:          string | null
  filterStatus?:           string
  minHoursAfterCapture?:   number
  startHour?:              number
  endHour?:                number
  batchIntervalMinMinutes?: number
  batchIntervalMaxMinutes?: number
  batchSizeMin?:           number
  batchSizeMax?:           number
  aiChannelId?:            string | null
  aiModel?:                string | null
  debounceMs?:             number | null
  sendDelayMs?:            number | null
  fragmentDelayMs?:        number | null
  followupEnabled?:        boolean
  useExclusionList?:       boolean
  exclusionFilterStatus?:  string | null
  humanHandoffEnabled?:    boolean
  humanHandoffPhone?:      string | null
  humanHandoffMessage?:    string | null
  dispatchDelayMinMs?:     number | null
  dispatchDelayMaxMs?:     number | null
  lastBatchAt?:            Date
  totalSent?:              number
  totalReplied?:           number
  totalConverted?:         number
}

export interface CreateAutomationLogDto {
  sent:     number
  skipped:  number
  errors:   number
  reason?:  string
  notes?:   string
}

export interface IAutomationRepository {
  findAll(tenantId?: string): Promise<Automation[]>
  findById(id: string, tenantId?: string): Promise<Automation | null>
  findByChannelId(channelId: string, tenantId?: string): Promise<Automation | null>
  create(dto: CreateAutomationDto, tenantId: string): Promise<Automation>
  update(id: string, dto: UpdateAutomationDto): Promise<Automation>
  remove(id: string): Promise<void>
  addLog(automationId: string, dto: CreateAutomationLogDto): Promise<AutomationLog>
}
