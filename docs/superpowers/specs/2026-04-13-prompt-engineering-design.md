# Prompt Engineering System — Design Spec

**Data:** 2026-04-13
**Status:** Aprovado
**Escopo:** Sistema de engenharia de prompt automática para agentes de IA do Carolina Beacon

---

## Problema

Hoje o `buildSystemPrompt` usa apenas `personality` + `actionPrompt` (ou `systemPrompt` legado). Campos como `companyName`, `companyUrl`, `communicationTone`, `purpose`, `useEmojis`, `signName`, `restrictTopics` estão no banco mas nunca são injetados no prompt. Trainings são concatenados como texto bruto sem categorização ou processamento. Não há feedback loop para melhoria contínua.

## Decisões de Design

1. **Abordagem C (contexto injetado ao redor do manual):** O operador escreve `personality` e `actionPrompt` (o core). O sistema injeta automaticamente identidade, regras de comportamento, fluxo conversacional e guardrails ao redor — usando campos do banco.

2. **Arquétipos como templates no código (Abordagem A):** Poucos e estáveis, não precisam de CRUD. Hardcoded no backend, fácil de manter.

3. **Trainings processados por IA:** Conteúdo raw passa por IA de processamento que extrai, categoriza e formata antes de virar training. Evita texto bruto no prompt.

4. **Feedback loop humano:** Operador supervisiona conversas reais e pontua melhorias que viram trainings de alta prioridade.

---

## Seção 1: Arquitetura do Prompt Engine

O sistema monta o system prompt final em 6 blocos ordenados por prioridade:

### Bloco 1 — IDENTIDADE (automático)

Gerado dos campos: `name`, `companyName`, `companyUrl`, `description`.

```
Você é {name}, assistente virtual da {companyName}.
{description}
Site: {companyUrl}
```

Se `companyName` estiver vazio, bloco não aparece.

### Bloco 2 — PERSONALIDADE (manual + regras automáticas)

O campo `personality` escrito pelo operador, complementado com regras injetadas dos campos booleanos:

- `communicationTone` → "Fale de maneira formal/casual/natural"
- `useEmojis` → "Use emojis naturalmente" / "Não use emojis"
- `signName` → "Assine como {name} ao final das mensagens"
- `splitResponse` → "Divida respostas longas em mensagens curtas de 1-2 frases"

### Bloco 3 — FLUXO CONVERSACIONAL (arquétipo ou override)

Se `conversationFlow` estiver preenchido, usa o texto do operador. Caso contrário, usa o template padrão do arquétipo baseado no `purpose`.

### Bloco 4 — OBJETIVO & INSTRUÇÕES (manual)

O campo `actionPrompt` escrito pelo operador. Instruções específicas do que a IA deve fazer.

### Bloco 5 — GUARDRAILS (automático)

Regras anti-alucinação geradas automaticamente:

- **Regra do "não sei":** "Se a informação não estiver na base de conhecimento, diga: 'Vou confirmar com a equipe e te retorno.' NUNCA invente."
- **Regra de citação:** "Ao falar sobre preços, procedimentos ou políticas, baseie-se EXCLUSIVAMENTE nas informações fornecidas."
- **Regra de escopo:** (se `restrictTopics` ativo) "Se perguntarem sobre assuntos fora do seu escopo, redirecione educadamente."
- **Correções de comportamento:** Trainings do tipo `feedback` com prioridade alta.

Nível de contenção baseado no purpose (pode ser overridden por `restrictTopics = true`).

### Bloco 6 — CONTEXTO DINÂMICO (runtime)

Injetado por conversa:
- Nome do contato
- Base de conhecimento (trainings agrupados por categoria)
- Calendar tools (se integração ativa)
- Extra system context (de automações)

---

## Seção 2: Arquétipos de Agente

8 arquétipos hardcoded, cada um com fluxo conversacional padrão e nível de contenção.

| purpose | Label | Contenção | Fluxo padrão |
|---------|-------|-----------|-------------|
| `qualification` | Qualificação | Focado | Cumprimentar → Entender necessidade → Perguntas de qualificação → Classificar lead → Encaminhar ou dispensar |
| `qualification_scheduling` | Qualificação + Agendamento | Focado | Cumprimentar → Entender necessidade → Qualificar → Oferecer horários → Agendar → Transferir |
| `qualification_scheduling_reminder` | Qualificação + Agendamento + Lembrete | Focado | Igual anterior + Confirmar agendamento com lembrete |
| `sales` | Vendas | Focado | Criar rapport → Entender dor → Apresentar solução → Lidar com objeções → Propor próximo passo |
| `support` | Suporte / SAC | Restrito | Cumprimentar → Entender problema → Buscar na base → Responder ou escalar → Confirmar resolução |
| `reception` | Recepção / Secretária | Livre | Cumprimentar → Entender necessidade → Direcionar (agendar, informar, transferir) |
| `reactivation` | Reativação / Win-back | Focado | Abordagem personalizada → Relembrar contexto → Oferecer novidade → Direcionar |
| `survey` | Pesquisa / NPS | Restrito | Contextualizar pesquisa → Perguntas em sequência → Agradecer |

### Níveis de Contenção

