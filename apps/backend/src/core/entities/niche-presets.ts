/**
 * Niche Presets — configuração padrão por vertical.
 * Define CRM stages e arquétipos de agente recomendados por nicho.
 * Nicho é fixo na criação do workspace (não muda depois).
 */

export type NicheKey = 'healthcare' | 'launch' | 'services' | 'generic'

export interface CrmStage {
  key: string
  label: string
  color: string
  order: number
  isLost?: boolean
}

export interface NichePreset {
  label: string
  description: string
  crmStages: CrmStage[]
  recommendedArchetypes: string[]
}

export const NICHE_PRESETS: Record<NicheKey, NichePreset> = {
  healthcare: {
    label: 'Saúde / Clínicas',
    description: 'Clínicas, consultórios, profissionais de saúde',
    crmStages: [
      { key: 'contact_made',    label: 'Contato Feito',  color: 'blue',    order: 0 },
      { key: 'in_conversation', label: 'Em Conversa',    color: 'teal',    order: 1 },
      { key: 'scheduled',       label: 'Agendado',       color: 'amber',   order: 2 },
      { key: 'confirmed',       label: 'Confirmado',     color: 'green',   order: 3 },
      { key: 'attended',        label: 'Compareceu',     color: 'emerald', order: 4 },
      { key: 'lost',            label: 'Perdido',        color: 'red',     order: 99, isLost: true },
    ],
    recommendedArchetypes: ['qualification_scheduling_reminder', 'reception', 'support'],
  },

  launch: {
    label: 'Lançamento / Infoproduto',
    description: 'Lançamentos, cursos, infoprodutos, eventos',
    crmStages: [
      { key: 'interest',   label: 'Interesse',    color: 'blue',  order: 0 },
      { key: 'warming',    label: 'Aquecimento',  color: 'teal',  order: 1 },
      { key: 'checkin',    label: 'Check-in',     color: 'amber', order: 2 },
      { key: 'purchased',  label: 'Comprou',      color: 'green', order: 3 },
      { key: 'lost',       label: 'Perdido',      color: 'red',   order: 99, isLost: true },
    ],
    recommendedArchetypes: ['sales', 'reactivation', 'support'],
  },

  services: {
    label: 'Serviços / Consultoria',
    description: 'Consultoria, agências, freelancers, prestadores de serviço',
    crmStages: [
      { key: 'lead',        label: 'Lead',              color: 'blue',   order: 0 },
      { key: 'qualified',   label: 'Qualificado',       color: 'teal',   order: 1 },
      { key: 'proposal',    label: 'Proposta Enviada',  color: 'amber',  order: 2 },
      { key: 'negotiation', label: 'Negociação',        color: 'orange', order: 3 },
      { key: 'closed',      label: 'Fechado',           color: 'green',  order: 4 },
      { key: 'lost',        label: 'Perdido',           color: 'red',    order: 99, isLost: true },
    ],
    recommendedArchetypes: ['qualification', 'sales', 'support'],
  },

  generic: {
    label: 'Genérico',
    description: 'Use se nenhum outro se encaixa',
    crmStages: [
      { key: 'new',          label: 'Novo Lead',   color: 'blue',  order: 0 },
      { key: 'contact',      label: 'Em Contato',  color: 'teal',  order: 1 },
      { key: 'negotiation',  label: 'Negociação',  color: 'amber', order: 2 },
      { key: 'won',          label: 'Fechado',     color: 'green', order: 3 },
      { key: 'lost',         label: 'Perdido',     color: 'red',   order: 99, isLost: true },
    ],
    recommendedArchetypes: ['qualification', 'sales', 'support'],
  },
}

export function resolvePreset(niche: string | null | undefined): NichePreset {
  const key = (niche as NicheKey) ?? 'generic'
  return NICHE_PRESETS[key] ?? NICHE_PRESETS.generic
}

export function resolveStagesFor(niche: string | null | undefined, override?: unknown): CrmStage[] {
  if (Array.isArray(override) && override.length > 0) {
    return override as CrmStage[]
  }
  return resolvePreset(niche).crmStages
}
