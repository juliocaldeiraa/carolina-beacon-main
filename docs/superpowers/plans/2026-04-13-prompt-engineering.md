# Prompt Engineering System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automatic prompt engineering system that assembles rich, structured system prompts from agent fields, processes trainings with AI, and enables a human feedback loop for continuous improvement.

**Architecture:** New `buildEnrichedSystemPrompt` function replaces `buildSystemPrompt` — assembles 6 blocks (identity, personality, flow, objective, guardrails, dynamic context). 8 agent archetypes hardcoded as templates. Training pipeline processes raw content through AI before storage. Feedback loop lets operator annotate real conversations to generate high-priority training rules.

**Tech Stack:** NestJS, Prisma, Anthropic/OpenAI SDK (for processing), pdf-parse, mammoth, cheerio (for document/URL extraction)

**Spec:** `docs/superpowers/specs/2026-04-13-prompt-engineering-design.md`

---

## Chunk 1: Core Prompt Engine + Archetypes

### Task 1: Add `conversationFlow` and `category` fields to Prisma schema

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma/schema.prisma:79-124` (Agent model)
- Modify: `apps/backend/src/infrastructure/database/prisma/schema.prisma:129-142` (AgentTraining model)

- [ ] **Step 1: Add new fields to Agent model**

In `schema.prisma`, inside the Agent model (after line 111, after `companyUrl`), add:

```prisma
  conversationFlow   String?  @db.Text  @map("conversation_flow")  // fluxo conversacional customizado (override do archetype)
```

- [ ] **Step 2: Add category field to AgentTraining model**

In `schema.prisma`, inside the AgentTraining model (after `content` field), add:

```prisma
  category  String   @default("general")  // faq | services | pricing | policies | scripts | general | feedback
```

- [ ] **Step 3: Add ConversationFeedback model**

After the Message model in `schema.prisma`, add:

```prisma
// =============================================
// CONVERSATION FEEDBACK — Supervisão humana
// =============================================
model ConversationFeedback {
  id               String       @id @default(uuid())
  conversationId   String       @map("conversation_id")
  conversation     Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  agentId          String       @map("agent_id")
  agent            Agent        @relation(fields: [agentId], references: [id], onDelete: Cascade)
  messageIndex     Int          @map("message_index")
  feedbackText     String       @db.Text  @map("feedback_text")
  processedContent String?      @db.Text  @map("processed_content")
  status           String       @default("pending") // pending | processing | ready | dismissed
  createdAt        DateTime     @default(now())      @map("created_at")

  @@index([conversationId])
  @@index([agentId])
  @@map("conversation_feedbacks")
}
```

- [ ] **Step 4: Add relations to existing models**

In the `Conversation` model, add:
```prisma
  feedbacks ConversationFeedback[]
```

In the `Agent` model, add:
```prisma
  feedbacks        ConversationFeedback[]
