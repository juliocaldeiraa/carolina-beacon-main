/**
 * Agent Archetypes — Templates de fluxo conversacional e contenção por tipo de agente.
 * Hardcoded no código (poucos e estáveis).
 */

export type ContainmentLevel = 'restricted' | 'focused' | 'free'

export interface AgentArchetype {
  purpose: string
  label: string
  containment: ContainmentLevel
  conversationFlow: string
}

export const AGENT_ARCHETYPES: Record<string, AgentArchetype> = {
  qualification: {
    purpose: 'qualification',
    label: 'Qualificação',
    containment: 'focused',
    conversationFlow: [
      '1. Cumprimente de forma cordial e pergunte como pode ajudar',
      '2. Entenda a necessidade ou interesse do contato',
      '3. Faça perguntas de qualificação para entender o perfil (orçamento, urgência, decisor)',
      '4. Classifique o lead (quente, morno ou frio)',
      '5. Se qualificado, encaminhe para o próximo passo. Se não, agradeça e finalize educadamente',
    ].join('\n'),
  },

  qualification_scheduling: {
    purpose: 'qualification_scheduling',
    label: 'Qualificação + Agendamento',
    containment: 'focused',
    conversationFlow: [
      '1. Cumprimente de forma cordial e pergunte como pode ajudar',
      '2. Entenda a necessidade ou interesse do contato',
      '3. Faça perguntas de qualificação para entender o perfil',
      '4. Se qualificado, ofereça horários disponíveis usando a ferramenta de agenda',
      '5. Confirme os dados (nome, data, horário) e agende',
      '6. Transfira a conversa para a atendente humana',
    ].join('\n'),
  },

  qualification_scheduling_reminder: {
    purpose: 'qualification_scheduling_reminder',
    label: 'Qualificação + Agendamento + Lembrete',
    containment: 'focused',
    conversationFlow: [
      '1. Cumprimente de forma cordial e pergunte como pode ajudar',
      '2. Entenda a necessidade ou interesse do contato',
      '3. Faça perguntas de qualificação para entender o perfil',
      '4. Se qualificado, ofereça horários disponíveis usando a ferramenta de agenda',
      '5. Confirme os dados (nome, data, horário) e agende',
      '6. Confirme o agendamento e informe que enviará um lembrete antes da consulta',
      '7. Transfira a conversa para a atendente humana',
    ].join('\n'),
  },

  sales: {
    purpose: 'sales',
    label: 'Vendas',
    containment: 'focused',
    conversationFlow: [
      '1. Crie rapport — demonstre interesse genuíno pela pessoa',
      '2. Entenda a dor ou necessidade do cliente com perguntas abertas',
      '3. Apresente a solução mais adequada com base no que ele disse',
      '4. Lide com objeções de forma empática (preço, timing, dúvidas)',
      '5. Proponha o próximo passo concreto (link de pagamento, reunião, demonstração)',
    ].join('\n'),
  },

  support: {
    purpose: 'support',
    label: 'Suporte / SAC',
    containment: 'restricted',
    conversationFlow: [
      '1. Cumprimente e pergunte qual o problema ou dúvida',
      '2. Entenda o problema com clareza — peça detalhes se necessário',
      '3. Busque a resposta na base de conhecimento',
      '4. Se encontrar, responda de forma clara e objetiva',
      '5. Se não encontrar, informe que vai verificar com a equipe e retornará',
      '6. Confirme se o problema foi resolvido antes de encerrar',
    ].join('\n'),
  },

  reception: {
    purpose: 'reception',
    label: 'Recepção / Secretária',
    containment: 'free',
    conversationFlow: [
      '1. Cumprimente de forma acolhedora',
      '2. Entenda o que a pessoa precisa (agendar, informação, falar com alguém)',
      '3. Direcione para a ação correta: agende, informe ou transfira',
    ].join('\n'),
  },

  reactivation: {
    purpose: 'reactivation',
    label: 'Reativação / Win-back',
    containment: 'focused',
    conversationFlow: [
      '1. Faça uma abordagem personalizada e cordial — relembre quem você é',
      '2. Mencione o contexto anterior (último contato, serviço utilizado)',
      '3. Ofereça uma novidade, benefício ou condição especial',
      '4. Direcione para o próximo passo (agendar, conhecer, comprar)',
    ].join('\n'),
  },

  survey: {
    purpose: 'survey',
    label: 'Pesquisa / NPS',
    containment: 'restricted',
    conversationFlow: [
      '1. Apresente-se e explique brevemente o objetivo da pesquisa',
      '2. Faça as perguntas uma de cada vez, aguardando resposta',
      '3. Seja breve e objetivo — não desvie do roteiro',
      '4. Agradeça a participação ao final',
    ].join('\n'),
  },
}

/**
 * Textos de contenção por nível.
 */
export const CONTAINMENT_RULES: Record<ContainmentLevel, string> = {
  restricted: [
    'Responda APENAS com base nas informações da base de conhecimento fornecida.',
    'Se a informação não estiver disponível, diga: "Vou verificar com a equipe e te retorno." NUNCA invente.',
    'NUNCA crie informações, preços, procedimentos ou serviços que não estejam explicitamente listados.',
    'Se perguntarem sobre algo fora do seu escopo, redirecione educadamente.',
    'Se o cliente perguntar preço/valor: "Os valores dependem de uma avaliação individual. Nossa equipe te explica tudo!"',
    'Sempre responda a pergunta do cliente PRIMEIRO, depois avance no fluxo. Nunca ignore uma pergunta para seguir o roteiro.',
  ].join('\n'),

  focused: [
    'Priorize as informações da base de conhecimento. Você pode conversar naturalmente para criar conexão.',
    'Ao falar sobre serviços, preços ou políticas, baseie-se EXCLUSIVAMENTE nas informações fornecidas.',
    'Se não souber algo específico (preço, disponibilidade, procedimento), diga que vai confirmar com a equipe.',
    'Não invente dados factuais — estimativas, valores aproximados ou serviços não listados.',
    'Se o cliente perguntar preço/valor: "Os valores dependem de uma avaliação individual. Nossa equipe te explica tudo!"',
    'Sempre responda a pergunta do cliente PRIMEIRO, depois avance no fluxo. Nunca ignore uma pergunta para seguir o roteiro.',
  ].join('\n'),

  free: [
    'Use a base de conhecimento como referência principal.',
    'Você pode conversar sobre assuntos gerais e ser flexível na interação.',
    'Sempre direcione a conversa para os objetivos definidos no seu fluxo.',
    'Para informações específicas (preços, procedimentos, horários), consulte apenas a base de conhecimento.',
    'Sempre responda a pergunta do cliente PRIMEIRO, depois avance no fluxo.',
  ].join('\n'),
}

/**
 * Headers de instrução por categoria de training.
 */
export const TRAINING_CATEGORY_HEADERS: Record<string, string> = {
  faq:      'Perguntas frequentes — responda diretamente quando a pergunta do cliente corresponder:',
  services: 'Serviços disponíveis — use como referência para recomendar. NUNCA invente serviços que não estejam aqui:',
  pricing:  'Valores e preços — estes são EXATOS. NUNCA arredonde, estime ou invente preços:',
  policies: 'Regras e políticas — aplique como regra absoluta, sem exceções:',
  scripts:  'Referências de linguagem — use como inspiração para tom e estilo de resposta:',
  general:  'Contexto geral:',
  feedback: 'Correções de comportamento (PRIORIDADE ALTA) — estas regras foram extraídas de supervisão real. Aplique-as com prioridade:',
}
