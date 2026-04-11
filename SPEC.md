# Spec Técnica — Plataforma Beacon
> SaaS de IA Conversacional e Gestão de Agentes

---

## Contexto

O Beacon é uma plataforma SaaS interna para criação, teste e monitoramento de agentes de IA conversacional. O diferencial competitivo é a **Deep Observability**: dashboards de BI para IA que mensuram ROI, performance e comportamento de cada agente por tenant. O projeto está na fase de documentação — nenhum código existe ainda. Esta spec define a arquitetura completa, as decisões técnicas e o plano de execução sprint a sprint.

---

## 1. Stack Tecnológica

### Frontend
| Camada | Decisão | Justificativa |
|---|---|---|
| Framework | React 18 + TypeScript | Componentização exigida pelo UX Playbook |
| Build | Vite | Dev server rápido, HMR eficiente |
| Estilização | Tailwind CSS + CSS Variables | Design tokens do `/Brand` mapeados em variáveis |
| Componentes | Shadcn/UI (base) + componentes próprios | Primitivos acessíveis (Radix), customizados com Brand |
| Roteamento | React Router v6 | Rotas aninhadas por feature |
| Estado global | Zustand | Leve, sem boilerplate Redux |
| Data fetching | TanStack Query (React Query) | Cache, refetch, mutations com feedback |
| Gráficos | Recharts | Compatível com React, customizável para paleta Beacon |
| Formulários | React Hook Form + Zod | Validação em tempo real (exigência UX Playbook §4.2) |
| Testes | Vitest + Testing Library | Unit e integração de componentes |
| Ícones | Lucide React | Consistência visual, tree-shakeable |

### Backend
| Camada | Decisão |
|---|---|
| Runtime | Node.js 20 LTS + TypeScript |
| Framework | NestJS (Clean Architecture nativa) |
| ORM | Prisma (PostgreSQL) |
| Agentes | LangGraph (Python microservice via gRPC/HTTP) |
| Mensageria | BullMQ (Redis) para Broadcast assíncrono |
| Telemetria | OpenTelemetry SDK + Jaeger/Grafana |
| Auth | JWT + Refresh Token, middleware multi-tenant |
| Validação | class-validator + class-transformer |
| Testes | Jest + Supertest |

### Infra
| Serviço | Tecnologia |
|---|---|
| Banco principal | PostgreSQL 15 + extensão pgvector |
| Cache / Sessões | Redis 7 |
| Vector DB | Qdrant (self-hosted) |
| Containers | Docker + docker-compose (dev), Kubernetes (prod) |
| CI/CD | GitHub Actions |
| Observabilidade | OpenTelemetry Collector → Grafana + Jaeger |

---

## 2. Arquitetura Frontend — Brand System

> **Fonte da verdade:** pasta `/Brand` na raiz do repositório.
> Todo desenvolvedor frontend DEVE consultar os dois playbooks antes de criar qualquer componente.

### 2.1 Design Tokens — `/Brand/Brand Playbook - Guia de Uso de Cores da Plataforma Beacon.md`

Mapear as cores do Brand Playbook em CSS Custom Properties globais:

```css
/* src/styles/tokens.css */
:root {
  /* === BEACON BRAND COLORS === */
  --color-primary:       #f06529;  /* Laranja Principal — ações primárias, CTAs */
  --color-primary-hover: #e34c26;  /* Laranja Secundário — hover/active/focus */
  --color-gray-light:    #ebebeb;  /* Cinza Claro — fundos secundários, divisores */
  --color-white:         #ffffff;  /* Branco — fundos principais, cards */
  --color-black:         #000000;  /* Preto — texto, títulos, ícones */

  /* === SEMANTIC TOKENS (mapeiam Brand → contexto UI) === */
  --bg-app:              var(--color-white);
  --bg-card:             var(--color-white);
  --bg-secondary:        var(--color-gray-light);
  --bg-sidebar:          var(--color-black);       /* Dark Mode sidebar (UX Playbook §3) */
  --text-primary:        var(--color-black);
  --text-on-dark:        var(--color-white);
  --border-subtle:       var(--color-gray-light);
  --border-focus:        var(--color-primary-hover);
  --interactive-primary: var(--color-primary);
  --interactive-hover:   var(--color-primary-hover);
  --disabled-bg:         var(--color-gray-light);
}
```