**Restrito** (support, survey):
> Responda APENAS com base nas informações da base de conhecimento. Se a informação não estiver disponível, diga: "Vou verificar com a equipe e te retorno." NUNCA invente informações, preços ou procedimentos.

**Focado** (qualification*, sales, reactivation):
> Priorize as informações da base de conhecimento. Você pode conversar naturalmente para criar conexão, mas ao falar sobre serviços, preços ou políticas, baseie-se EXCLUSIVAMENTE nas informações fornecidas. Se não souber, diga que vai confirmar.

**Livre** (reception):
> Use a base de conhecimento como referência. Você pode conversar sobre assuntos gerais, mas sempre direcione a conversa para os objetivos definidos. Para informações específicas (preços, procedimentos), consulte apenas a base de conhecimento.

### Override

- `restrictTopics = true` → força nível Restrito independente do purpose
- `conversationFlow` preenchido → sobrescreve fluxo padrão do arquétipo

---

## Seção 3: Pipeline de Processamento de Trainings

### Fontes de entrada

1. **Texto manual** — operador digita direto
2. **URL** — single page ou crawl (links internos, limite configurável, default 5 páginas)
3. **Documentos** — `.md` (direto), `.pdf` (pdf-parse), `.docx` (mammoth)

### Fluxo

```
Entrada → Extração de texto → IA de processamento → Training (status: ready)
```

### IA de processamento

Recebe texto raw e retorna JSON estruturado:

```json
{
  "items": [
    {
      "category": "faq|services|pricing|policies|scripts|general",
      "title": "título descritivo",
      "content": "informação processada, limpa, otimizada para prompt"
    }
  ]
}
```

Regras da IA de processamento:
- Remove informações vagas ou ambíguas
- Mantém dados factuais (preços, nomes, horários) EXATOS
- Se houver múltiplas categorias, separa em múltiplos itens
- Formato conciso — clareza, não prosa

### Categorias de training

| Categoria | Instrução injetada no prompt |
|-----------|----------------------------|
| `faq` | "Perguntas frequentes — responda diretamente quando a pergunta corresponder" |
| `services` | "Serviços disponíveis — use como referência, nunca invente serviços" |
| `pricing` | "Valores EXATOS — nunca arredonde, estime ou invente preços" |
| `policies` | "Regras e políticas — aplique como regra absoluta, sem exceções" |
| `scripts` | "Referências de linguagem — use como inspiração para tom e estilo" |
| `general` | "Contexto geral — use como background para a conversa" |
| `feedback` | "Correções de comportamento — aplique com prioridade alta" |

### Status flow

```
pending → processing → ready
                    → error
```

O operador pode editar `content` e `category` de qualquer training em `ready`.

---

## Seção 4: Feedback Loop

### Conceito

Operador supervisiona conversas reais do agente e pontua melhorias em mensagens específicas. O feedback é processado por IA e vira training do tipo `feedback`.

### Modelo: ConversationFeedback

```
id               String    @id @default(uuid())
conversationId   String    → Conversation
messageIndex     Int       → posição da mensagem no histórico
feedbackText     String    → o que o operador escreveu
processedContent String?   → regra gerada pela IA
status           String    → pending | processing | ready | dismissed
createdAt        DateTime
```

### Fluxo

1. Operador abre conversa (read-only)
2. Seleciona mensagem do agente
3. Escreve feedback: "Deveria ter oferecido horário aqui"
4. IA de processamento recebe: mensagem do cliente + resposta do agente + feedback
5. Gera regra generalizada: "Quando o cliente demonstrar intenção clara de agendar, ofereça horários diretamente"
6. Regra vira training tipo `feedback` com prioridade alta

### Consolidação

Quando agente acumular >15 feedbacks, sugerir consolidação — IA agrupa feedbacks similares em regras mais amplas.

---

## Seção 5: Mudanças Técnicas

### Prisma Schema

**Agent — alterações:**
- `purpose`: expandir de 3 para 8 valores
- `conversationFlow`: novo campo `String? @db.Text`

**AgentTraining — alterações:**
- `category`: novo campo `String @default("general")`

**ConversationFeedback — tabela nova:**
- `id`, `conversationId`, `messageIndex`, `feedbackText`, `processedContent`, `status`, `createdAt`

### Arquivos novos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `core/entities/agent-archetypes.ts` | Templates dos 8 arquétipos (fluxo, contenção, prompts) |
| `features/agents/training-processor.service.ts` | IA de processamento de trainings |
| `features/agents/feedback.service.ts` | CRUD de feedback + processamento |

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `core/entities/Agent.ts` | Nova função `buildEnrichedSystemPrompt` |
| `features/agents/trainings.service.ts` | `getTrainingContext()` agrupa por categoria com headers |
| `features/webhook-ingestion/webhook-ingestion.service.ts` | Usa `buildEnrichedSystemPrompt` |
| `features/playground/playground.service.ts` | Usa `buildEnrichedSystemPrompt` |
| `presentation/agents/agents.controller.ts` | Endpoints de upload, scrape, feedback |
| `schema.prisma` | Novos campos + tabela |

### Arquivos que NÃO mudam

- `ai-engine.service.ts` — recebe system prompt pronto
- `calendar-tools.ts` — injetado no bloco 6
- Componentes UI existentes