```

- [ ] **Step 5: Run prisma generate and create migration**

Run:
```bash
cd apps/backend
npx prisma generate
npx prisma migrate dev --name add-prompt-engineering-fields
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma/
git commit -m "feat: add prompt engineering schema fields (conversationFlow, category, ConversationFeedback)"
```

---

### Task 2: Create agent archetypes definitions

**Files:**
- Create: `apps/backend/src/core/entities/agent-archetypes.ts`

- [ ] **Step 1: Create the archetypes file**

```typescript
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
    'Se perguntarem sobre algo fora do seu escopo, redirecione educadamente: "Sou especializado em [área]. Posso te ajudar com isso?"',
  ].join('\n'),

  focused: [
    'Priorize as informações da base de conhecimento. Você pode conversar naturalmente para criar conexão.',
    'Ao falar sobre serviços, preços ou políticas, baseie-se EXCLUSIVAMENTE nas informações fornecidas.',
    'Se não souber algo específico (preço, disponibilidade, procedimento), diga que vai confirmar com a equipe.',
    'Não invente dados factuais — estimativas, valores aproximados ou serviços não listados.',
  ].join('\n'),

  free: [
    'Use a base de conhecimento como referência principal.',
    'Você pode conversar sobre assuntos gerais e ser flexível na interação.',
    'Sempre direcione a conversa para os objetivos definidos no seu fluxo.',
    'Para informações específicas (preços, procedimentos, horários), consulte apenas a base de conhecimento.',
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/core/entities/agent-archetypes.ts
git commit -m "feat: add agent archetypes with conversation flows and containment rules"
```

---

### Task 3: Create `buildEnrichedSystemPrompt` function

**Files:**
- Modify: `apps/backend/src/core/entities/Agent.ts:22-75`

- [ ] **Step 1: Update Agent interface with new fields**

In `Agent.ts`, add to the Agent interface (after `historyLimit`):

```typescript
  // Prompt engineering fields
  purpose: string
  companyName?: string
  companyUrl?: string
  communicationTone: string
  useEmojis: boolean
  splitResponse: boolean
  restrictTopics: boolean
  signName: boolean
  conversationFlow?: string
```

- [ ] **Step 2: Create `buildEnrichedSystemPrompt` function**

Add after the existing `buildSystemPrompt` function (keep `buildSystemPrompt` for backwards compat):

```typescript
import { AGENT_ARCHETYPES, CONTAINMENT_RULES, TRAINING_CATEGORY_HEADERS } from './agent-archetypes'

/**
 * Tipo do agente completo para montagem do prompt enriquecido.
 */
type EnrichedAgent = Pick<Agent,
  | 'name' | 'description' | 'personality' | 'actionPrompt' | 'systemPrompt'
  | 'agentType' | 'purpose' | 'companyName' | 'companyUrl'
  | 'communicationTone' | 'useEmojis' | 'splitResponse'
  | 'restrictTopics' | 'signName' | 'conversationFlow'
>

interface EnrichedPromptContext {
  agent: EnrichedAgent
  contactName?: string
  trainingsByCategory?: Record<string, Array<{ title?: string; content: string }>>
  extraSystemCtx?: string
  calendarPrompt?: string
}

/**
 * Monta o system prompt enriquecido com 6 blocos estruturados.
 * Substitui buildSystemPrompt com contexto completo do agente.
 */
export function buildEnrichedSystemPrompt(ctx: EnrichedPromptContext): string {
  const { agent } = ctx
  const blocks: string[] = []

  // ── BLOCO 1: IDENTIDADE ──
  const identityParts: string[] = []
  if (agent.companyName) {
    identityParts.push(`Você é ${agent.name}, assistente virtual da ${agent.companyName}.`)
  } else {
    identityParts.push(`Você é ${agent.name}.`)
  }
  if (agent.description) identityParts.push(agent.description)
  if (agent.companyUrl) identityParts.push(`Site: ${agent.companyUrl}`)

  blocks.push(`── IDENTIDADE ──\n${identityParts.join('\n')}`)

  // ── BLOCO 1.5: CONTEXTO ATIVO ──
  if (agent.agentType === 'ATIVO') {
    blocks.push(ATIVO_CONTEXT_BLOCK)
  }

  // ── BLOCO 2: PERSONALIDADE ──
  const personalityParts: string[] = []
  const personality = agent.personality?.trim()
  if (personality) personalityParts.push(personality)

  // Regras automáticas de comportamento
  const toneMap: Record<string, string> = {
    formal: 'Fale de maneira formal e profissional. Use "senhor(a)" quando apropriado.',
    normal: 'Fale de maneira natural e cordial.',
    casual: 'Fale de maneira descontraída e próxima. Use linguagem informal.',
  }
  const toneRule = toneMap[agent.communicationTone] ?? toneMap.normal
  personalityParts.push(toneRule)

  if (agent.useEmojis) {
    personalityParts.push('Use emojis com naturalidade para tornar a conversa mais acolhedora.')
  } else {
    personalityParts.push('Não use emojis nas respostas.')
  }

  if (agent.signName) {
    personalityParts.push(`Assine como "${agent.name}" ao final das mensagens.`)
  }

  if (agent.splitResponse) {
    personalityParts.push('Divida respostas longas em mensagens curtas de 1-2 frases, como em uma conversa natural de WhatsApp.')
  }

  if (personalityParts.length > 0) {
    blocks.push(`── PERSONALIDADE ──\n${personalityParts.join('\n')}`)
  }

  // ── BLOCO 3: FLUXO CONVERSACIONAL ──
  const archetype = AGENT_ARCHETYPES[agent.purpose]
  const flow = agent.conversationFlow?.trim() || archetype?.conversationFlow
  if (flow) {
    blocks.push(`── FLUXO DA CONVERSA ──\nSiga estas etapas na ordem, adaptando conforme o andamento:\n${flow}`)
  }

  // ── BLOCO 4: OBJETIVO & INSTRUÇÕES ──
  const action = agent.actionPrompt?.trim() || agent.systemPrompt?.trim()
  if (action) {
    blocks.push(`── OBJETIVO ──\n${action}`)
  }

  // ── BLOCO 5: GUARDRAILS ──
  const containmentLevel = agent.restrictTopics ? 'restricted' : (archetype?.containment ?? 'focused')
  const guardrailParts: string[] = [CONTAINMENT_RULES[containmentLevel]]

  // Feedbacks (prioridade alta) aparecem aqui
  const feedbackTrainings = ctx.trainingsByCategory?.feedback
  if (feedbackTrainings && feedbackTrainings.length > 0) {
    guardrailParts.push('')
    guardrailParts.push(TRAINING_CATEGORY_HEADERS.feedback)
    feedbackTrainings.forEach((t) => {
      guardrailParts.push(t.title ? `- [${t.title}] ${t.content}` : `- ${t.content}`)
    })
  }

  blocks.push(`── REGRAS ──\n${guardrailParts.join('\n')}`)

  // ── BLOCO 6: CONTEXTO DINÂMICO ──
  const dynamicParts: string[] = []

  if (ctx.contactName) {
    dynamicParts.push(`Você está conversando com: ${ctx.contactName}`)
  }

  if (ctx.extraSystemCtx) {
    dynamicParts.push(ctx.extraSystemCtx)
  }

  // Trainings agrupados por categoria (exceto feedback, que já está nos guardrails)
  if (ctx.trainingsByCategory) {
    const categories = Object.entries(ctx.trainingsByCategory).filter(([cat]) => cat !== 'feedback')
    if (categories.length > 0) {
      dynamicParts.push('── BASE DE CONHECIMENTO ──')
      for (const [category, trainings] of categories) {
        const header = TRAINING_CATEGORY_HEADERS[category] ?? TRAINING_CATEGORY_HEADERS.general
        dynamicParts.push(`\n${header}`)
        trainings.forEach((t) => {
          dynamicParts.push(t.title ? `[${t.title}]\n${t.content}` : t.content)
        })
      }
    }
  }

  if (ctx.calendarPrompt) {
    dynamicParts.push(ctx.calendarPrompt)
  }

  if (dynamicParts.length > 0) {
    blocks.push(dynamicParts.join('\n\n'))
  }

  return blocks.join('\n\n---\n\n')
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/core/entities/Agent.ts
git commit -m "feat: add buildEnrichedSystemPrompt with 6-block structured prompt assembly"
```

---

### Task 4: Update `getTrainingContext` to return by category

**Files:**
- Modify: `apps/backend/src/features/agents/trainings.service.ts:52-67`

- [ ] **Step 1: Add `getTrainingsByCategory` method**

Add a new method to `TrainingsService` (keep `getTrainingContext` for backwards compat):

```typescript
  /**
   * Retorna trainings agrupados por categoria para o prompt enriquecido.
   */
  async getTrainingsByCategory(agentId: string): Promise<Record<string, Array<{ title?: string; content: string }>>> {
    const trainings = await this.prisma.agentTraining.findMany({
      where:   { agentId, status: 'ready' },
      orderBy: { createdAt: 'asc' },
      select:  { category: true, title: true, content: true },
    })

    const grouped: Record<string, Array<{ title?: string; content: string }>> = {}
    for (const t of trainings) {
      const cat = (t as any).category ?? 'general'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push({ title: t.title ?? undefined, content: t.content })
    }
    return grouped
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/features/agents/trainings.service.ts
git commit -m "feat: add getTrainingsByCategory for enriched prompt system"
```

---

### Task 5: Wire `buildEnrichedSystemPrompt` into webhook-ingestion and playground

**Files:**
- Modify: `apps/backend/src/features/webhook-ingestion/webhook-ingestion.service.ts:525-545`
- Modify: `apps/backend/src/features/playground/playground.service.ts:115-130`

- [ ] **Step 1: Update webhook-ingestion**

Replace lines 525-545 in `webhook-ingestion.service.ts`:

Change the import at top from:
```typescript
import { buildSystemPrompt } from '../../core/entities/Agent'
```
to:
```typescript
import { buildEnrichedSystemPrompt } from '../../core/entities/Agent'
```

Replace the prompt assembly block (lines 525-545) with:

```typescript
    // 6. Monta system prompt enriquecido
    let trainingsByCategory: Record<string, Array<{ title?: string; content: string }>> = {}
    try { trainingsByCategory = await this.trainingsService.getTrainingsByCategory(agentRow.id) } catch {}

    let calendarIntegration: any = null
    try { calendarIntegration = await this.calendarService.getIntegration(agentRow.id) } catch {}

    const composedSystemPrompt = buildEnrichedSystemPrompt({
      agent: {
        name:              agentRow.name,
        description:       agentRow.description ?? undefined,
        personality:       agentRow.personality ?? undefined,
        actionPrompt:      agentRow.actionPrompt ?? undefined,
        systemPrompt:      agentRow.systemPrompt ?? undefined,
        agentType:         (agentRow as any).agentType ?? 'PASSIVO',
        purpose:           (agentRow as any).purpose ?? 'support',
        companyName:       (agentRow as any).companyName ?? undefined,
        companyUrl:        (agentRow as any).companyUrl ?? undefined,
        communicationTone: (agentRow as any).communicationTone ?? 'normal',
        useEmojis:         (agentRow as any).useEmojis ?? true,
        splitResponse:     (agentRow as any).splitResponse ?? true,
        restrictTopics:    (agentRow as any).restrictTopics ?? false,
        signName:          (agentRow as any).signName ?? false,
        conversationFlow:  (agentRow as any).conversationFlow ?? undefined,
      },
      contactName: name ?? undefined,
      trainingsByCategory,
      extraSystemCtx: agentOverride?.extraSystemCtx,
      calendarPrompt: calendarIntegration?.isActive ? getCalendarSystemPrompt() : undefined,
    })
```

- [ ] **Step 2: Update playground**

Replace lines 116-130 in `playground.service.ts`:

Change the import from:
```typescript
import { buildSystemPrompt } from '../../core/entities/Agent'
```
to:
```typescript
import { buildEnrichedSystemPrompt } from '../../core/entities/Agent'
```

Replace the prompt assembly block with:

```typescript
    let trainingsByCategory: Record<string, Array<{ title?: string; content: string }>> = {}
    try { trainingsByCategory = await this.trainingsService.getTrainingsByCategory(agentId) } catch {}

    let calendarIntegration: any = null
    try { calendarIntegration = await this.calendarService.getIntegration(agentId) } catch {}

    const systemPrompt = buildEnrichedSystemPrompt({
      agent,
      trainingsByCategory,
      calendarPrompt: calendarIntegration?.isActive ? getCalendarSystemPrompt() : undefined,
    })
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/features/webhook-ingestion/webhook-ingestion.service.ts apps/backend/src/features/playground/playground.service.ts
git commit -m "feat: wire buildEnrichedSystemPrompt into webhook-ingestion and playground"
```

---

## Chunk 2: Training Processing Pipeline

### Task 6: Install document processing dependencies

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/backend
npm install pdf-parse mammoth cheerio
npm install -D @types/pdf-parse
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/package.json apps/backend/package-lock.json
git commit -m "chore: add pdf-parse, mammoth, cheerio for document processing"
```

---

### Task 7: Create training processor service

**Files:**
- Create: `apps/backend/src/features/agents/training-processor.service.ts`

- [ ] **Step 1: Create the service**

```typescript
/**
 * TrainingProcessorService — Processa conteúdo raw com IA antes de virar training.
 *
 * Fluxo: texto raw → IA extrai/categoriza/formata → training(s) com status ready.
 * Suporta: texto manual, URL (single + crawl), documentos (MD, PDF, DOCX).
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { AiEngineService } from '@/infrastructure/ai-engine/ai-engine.service'
import * as cheerio from 'cheerio'

interface ProcessedTrainingItem {
  category: string
  title: string
  content: string
}

@Injectable()
export class TrainingProcessorService {
  private readonly logger = new Logger(TrainingProcessorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
  ) {}

  /**
   * Processa texto raw com IA e cria trainings categorizados.
   */
  async processText(agentId: string, rawText: string, sourceTitle?: string): Promise<void> {
    // Criar training pendente
    const training = await this.prisma.agentTraining.create({
      data: {
        agentId,
        type: 'text',
        title: sourceTitle ?? 'Processando...',
        content: rawText,
        status: 'processing',
        category: 'general',
        metadata: { charCount: rawText.length, source: 'text' },
      },
    })

    try {
      const items = await this.extractWithAi(rawText)
      // Deletar o placeholder e criar os trainings processados
      await this.prisma.agentTraining.delete({ where: { id: training.id } })
      for (const item of items) {
        await this.prisma.agentTraining.create({
          data: {
            agentId,
            type: 'text',
            title: item.title,
            content: item.content,
            status: 'ready',
            category: item.category,
            metadata: { charCount: item.content.length, source: 'text', processedByAi: true },
          },
        })
      }
    } catch (error) {
      this.logger.error(`Failed to process training ${training.id}`, error)
      await this.prisma.agentTraining.update({
        where: { id: training.id },
        data: { status: 'error' },
      })
    }
  }

  /**
   * Faz scrape de uma URL (single page) e processa com IA.
   */
  async processUrl(agentId: string, url: string, crawl = false, maxPages = 5): Promise<void> {
    const training = await this.prisma.agentTraining.create({
      data: {
        agentId,
        type: 'url',
        title: `Importando: ${url}`,
        content: url,
        status: 'processing',
        category: 'general',
        metadata: { url, crawl, source: 'url' },
      },
    })

    try {
      let fullText: string

      if (crawl) {
        fullText = await this.crawlWebsite(url, maxPages)
      } else {
        fullText = await this.scrapePage(url)
      }

      if (!fullText.trim()) {
        throw new Error('Nenhum conteúdo extraído da URL')
      }

      const items = await this.extractWithAi(fullText)
      await this.prisma.agentTraining.delete({ where: { id: training.id } })
      for (const item of items) {
        await this.prisma.agentTraining.create({
          data: {
            agentId,
            type: 'url',
            title: item.title,
            content: item.content,
            status: 'ready',
            category: item.category,
            metadata: { charCount: item.content.length, source: 'url', url, processedByAi: true },
          },
        })
      }
    } catch (error) {
      this.logger.error(`Failed to process URL ${url}`, error)
      await this.prisma.agentTraining.update({
        where: { id: training.id },
        data: { status: 'error', content: `Erro: ${(error as Error).message}` },
      })
    }
  }

  /**
   * Processa documento (MD, PDF, DOCX) e cria trainings.
   */
  async processDocument(agentId: string, buffer: Buffer, fileName: string, mimeType: string): Promise<void> {
    const training = await this.prisma.agentTraining.create({
      data: {
        agentId,
        type: 'document',
        title: `Processando: ${fileName}`,
        content: '',
        status: 'processing',
        category: 'general',
        metadata: { fileName, mimeType, source: 'document' },
      },
    })

    try {
      let text: string

      if (fileName.endsWith('.md') || mimeType === 'text/markdown') {
        text = buffer.toString('utf-8')
      } else if (fileName.endsWith('.pdf') || mimeType === 'application/pdf') {
        const pdfParse = (await import('pdf-parse')).default
        const result = await pdfParse(buffer)
        text = result.text
      } else if (
        fileName.endsWith('.docx') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else {
        // Fallback: tenta como texto
        text = buffer.toString('utf-8')
      }

      if (!text.trim()) {
        throw new Error('Nenhum conteúdo extraído do documento')
      }

      const items = await this.extractWithAi(text)
      await this.prisma.agentTraining.delete({ where: { id: training.id } })
      for (const item of items) {
        await this.prisma.agentTraining.create({
          data: {
            agentId,
            type: 'document',
            title: item.title,
            content: item.content,
            status: 'ready',
            category: item.category,
            metadata: { charCount: item.content.length, source: 'document', fileName, processedByAi: true },
          },
        })
      }
    } catch (error) {
      this.logger.error(`Failed to process document ${fileName}`, error)
      await this.prisma.agentTraining.update({
        where: { id: training.id },
        data: { status: 'error', content: `Erro: ${(error as Error).message}` },
      })
    }
  }

  /**
   * Processa feedback de conversa e gera regra generalizada.
   */
  async processFeedback(
    feedbackId: string,
    clientMessage: string,
    agentResponse: string,
    feedbackText: string,
  ): Promise<string> {
    const prompt = [
      'Você é um especialista em qualidade de atendimento por IA.',
      '',
      'Analise a interação abaixo e o feedback do supervisor. Gere uma REGRA GENERALIZADA que a IA deve seguir em situações similares no futuro.',
      '',
      `Mensagem do cliente: "${clientMessage}"`,
      `Resposta do agente: "${agentResponse}"`,
      `Feedback do supervisor: "${feedbackText}"`,
      '',
      'Retorne APENAS a regra, em uma frase clara e direta. Exemplo:',
      '"Quando o cliente demonstrar intenção clara de agendar, ofereça horários disponíveis diretamente em vez de fazer perguntas adicionais."',
    ].join('\n')

    const result = await this.aiEngine.complete({
      messages:     [{ role: 'user', content: prompt }],
      model:        'claude-sonnet-4-20250514',
      temperature:  0.3,
      maxTokens:    300,
    })

    return result.content
  }

  // ── Private helpers ──

  private async extractWithAi(rawText: string): Promise<ProcessedTrainingItem[]> {
    // Truncar se muito longo (limite seguro pra context window)
    const truncated = rawText.length > 15000 ? rawText.slice(0, 15000) + '\n\n[... conteúdo truncado]' : rawText

    const prompt = [
      'Analise o conteúdo abaixo e extraia informações estruturadas para ser usado como base de conhecimento de um agente de IA.',
      '',
      'Retorne um JSON válido com o seguinte formato:',
      '```json',
      '{ "items": [{ "category": "faq|services|pricing|policies|scripts|general", "title": "título descritivo", "content": "informação processada" }] }',
      '```',
      '',
      'Regras:',
      '- Remova informações vagas, ambíguas ou irrelevantes',
      '- Mantenha dados factuais (preços, nomes, horários, endereços) EXATOS',
      '- Se houver múltiplas categorias de informação, separe em múltiplos itens',
      '- Formato conciso — clareza e objetividade, não prosa',
      '- Cada item deve ser auto-contido (entendível sem os outros)',
      '- Use "pricing" para qualquer informação de valor/preço',
      '- Use "faq" para perguntas e respostas comuns',
      '- Use "services" para lista de serviços/produtos',
      '- Use "policies" para regras, horários, políticas',
      '- Use "scripts" para frases modelo ou roteiros de atendimento',
      '- Use "general" para contexto geral que não se encaixa nas outras',
      '',
      'Conteúdo para processar:',
      '---',
      truncated,
    ].join('\n')

    const result = await this.aiEngine.complete({
      messages:     [{ role: 'user', content: prompt }],
      model:        'claude-sonnet-4-20250514',
      temperature:  0.2,
      maxTokens:    4000,
    })

    // Parse JSON da resposta
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      this.logger.warn('AI did not return valid JSON, using raw content')
      return [{ category: 'general', title: 'Conteúdo importado', content: rawText.slice(0, 5000) }]
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      const items: ProcessedTrainingItem[] = (parsed.items || [parsed]).map((item: any) => ({
        category: item.category ?? 'general',
        title:    item.title ?? 'Sem título',
        content:  item.content ?? '',
      }))
      return items.filter((i) => i.content.trim().length > 0)
    } catch {
      this.logger.warn('Failed to parse AI response JSON')
      return [{ category: 'general', title: 'Conteúdo importado', content: rawText.slice(0, 5000) }]
    }
  }

  private async scrapePage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BeaconBot/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await response.text()
    return this.extractTextFromHtml(html)
  }

  private async crawlWebsite(baseUrl: string, maxPages: number): Promise<string> {
    const visited = new Set<string>()
    const toVisit = [baseUrl]
    const texts: string[] = []
    const baseHost = new URL(baseUrl).hostname

    while (toVisit.length > 0 && visited.size < maxPages) {
      const url = toVisit.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'BeaconBot/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        const html = await response.text()
        texts.push(this.extractTextFromHtml(html))

        // Extrair links internos
        const $ = cheerio.load(html)
        $('a[href]').each((_, el) => {
          try {
            const href = $(el).attr('href')
            if (!href) return
            const resolved = new URL(href, url)
            if (resolved.hostname === baseHost && !visited.has(resolved.href)) {
              toVisit.push(resolved.href)
            }
          } catch { /* ignore invalid URLs */ }
        })
      } catch (error) {
        this.logger.warn(`Failed to crawl ${url}: ${(error as Error).message}`)
      }
    }

    return texts.join('\n\n---\n\n')
  }

  private extractTextFromHtml(html: string): string {
    const $ = cheerio.load(html)
    // Remover scripts, styles, nav, footer
    $('script, style, nav, footer, header, noscript, iframe').remove()
    // Extrair texto limpo
    return $('body').text().replace(/\s+/g, ' ').trim()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/features/agents/training-processor.service.ts
git commit -m "feat: add TrainingProcessorService with AI processing, URL scraping, and document parsing"
```

---

### Task 8: Create feedback service

**Files:**
- Create: `apps/backend/src/features/agents/feedback.service.ts`

- [ ] **Step 1: Create the service**

```typescript
/**
 * FeedbackService — Supervisão humana de conversas.
 *
 * O operador pontua mensagens do agente em conversas reais.
 * O feedback é processado por IA e vira training tipo 'feedback'.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/infrastructure/database/prisma/prisma.service'
import { TrainingProcessorService } from './training-processor.service'

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: TrainingProcessorService,
  ) {}

  /**
   * Lista feedbacks de uma conversa.
   */
  async findByConversation(conversationId: string) {
    return this.prisma.conversationFeedback.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Lista feedbacks de um agente.
   */
  async findByAgent(agentId: string) {
    return this.prisma.conversationFeedback.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Cria feedback, processa com IA, e gera training.
   */
  async create(dto: {
    conversationId: string
    agentId: string
    messageIndex: number
    feedbackText: string
  }) {
    // Buscar conversa e mensagens
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) throw new NotFoundException('Conversa não encontrada')

    const targetMessage = conversation.messages[dto.messageIndex]
    if (!targetMessage) throw new NotFoundException('Mensagem não encontrada no índice informado')

    // Buscar mensagem do cliente anterior (contexto)
    const previousMessage = dto.messageIndex > 0
      ? conversation.messages[dto.messageIndex - 1]
      : null

    // Criar feedback como pendente
    const feedback = await this.prisma.conversationFeedback.create({
      data: {
        conversationId: dto.conversationId,
        agentId: dto.agentId,
        messageIndex: dto.messageIndex,
        feedbackText: dto.feedbackText,
        status: 'processing',
      },
    })

    // Processar com IA (async, não bloqueia)
    this.processAsync(feedback.id, dto.agentId, previousMessage?.content ?? '', targetMessage.content, dto.feedbackText)
      .catch((err) => this.logger.error(`Failed to process feedback ${feedback.id}`, err))

    return feedback
  }

  /**
   * Descartar um feedback.
   */
  async dismiss(feedbackId: string) {
    return this.prisma.conversationFeedback.update({
      where: { id: feedbackId },
      data: { status: 'dismissed' },
    })
  }

  private async processAsync(
    feedbackId: string,
    agentId: string,
    clientMessage: string,
    agentResponse: string,
    feedbackText: string,
  ) {
    try {
      const processedContent = await this.processor.processFeedback(
        feedbackId, clientMessage, agentResponse, feedbackText,
      )

      // Atualizar feedback
      await this.prisma.conversationFeedback.update({
        where: { id: feedbackId },
        data: { processedContent, status: 'ready' },
      })

      // Criar training tipo feedback
      await this.prisma.agentTraining.create({
        data: {
          agentId,
          type: 'feedback',
          title: `Feedback: ${feedbackText.slice(0, 80)}`,
          content: processedContent,
          status: 'ready',
          category: 'feedback',
          metadata: { feedbackId, source: 'conversation_feedback' },
        },
      })
    } catch (error) {
      this.logger.error(`Failed to process feedback ${feedbackId}`, error)
      await this.prisma.conversationFeedback.update({
        where: { id: feedbackId },
        data: { status: 'error' },
      })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/features/agents/feedback.service.ts
git commit -m "feat: add FeedbackService with AI-powered conversation feedback processing"
```

---

## Chunk 3: API Endpoints + Module Wiring

### Task 9: Add new endpoints to trainings controller

**Files:**
- Modify: `apps/backend/src/features/agents/trainings.controller.ts`

- [ ] **Step 1: Rewrite controller with new endpoints**

Replace the full file:

```typescript
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsString, IsOptional, IsIn, IsBoolean, IsNumber } from 'class-validator'
import { Transform } from 'class-transformer'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { TrainingsService } from './trainings.service'
import { TrainingProcessorService } from './training-processor.service'

class CreateTrainingDto {
  @IsIn(['text', 'url', 'document'])
  type!: string

  @IsOptional() @IsString()
  title?: string

  @IsString()
  content!: string

  @IsOptional() @IsIn(['faq', 'services', 'pricing', 'policies', 'scripts', 'general'])
  category?: string
}

class ProcessTextDto {
  @IsString()
  content!: string

  @IsOptional() @IsString()
  title?: string
}

class ProcessUrlDto {
  @IsString()
  url!: string

  @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  crawl?: boolean

  @IsOptional() @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  maxPages?: number
}

class UpdateTrainingDto {
  @IsOptional() @IsString()
  title?: string

  @IsOptional() @IsString()
  content?: string

  @IsOptional() @IsIn(['faq', 'services', 'pricing', 'policies', 'scripts', 'general', 'feedback'])
  category?: string
}

@Controller('agents/:agentId/trainings')
@UseGuards(JwtGuard)
export class TrainingsController {
  constructor(
    private readonly trainings: TrainingsService,
    private readonly processor: TrainingProcessorService,
  ) {}

  @Get()
  findAll(@Param('agentId') agentId: string) {
    return this.trainings.findByAgent(agentId)
  }

  @Post()
  create(@Param('agentId') agentId: string, @Body() dto: CreateTrainingDto) {
    return this.trainings.create(agentId, dto)
  }

  @Patch(':trainingId')
  update(
    @Param('agentId') agentId: string,
    @Param('trainingId') trainingId: string,
    @Body() dto: UpdateTrainingDto,
  ) {
    return this.trainings.update(agentId, trainingId, dto)
  }

  @Delete(':trainingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('agentId') agentId: string, @Param('trainingId') trainingId: string) {
    return this.trainings.remove(agentId, trainingId)
  }

  // ── Processamento com IA ──

  @Post('process-text')
  async processText(@Param('agentId') agentId: string, @Body() dto: ProcessTextDto) {
    await this.processor.processText(agentId, dto.content, dto.title)
    return { message: 'Processamento iniciado' }
  }

  @Post('process-url')
  async processUrl(@Param('agentId') agentId: string, @Body() dto: ProcessUrlDto) {
    await this.processor.processUrl(agentId, dto.url, dto.crawl ?? false, dto.maxPages ?? 5)
    return { message: 'Importação iniciada' }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('agentId') agentId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(pdf|markdown|md|docx|vnd\.openxmlformats)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await this.processor.processDocument(agentId, file.buffer, file.originalname, file.mimetype)
    return { message: 'Documento em processamento' }
  }
}
```

- [ ] **Step 2: Add `update` method to TrainingsService**

In `trainings.service.ts`, add:

```typescript
  async update(agentId: string, trainingId: string, dto: { title?: string; content?: string; category?: string }) {
    const training = await this.prisma.agentTraining.findFirst({
      where: { id: trainingId, agentId },
    })
    if (!training) throw new NotFoundException('Treinamento não encontrado')

    return this.prisma.agentTraining.update({
      where: { id: trainingId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.category !== undefined && { category: dto.category }),
      },
    })
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/features/agents/trainings.controller.ts apps/backend/src/features/agents/trainings.service.ts
git commit -m "feat: add training processing endpoints (process-text, process-url, upload)"
```

---

### Task 10: Create feedback controller

**Files:**
- Create: `apps/backend/src/presentation/agents/feedback.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { IsString, IsNumber } from 'class-validator'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { FeedbackService } from '@/features/agents/feedback.service'

class CreateFeedbackDto {
  @IsString()
  conversationId!: string

  @IsNumber()
  messageIndex!: number

  @IsString()
  feedbackText!: string
}

@Controller('agents/:agentId/feedbacks')
@UseGuards(JwtGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  findByAgent(@Param('agentId') agentId: string) {
    return this.feedbackService.findByAgent(agentId)
  }

  @Get('conversation/:conversationId')
  findByConversation(@Param('conversationId') conversationId: string) {
    return this.feedbackService.findByConversation(conversationId)
  }

  @Post()
  create(@Param('agentId') agentId: string, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create({ ...dto, agentId })
  }

  @Patch(':feedbackId/dismiss')
  @HttpCode(HttpStatus.OK)
  dismiss(@Param('feedbackId') feedbackId: string) {
    return this.feedbackService.dismiss(feedbackId)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/presentation/agents/feedback.controller.ts
git commit -m "feat: add FeedbackController with conversation feedback endpoints"
```

---

### Task 11: Wire everything into AgentsModule

**Files:**
- Modify: `apps/backend/src/features/agents/agents.module.ts`

- [ ] **Step 1: Update module**

```typescript
import { Module }                  from '@nestjs/common'
import { AgentsController }        from '../../presentation/agents/agents.controller'
import { FeedbackController }      from '../../presentation/agents/feedback.controller'
import { AgentsService }           from './agents.service'
import { TrainingsService }        from './trainings.service'
import { TrainingProcessorService } from './training-processor.service'
import { FeedbackService }         from './feedback.service'
import { TrainingsController }     from './trainings.controller'
import { AgentRepository }         from '../../infrastructure/database/repositories/agent.repository'
import { AGENT_REPOSITORY }        from '../../core/repositories/IAgentRepository'
import { AiEngineModule }          from '../../infrastructure/ai-engine/ai-engine.module'
import { PrismaModule }            from '../../infrastructure/database/prisma/prisma.module'

@Module({
  imports:     [AiEngineModule, PrismaModule],
  controllers: [AgentsController, TrainingsController, FeedbackController],
  providers: [
    AgentsService,
    TrainingsService,
    TrainingProcessorService,
    FeedbackService,
    { provide: AGENT_REPOSITORY, useClass: AgentRepository },
  ],
  exports: [AgentsService, TrainingsService],
})
export class AgentsModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/features/agents/agents.module.ts
git commit -m "feat: wire TrainingProcessorService, FeedbackService, FeedbackController into AgentsModule"
```

---

### Task 12: Update Agent DTOs to include new fields

**Files:**
- Modify: `apps/backend/src/presentation/agents/agents.controller.ts`

- [ ] **Step 1: Add `conversationFlow` to CreateAgentDto and UpdateAgentDto**

In `agents.controller.ts`, add to both DTOs:

```typescript
  @IsOptional() @IsString()
  conversationFlow?: string
```

And update the `purpose` validator in both DTOs from:
```typescript
  @IsOptional() @IsString()
  purpose?: string
```
to:
```typescript
  @IsOptional()
  @IsIn(['qualification', 'qualification_scheduling', 'qualification_scheduling_reminder', 'sales', 'support', 'reception', 'reactivation', 'survey'])
  purpose?: string
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/presentation/agents/agents.controller.ts
git commit -m "feat: add conversationFlow field and expanded purpose enum to Agent DTOs"
```

---

### Task 13: Build and verify

- [ ] **Step 1: Run TypeScript build**

```bash
cd apps/backend
npm run build
```

Fix any TypeScript errors that arise. Common issues: unused imports, missing types.

- [ ] **Step 2: Test locally**

```bash
cd apps/backend
npm run start:dev
```

Test endpoints:
- `POST /agents/:id/trainings/process-text` with `{ "content": "Texto de teste" }`
- `POST /agents/:id/trainings/process-url` with `{ "url": "https://example.com" }`
- `GET /agents/:id/feedbacks`

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues for prompt engineering system"
```