Configuração Tailwind espelhando os tokens:

```js
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        beacon: {
          primary:       '#f06529',
          'primary-hover': '#e34c26',
          gray:          '#ebebeb',
          white:         '#ffffff',
          black:         '#000000',
        }
      }
    }
  }
}
```

### 2.2 Layout — `/Brand/Playbook de Layout e UX - Plataforma Beacon.md`

**Estrutura de página (UX Playbook §3):**

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Logo (esq) | UserInfo (dir)                    │
├────────────┬────────────────────────────────────────────┤
│  SIDEBAR   │  MAIN CONTENT AREA                         │
│  (dark)    │  Title                                     │
│            │  Subtitle                                  │
│  Tenant    │  ┌──────┐ ┌──────┐ ┌──────┐              │
│  Selector  │  │ Card │ │ Card │ │ Card │              │
│            │  └──────┘ └──────┘ └──────┘              │
│  [Agents]  │                                            │
│  [Observ]  │                                [FAB ●]    │
│  [Config]  │                                            │
│  [Docs]    │                                            │
└────────────┴────────────────────────────────────────────┘
```

**Nota:** O UX Playbook especifica "Dark Mode" para a sidebar/navegação enquanto a paleta de cores principal usa fundos brancos para a área de conteúdo. A implementação segue essa separação: sidebar escura (#000000), conteúdo claro (#ffffff).

### 2.3 Componentes Base — Regras do Brand

Cada componente abaixo deriva diretamente das especificações dos dois Playbooks:

#### `<Button>` (UX Playbook §4.1)
```
variant="primary"   → bg:#f06529, hover:bg:#e34c26, text:#ffffff
variant="secondary" → bg:#ebebeb, hover:bg:#d4d4d4, text:#000000
variant="ghost"     → bg:transparent, hover:bg:#ebebeb
state="disabled"    → bg:#ebebeb, text:#999, cursor:not-allowed
```
- Focus ring: `outline:2px solid #e34c26` (acessibilidade WCAG)

#### `<Input>` / `<Select>` (UX Playbook §4.2)
```
border: 1px solid #ebebeb
focus-border: 2px solid #e34c26
label: acima do campo, color:#000000
erro: borda vermelha + mensagem abaixo
```

#### `<Card>` (UX Playbook §3.3)
```
bg: #ffffff
border: 1px solid #ebebeb
border-radius: 8px
padding: 16px
shadow: 0 1px 3px rgba(0,0,0,0.1)
hover: shadow elevado
```

#### `<AgentCard>` (UX Playbook §3.3 — Cards de Agentes)
```
Estrutura:
  ┌─────────────────────────────────┐
  │ [Avatar]  Nome do Agente   [⋮] │  ← ações no canto superior dir
  │           Descrição breve       │
  │  Status ● | Modelo | Data       │
  └─────────────────────────────────┘
Ações contextuais: editar | pausar | excluir (ícones Lucide)
```

#### `<MetricCard>` (UX Playbook §3.3 — Cards de Métricas)
```
Header: título da métrica + ícone
Valor principal: fonte grande, bold, cor:#000000
Gráfico inline: Recharts, cor primária:#f06529
Trend indicator: ▲ verde / ▼ vermelho
```

#### `<Sidebar>` (UX Playbook §3.2)
```
bg: #000000
text: #ffffff
item-ativo: bg:#f06529, text:#ffffff
item-hover: bg:rgba(255,255,255,0.1)
badge: bg:#e34c26, text:#ffffff, border-radius:full
```

#### `<FAB>` (UX Playbook §3.3)
```
position: fixed, bottom:24px, right:24px
bg: #f06529
hover: bg:#e34c26
icon: #ffffff
size: 56px, border-radius:50%
shadow: 0 4px 12px rgba(240,101,41,0.4)
```

#### `<Toast>` / `<Notification>` (UX Playbook §4.4)
```
success: borda esq verde, ícone check
error:   borda esq vermelha, ícone x
info:    borda esq #f06529, ícone info
duração: 4s auto-dismiss
```

### 2.4 Tipografia (UX Playbook §4.3)

```css
/* Fonte escolhida: Inter (moderna, otimizada para telas digitais) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body { font-family: 'Inter', sans-serif; color: #000000; }

h1   { font-size: 2rem;    font-weight: 700; }
h2   { font-size: 1.5rem;  font-weight: 600; }
h3   { font-size: 1.25rem; font-weight: 600; }
body { font-size: 1rem;    font-weight: 400; }
sm   { font-size: 0.875rem; }
```

### 2.5 Estrutura de Pastas — Frontend

```
/apps/frontend/src/
├── styles/
│   └── tokens.css          ← Design tokens do /Brand
├── components/
│   ├── ui/                 ← Primitivos: Button, Input, Card, Badge, Toast
│   ├── layout/             ← Header, Sidebar, MainLayout, FAB
│   └── charts/             ← Recharts wrappers com cores Beacon
├── features/
│   ├── agents/             ← CRUD de agentes
│   │   ├── AgentList.tsx
│   │   ├── AgentCard.tsx
│   │   ├── AgentBuilder.tsx
│   │   └── AgentDetail.tsx
│   ├── observability/      ← Dashboard de métricas
│   │   ├── ObservabilityDashboard.tsx
│   │   ├── PerformancePanel.tsx
│   │   ├── FinancialPanel.tsx
│   │   ├── QualityPanel.tsx
│   │   └── EngagementPanel.tsx
│   ├── playground/         ← Área de teste de agentes
│   │   └── Playground.tsx
│   ├── broadcast/          ← Gestão de transmissões
│   │   └── BroadcastManager.tsx
│   └── auth/               ← Login, tenant selector
│       └── Login.tsx
├── services/
│   ├── api.ts              ← Axios instance com interceptors de auth
│   ├── agents.ts
│   ├── metrics.ts
│   └── auth.ts
├── store/
│   └── useAuthStore.ts     ← Zustand: user, tenant, token
└── App.tsx
```

---

## 3. Arquitetura Backend — Clean Architecture

```
/apps/backend/src/
├── core/                           ← Domain Layer
│   ├── entities/
│   │   ├── Agent.ts
│   │   ├── Conversation.ts
│   │   ├── Metric.ts
│   │   └── Tenant.ts
│   └── repositories/               ← Interfaces (abstrações)
│       ├── IAgentRepository.ts
│       └── IMetricRepository.ts
├── application/                    ← Use Cases
│   ├── agents/
│   │   ├── CreateAgentUseCase.ts
│   │   ├── UpdateAgentUseCase.ts
│   │   └── DeleteAgentUseCase.ts
│   ├── metrics/
│   │   └── GetObservabilityUseCase.ts
│   └── broadcast/
│       └── SendBroadcastUseCase.ts
├── infrastructure/                 ← Implementações concretas
│   ├── database/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── repositories/           ← Implementa interfaces do core
│   ├── langgraph/                  ← Client HTTP para o microservice Python
│   ├── redis/
│   │   └── BullMQService.ts
│   ├── vector-db/
│   │   └── QdrantService.ts
│   └── telemetry/
│       └── OpenTelemetryService.ts
├── presentation/                   ← Controllers REST
│   ├── agents/
│   ├── metrics/
│   ├── broadcast/
│   └── auth/
├── features/                       ← NestJS Modules
│   ├── agents/agents.module.ts
│   ├── telemetry/telemetry.module.ts
│   └── broadcast/broadcast.module.ts
└── shared/
    ├── decorators/tenant.decorator.ts
    ├── guards/jwt.guard.ts
    └── middleware/tenant.middleware.ts
```

---

## 4. Schema do Banco de Dados (Multi-Tenant)

```prisma
// Toda tabela tem tenant_id — Pool Isolation (PRD)

model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  plan      String
  createdAt DateTime @default(now())
  agents    Agent[]
  users     User[]
}

model User {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  email     String   @unique
  role      Role     @default(VIEWER)
  createdAt DateTime @default(now())
}

model Agent {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  name        String
  description String?
  model       String   // ex: "gpt-4o", "claude-sonnet-4-6"
  status      AgentStatus @default(ACTIVE)
  systemPrompt String?
  tools       Json?    // array de ferramentas registradas
  createdAt   DateTime @default(now())
  metrics     Metric[]
  conversations Conversation[]
}

model Conversation {
  id        String   @id @default(uuid())
  tenantId  String
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  startedAt DateTime @default(now())
  endedAt   DateTime?
  turns     Int      @default(0)
  messages  Message[]
  metric    Metric?
}

model Metric {
  id              String   @id @default(uuid())
  tenantId        String
  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id])
  conversationId  String?  @unique
  // Performance
  latencyMs       Int?
  ttftMs          Int?     // Time To First Token
  successRate     Float?
  fallbackRate    Float?
  // Financial
  inputTokens     Int?
  outputTokens    Int?
  costUsd         Float?
  // Quality
  sentimentScore  Float?
  hallucinationScore Float?
  userRating      Int?     // 1-5
  relevanceScore  Float?
  // Engagement
  turnsCount      Int?
  recordedAt      DateTime @default(now())
}

enum AgentStatus { ACTIVE PAUSED DRAFT DELETED }
enum Role { ADMIN EDITOR VIEWER }
```

---

## 5. API Contracts

### Autenticação
```
POST /auth/login           → { accessToken, refreshToken, tenant }
POST /auth/refresh         → { accessToken }
POST /auth/logout
GET  /auth/me              → User + Tenant
```

### Agentes
```
GET    /agents             → AgentCard[] (filtrado por tenantId via JWT)
POST   /agents             → Criar agente
GET    /agents/:id         → Detalhe do agente
PATCH  /agents/:id         → Atualizar
DELETE /agents/:id         → Soft delete
POST   /agents/:id/test    → Enviar msg ao Playground (proxy LangGraph)
PATCH  /agents/:id/status  → ACTIVE | PAUSED
```

### Observabilidade
```
GET /metrics/summary       → { performance, financial, quality, engagement }
GET /metrics/agent/:id     → Métricas por agente (time range query params)
GET /metrics/timeseries    → Dados para gráficos (granularidade: hour/day/week)
```

### Broadcast
```
POST /broadcast            → Criar campanha
GET  /broadcast            → Listar campanhas
GET  /broadcast/:id/status → Status da campanha (jobs BullMQ)
```

---

## 6. Features — Especificação Detalhada

### 6.1 Gestão de Agentes
- **Lista**: Grid de AgentCards com busca + filtro por status/modelo
- **Criação**: Formulário wizard (nome → modelo → system prompt → ferramentas → publicar)
- **Edição**: Mesmas seções do wizard em modo edit
- **Status toggle**: ACTIVE ↔ PAUSED com confirmação modal
- **Exclusão**: Soft delete com diálogo de confirmação

### 6.2 Observability Dashboard
Painéis independentes com cards de métricas + gráficos Recharts:

| Painel | Métricas | Tipo de gráfico |
|---|---|---|
| Performance | Latência TTFT, Success Rate, Fallback Rate, Throughput | Line chart + gauge |
| Financeiro | Tokens input/output, Custo/conversa, ROI por modelo | Bar chart + table |
| Qualidade | Sentiment, Hallucination Score, Rating médio, Relevância | Radar chart + stars |
| Engajamento | Conversas/dia, Retenção, Turns médio | Area chart + KPI cards |

- Filtros globais: tenant, agente, período (7d / 30d / 90d / custom)
- Export CSV nos painéis financeiros

### 6.3 Playground
- Chat interface para testar agente selecionado em tempo real
- Seletor de agente no topo
- Histórico de mensagens por sessão (não persistido no DB de produção)
- Indicador de tokens consumidos por mensagem
- Painel lateral com metadados: latência, modelo, tools ativadas

### 6.4 Broadcast
- Formulário: selecionar agente, audiência (lista de contatos), mensagem template
- Preview do disparo antes de confirmar
- Status em tempo real via polling do endpoint BullMQ
- Histórico de campanhas por tenant

### 6.5 Auth & Multi-Tenant
- Login com email/senha
- JWT com `tenantId` no payload
- Middleware que injeta `tenantId` em todas as queries do Prisma
- Tenant Selector na Sidebar para usuários com acesso a múltiplos tenants
- Roles: ADMIN (tudo), EDITOR (criar/editar agentes), VIEWER (somente leitura)

---

## 7. Plano de Execução — Sprints

### Sprint 1 — Fundação (2 semanas)
**Backend:**
- [ ] Monorepo setup (apps/backend, apps/frontend, infra/)
- [ ] docker-compose: Postgres + Redis + Qdrant
- [ ] Prisma schema + migrations iniciais
- [ ] NestJS bootstrap com modulo Auth (JWT)
- [ ] Middleware multi-tenant
- [ ] OpenTelemetry SDK configurado
- [ ] GitHub Actions CI básico (lint + test)

**Frontend:**
- [ ] Vite + React + TypeScript setup
- [ ] `tokens.css` com todas as CSS Variables do `/Brand`
- [ ] Tailwind configurado com cores Beacon (`tailwind.config.ts`)
- [ ] Layout base: `<MainLayout>`, `<Sidebar>`, `<Header>`
- [ ] Componentes ui/: `<Button>`, `<Input>`, `<Card>`, `<Badge>`
- [ ] Roteamento: React Router com rotas protegidas
- [ ] `<Login>` page + Zustand auth store

**Entregável:** Infraestrutura rodando, login funcionando, layout com Brand aplicado.

---

### Sprint 2 — Módulo de Agentes (3 semanas)
**Backend:**
- [ ] `AgentModule`: CRUD completo com multi-tenant isolation
- [ ] Integração LangGraph (microservice Python): endpoint `/agents/:id/test`
- [ ] Tool registry (config de ferramentas por agente)
- [ ] Testes unitários dos use cases de agente

**Frontend:**
- [ ] `<AgentList>`: grid de `<AgentCard>` com filtros
- [ ] `<AgentCard>` conforme UX Playbook §3.3 (ações contextuais, status, modelo)
- [ ] `<AgentBuilder>`: wizard multi-step com React Hook Form + Zod
- [ ] `<AgentDetail>`: visão detalhada + tab de configuração
- [ ] `<FAB>` "Criar Novo Agente" conforme Brand (cor #f06529, posição fixed)
- [ ] Status toggle com modal de confirmação

**Entregável:** Gestão completa de agentes funcionando.

---

### Sprint 3 — Pipeline de Telemetria (3 semanas)
**Backend:**
- [ ] `MetricModule`: captura de métricas via OpenTelemetry (LLM calls instrumentadas)
- [ ] Worker BullMQ para processamento assíncrono de métricas
- [ ] Aggregation service: cálculo de KPIs (média, percentis, taxas)
- [ ] Endpoints de observabilidade com filtros de time range
- [ ] Testes de integração do pipeline

**Frontend:**
- [ ] `<ObservabilityDashboard>`: layout de painéis (Performance, Financial, Quality, Engagement)
- [ ] `<MetricCard>` conforme UX Playbook §3.3 (gráficos com cor #f06529)
- [ ] Recharts configurado com paleta Beacon
- [ ] Filtros globais de período e agente com TanStack Query
- [ ] Skeleton loaders (feedback visual conforme UX Playbook §4.4)

**Entregável:** Dashboard de observabilidade com dados reais.

---

### Sprint 4 — Playground + UX Polish (2 semanas)
**Backend:**
- [ ] `PlaygroundModule`: sessões de teste não persistidas, proxy para LangGraph
- [ ] Cálculo de tokens consumidos por mensagem (retornado na response)

**Frontend:**
- [ ] `<Playground>`: chat UI com seletor de agente, histórico de sessão
- [ ] Painel lateral de metadados por mensagem (latência, tokens, tools)
- [ ] `<Toast>` / `<Notification>` system (sucesso, erro, info — conforme Brand)
- [ ] Validação em tempo real em todos os formulários (UX Playbook §4.2)
- [ ] Responsividade mobile-first
- [ ] Testes de componentes com Vitest + Testing Library

**Entregável:** Playground funcional, UX polida e acessível.

---

### Sprint 5 — Broadcast + QA Final (2 semanas)
**Backend:**
- [ ] `BroadcastModule`: criação de campanhas + jobs BullMQ
- [ ] Status tracking de campanhas em tempo real
- [ ] Rate limiting e retry logic nos jobs

**Frontend:**
- [ ] `<BroadcastManager>`: formulário de campanha + preview + status tracker
- [ ] Histórico de campanhas por tenant
- [ ] Testes E2E (Playwright): fluxo de criar agente → testar no playground → ver métricas
- [ ] Auditoria de acessibilidade (WCAG 2.1 AA — TODOS os componentes)
- [ ] Export CSV no dashboard financeiro

**Entregável:** Plataforma completa, testada e acessível.

---

## 8. Regras de Brand para Desenvolvedores Frontend

> Extraídas de `/Brand`. Todo PR de frontend deve verificar compliance com estas regras.

### Checklist de Brand (por componente)
- [ ] Botões primários usam `bg-beacon-primary` (`#f06529`), não outras cores
- [ ] Hover de interativos usa `#e34c26` (nunca escurecer com opacity)
- [ ] Fundos de cards são `#ffffff`, seções secundárias são `#ebebeb`
- [ ] Texto principal é `#000000`, texto em fundos escuros é `#ffffff`
- [ ] Focus rings usam `#e34c26` com 2px outline (WCAG compliance)
- [ ] Elementos desabilitados usam `#ebebeb` como background
- [ ] Gráficos do dashboard usam `#f06529` como cor primária das séries
- [ ] FAB sempre posicionado `fixed bottom-6 right-6` com cor `#f06529`
- [ ] Sidebar usa fundo `#000000` com texto `#ffffff`

### O que NÃO fazer (anti-patterns)
- ❌ Criar novas cores fora da paleta Brand
- ❌ Usar `opacity` para criar variações de cor
- ❌ Colocar texto preto em fundo escuro (contraste insuficiente)
- ❌ Usar vermelho/verde para estados sem fallback de ícone (acessibilidade)
- ❌ Botão primário com qualquer cor diferente de `#f06529`

---

## 9. Verificação — Como testar o projeto end-to-end

```bash
# 1. Subir infraestrutura
docker-compose up -d

# 2. Rodar migrations
cd apps/backend && npx prisma migrate dev

# 3. Subir backend (dev)
npm run dev

# 4. Subir frontend (dev)
cd apps/frontend && npm run dev

# 5. Acessar http://localhost:5173
# → Login com tenant demo
# → Criar agente no AgentBuilder
# → Testar no Playground
# → Verificar métricas no ObservabilityDashboard

# 6. Rodar testes
npm run test          # unit (Jest/Vitest)
npm run test:e2e      # Playwright

# 7. Verificar Brand compliance
# → Abrir Storybook: npm run storybook
# → Checar cada componente contra o checklist de Brand acima
```

---

## Arquivos Críticos a Criar

| Arquivo | Responsável | Prioridade |
|---|---|---|
| `apps/frontend/src/styles/tokens.css` | Frontend | Sprint 1 — Dia 1 |
| `tailwind.config.ts` | Frontend | Sprint 1 — Dia 1 |
| `apps/frontend/src/components/ui/Button.tsx` | Frontend | Sprint 1 |
| `apps/frontend/src/components/layout/MainLayout.tsx` | Frontend | Sprint 1 |
| `apps/backend/src/infrastructure/database/prisma/schema.prisma` | Backend | Sprint 1 |
| `apps/backend/src/shared/middleware/tenant.middleware.ts` | Backend | Sprint 1 |
| `docker-compose.yml` | DevOps | Sprint 1 — Dia 1 |
| `Brand/Brand Playbook - Guia de Uso de Cores da Plataforma Beacon.md` | Referência | Já existe |
| `Brand/Playbook de Layout e UX - Plataforma Beacon.md` | Referência | Já existe |
