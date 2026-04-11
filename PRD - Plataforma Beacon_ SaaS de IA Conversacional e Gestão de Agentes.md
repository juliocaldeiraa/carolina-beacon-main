# PRD - Plataforma Beacon: SaaS de IA Conversacional e Gestão de Agentes

## 1. Objetivo
O Beacon é um ecossistema SaaS interno projetado para democratizar a criação, teste e monitoramento de agentes de IA conversacional. O diferencial competitivo reside na **Observabilidade Profunda** e na **Gestão Centralizada**, permitindo que a empresa entenda exatamente o ROI, a performance e o comportamento de cada agente implantado para clientes específicos.

## 2. Arquitetura Técnica Proposta

### 2.1. Princípios de Arquitetura e Boas Práticas
O desenvolvimento do Beacon será guiado pelos seguintes princípios para garantir escalabilidade, manutenibilidade e robustez:

*   **Clean Architecture / Arquitetura Limpa**: Foco na separação de preocupações (Separation of Concerns), garantindo que a lógica de negócio seja independente de frameworks, UI e bancos de dados. Isso será alcançado através de camadas bem definidas (Domínio, Aplicação, Infraestrutura, Apresentação) e a regra de dependência, onde as dependências fluem para dentro.
*   **Estrutura Baseada em Features (Feature-based Structure)**: A organização do código será primariamente por funcionalidade (feature) em vez de por tipo de arquivo (layers). Isso significa que todos os componentes relacionados a uma funcionalidade específica (ex: `Agentes`, `Dashboard`, `Playground`) estarão agrupados, facilitando o desenvolvimento, teste e manutenção.
*   **DRY (Don't Repeat Yourself)**: Promover a reutilização de código através de componentes, utilitários e serviços compartilhados. Evitar duplicação de lógica de negócio ou de apresentação para reduzir a superfície de bugs e simplificar futuras alterações.
*   **Modularidade**: Cada funcionalidade ou módulo deve ser o mais independente possível, com interfaces bem definidas, para permitir o desenvolvimento paralelo e a substituição de componentes sem afetar o sistema como um todo.

### 2.2. Modelo Multi-Tenant (Isolamento de Dados)
Para garantir a segurança entre clientes internos/externos, utilizaremos o padrão **Pool Isolation** no banco de dados com `tenant_id` em todas as tabelas e **Silo Isolation** para o armazenamento de vetores (Vector DB), garantindo que o conhecimento de um agente nunca vaze para outro.

### 2.3. Core de Orquestração
*   **Engine**: LangGraph (extensão do LangChain) para fluxos cíclicos e estados complexos.
*   **Memória**: Redis para armazenamento de sessões de curto prazo e Postgres (via pgvector) para memória de longo prazo (RAG).

## 3. Estrutura de Arquivos e Módulos Sugerida

A estrutura de pastas reflete uma abordagem híbrida, com uma divisão inicial por `apps` (backend/frontend) e, dentro delas, uma organização por features, aplicando os princípios de Clean Architecture e DRY.

```text
/beacon-platform
├── /apps
│   ├── /backend
│   │   ├── /src
│   │   │   ├── /core              # Camada de Domínio: Entidades, Value Objects, Repositórios (interfaces)
│   │   │   ├── /application       # Camada de Aplicação: Casos de Uso, Serviços de Aplicação
│   │   │   ├── /infrastructure    # Camada de Infraestrutura: Implementações de Repositórios, Adapters (DB, APIs externas)
│   │   │   ├── /presentation      # Camada de Apresentação: Controladores/Handlers de API
│   │   │   ├── /features          # Agrupamento por funcionalidades (ex: agents, telemetry, broadcast)
│   │   │   │   ├── /agents
│   │   │   │   │   ├── domain.py
│   │   │   │   │   ├── application.py
│   │   │   │   │   ├── infrastructure.py
│   │   │   │   │   └── presentation.py
│   │   │   │   ├── /telemetry
│   │   │   │   │   ├── domain.py
│   │   │   │   │   ├── application.py
│   │   │   │   │   ├── infrastructure.py
│   │   │   │   │   └── presentation.py
│   │   │   │   └── /broadcast
│   │   │   │       ├── domain.py
│   │   │   │       ├── application.py
│   │   │   │       ├── infrastructure.py
│   │   │   │       └── presentation.py
│   │   │   └── /shared            # Módulos reutilizáveis (utils, helpers, DTOs, exceções)
│   │   └── /tests
│   └── /frontend
│       ├── /src
│       │   ├── /components        # Componentes de UI reutilizáveis (DRY)
│       │   ├── /features          # Agrupamento por funcionalidades (ex: playground, dashboard, builder)
│       │   │   ├── /playground
│       │   │   │   ├── components
│   │   │   │   │   └── pages
│   │   │   │   ├── /dashboard
│   │   │   │   │   ├── components
│   │   │   │   │   └── pages
│   │   │   │   └── /builder
│   │   │   │       ├── components
│   │   │   │       └── pages
│   │   │   └── /services          # Serviços de API, utilitários de frontend
│   │   └── /tests
└── /infra
    ├── docker-compose.yml   # Postgres, Redis, Qdrant/Pinecone
    └── /migrations          # Esquemas de banco multi-tenant
```

## 4. A "Cereja do Bolo": Dashboard e Métricas

O dashboard não será apenas um log de conversas, mas uma ferramenta de BI para IA, fornecendo insights acionáveis para otimização de agentes e custos.

| Categoria | Métricas Chave | Objetivo Técnico |
| :--- | :--- | :--- |
| **Performance** | Latency (TTFT), Success Rate, Fallback Rate, Throughput | Garantir a fluidez e precisão da resposta do agente em tempo real. |
| **Financeiro** | Token Usage (Input/Output), Cost per Conversation, Model ROI, Custo por Tenant | Monitorar e otimizar gastos com APIs de LLMs (OpenAI, Anthropic, Gemini) e infraestrutura. |
| **Qualidade** | Sentiment Analysis, Hallucination Score, User Rating, Relevância da Resposta | Avaliar a eficácia e a lapidação do agente via feedback loop contínuo e métricas de qualidade. |
| **Engajamento** | Conversations/Day, Retention Rate, Avg Turns per Conversation, Feature Usage | Entender o valor real para o usuário final e identificar oportunidades de melhoria e novas funcionalidades. |

## 5. Documentação Técnica Essencial (Referências)

*   **LangGraph State Management**: Essencial para criar agentes que "pensam" antes de responder, permitindo fluxos de trabalho complexos e cíclicos.
    *   *Link*: [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
*   **OpenTelemetry for LLMs**: Padrão para instrumentação e exportação de traces, métricas e logs de execução de LLMs, fundamental para o dashboard.
    *   *Link*: [OpenLIT](https://github.com/openlit/openlit)
*   **Multi-tenant RAG Patterns**: Estrutura de busca semântica isolada por tenant, garantindo que o RAG (Retrieval Augmented Generation) seja seguro e específico para cada cliente.
    *   *Link*: [Pinecone Multi-tenancy](https://docs.pinecone.io/guides/projects/understanding-multitenancy)
*   **Clean Architecture**: Princípios para organizar o código em camadas, promovendo a independência e testabilidade.
    *   *Link*: [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

## 6. Padrões de Código (Snippets de Referência)

### 6.1. Captura de Telemetria (A Cereja do Bolo)
Este middleware deve envolver cada chamada de LLM para alimentar o Dashboard em tempo real, seguindo o princípio DRY e Separation of Concerns.

```python
# apps/backend/src/infrastructure/telemetry/llm_observability.py
import time
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

# Configuração básica do OpenTelemetry (exemplo)
resource = Resource.create({"service.name": "beacon-agent-service"})
provider = TracerProvider(resource=resource)
processor = SimpleSpanProcessor(ConsoleSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer(__name__)

async def instrumented_llm_call(agent_id: str, tenant_id: str, prompt: str, llm_model_invoke_func):
    with tracer.start_as_current_span("llm_agent_invoke") as span:
        span.set_attribute("agent.id", agent_id)
        span.set_attribute("tenant.id", tenant_id)
        span.set_attribute("llm.prompt", prompt)
        
        start_time = time.perf_counter()
        try:
            response = await llm_model_invoke_func(prompt) # Função real de chamada do LLM
            end_time = time.perf_counter()
            
            span.set_attribute("llm.response", response.text)
            span.set_attribute("llm.tokens.input", response.usage.input_tokens)
            span.set_attribute("llm.tokens.output", response.usage.output_tokens)
            span.set_attribute("llm.latency", end_time - start_time)
            span.set_attribute("status.code", "OK")
            
            # Enviar métricas para o sistema de monitoramento (ex: Prometheus, Grafana)
            # metrics_collector.record_latency(agent_id, tenant_id, end_time - start_time)
            # metrics_collector.record_token_usage(agent_id, tenant_id, response.usage.total_tokens)
            
            return response
        except Exception as e:
            span.set_attribute("status.code", "ERROR")
            span.set_attribute("error.message", str(e))
            # metrics_collector.record_error(agent_id, tenant_id, str(e))
            raise
```

### 6.2. Estrutura de Disparo (Broadcast) - Reutilização e Modularidade
O módulo de broadcast será um serviço independente, seguindo o princípio de Separation of Concerns, e será reutilizável por diferentes features que necessitem de comunicação assíncrona em massa.

```javascript
// apps/backend/src/features/broadcast/application/broadcast_service.js
const { Queue } = require('bullmq');
const { logger } = require('../../../shared/utils/logger');

class BroadcastService {
  constructor(connection) {
    this.broadcastQueue = new Queue('broadcast-messages', { connection });
  }

  async scheduleBroadcast(agentId, targetUsers, messageTemplate) {
    logger.info(`Scheduling broadcast for agent ${agentId} to ${targetUsers.length} users.`);
    await this.broadcastQueue.add('send-messages', {
      agentId,
      targetUsers,
      messageTemplate,
    });
    return { success: true, message: 'Broadcast scheduled.' };
  }
}

module.exports = BroadcastService;

// apps/backend/src/features/broadcast/infrastructure/broadcast_worker.js
const { Worker } = require('bullmq');
const { aiEngine } = require('../../../infrastructure/integrations/ai_engine'); // Exemplo de dependência injetada
const { updateBroadcastProgress } = require('../../../features/telemetry/application/telemetry_service');
const { logger } = require('../../../shared/utils/logger');

const broadcastWorker = new Worker('broadcast-messages', async job => {
  const { agentId, targetUsers, messageTemplate } = job.data;
  logger.info(`Processing broadcast job ${job.id} for agent ${agentId}.`);

  for (const user of targetUsers) {
    const personalizedMsg = fillTemplate(messageTemplate, user); // Função utilitária (DRY)
    await aiEngine.sendMessage(agentId, user.id, personalizedMsg);
    await updateBroadcastProgress(job.id, 1); // Atualiza métricas (Separation of Concerns)
  }
  logger.info(`Broadcast job ${job.id} completed.`);
}, { connection: /* Redis connection */ });

broadcastWorker.on('failed', (job, err) => {
  logger.error(`Broadcast job ${job.id} failed: ${err.message}`);
});
```

### 6.3. Definição de Ferramentas Customizadas (Extensibilidade e DRY)
As ferramentas serão definidas de forma modular e injetadas nos agentes, permitindo a reutilização e fácil extensão.

```python
# apps/backend/src/features/agents/domain/tools.py
from langchain.tools import tool
from ...shared.exceptions import ExternalServiceError

@tool
def get_customer_data(customer_id: str) -> dict:
    """Consulta o CRM interno para obter dados detalhados do cliente. Retorna um dicionário com as informações do cliente ou levanta um erro se o cliente não for encontrado.
    Args:
        customer_id (str): O ID único do cliente a ser consultado.
    """
    try:
        # Lógica de integração com API externa configurada no Beacon (infraestrutura)
        # Exemplo: crm_service = get_crm_service_for_tenant(current_tenant_id)
        # return crm_service.fetch(customer_id)
        if customer_id == "123":
            return {"id": "123", "name": "João Silva", "email": "joao@example.com"}
        else:
            raise ValueError("Cliente não encontrado")
    except Exception as e:
        raise ExternalServiceError(f"Erro ao buscar dados do cliente: {e}")

# Outras ferramentas podem ser definidas aqui e registradas centralmente.

# apps/backend/src/features/agents/application/agent_builder.py
from ...shared.utils.tool_registry import register_tool
from ..domain.tools import get_customer_data

# Registro centralizado das ferramentas disponíveis
register_tool(get_customer_data)

class AgentBuilder:
    def build_agent(self, agent_config: dict):
        # Lógica para construir o agente, injetando as ferramentas registradas
        available_tools = [register_tool.get_tool(tool_name) for tool_name in agent_config.get("tools", [])]
        # ... construir e retornar o agente LangGraph com as ferramentas ...
        pass
```

## 7. Próximos Passos de Implementação

O roteiro de implementação será dividido em Sprints, com foco em entregas incrementais e validação contínua:

1.  **Sprint 1 (2 semanas)**: Setup da infraestrutura base (banco multi-tenant, Redis, Vector DB) e esqueleto da API com as camadas de Clean Architecture. Definição de entidades de domínio iniciais.
2.  **Sprint 2 (3 semanas)**: Desenvolvimento do módulo de Agentes (definição de prompts, ferramentas, orquestração com LangGraph) e a API para gerenciamento de agentes. Implementação do `AgentBuilder`.
3.  **Sprint 3 (3 semanas)**: Implementação completa do Pipeline de Métricas e Telemetria (instrumentação de LLMs, envio para ElasticSearch/ClickHouse, processamento de dados). Desenvolvimento dos serviços de `Telemetry`.
4.  **Sprint 4 (2 semanas)**: Desenvolvimento do Frontend do Dashboard (visualização de métricas) e da Área de Testes (Playground) para lapidação de agentes. Foco na experiência do usuário e feedback rápido.
5.  **Sprint 5 (2 semanas)**: Implementação do módulo de Broadcast (disparos em massa) e integração com o sistema de agentes. Refinamento de UI/UX e testes de integração de ponta a ponta.

Este plano é iterativo e será ajustado conforme o feedback e os desafios técnicos encontrados.

## 8. Plano de Projeto Detalhado

Este plano de projeto detalha as fases de implementação, estimativas de tempo e recursos necessários para cada sprint, com base nos princípios de arquitetura e boas práticas definidos. As estimativas são baseadas em uma equipe de desenvolvimento ágil.

### 8.1. Equipe de Desenvolvimento (Estimativa)
*   **Desenvolvedores Backend**: 2-3 (Python/Node.js)
*   **Desenvolvedores Frontend**: 1-2 (React/TypeScript)
*   **Engenheiro de DevOps/Infraestrutura**: 1 (parcial)
*   **Arquiteto de Soluções**: 1 (parcial)

### 8.2. Detalhamento das Sprints

#### Sprint 1: Setup da Infraestrutura Base e Esqueleto da API
*   **Duração**: 2 semanas
*   **Objetivos**: Estabelecer a base tecnológica e arquitetural do projeto, garantindo um ambiente de desenvolvimento funcional e escalável.
*   **Tarefas Chave**:
    *   Configuração inicial do repositório e CI/CD.
    *   Implementação do esquema de banco de dados multi-tenant (Postgres).
    *   Configuração do Redis para cache e gerenciamento de sessões.
    *   Integração com Vector DB (Qdrant/Pinecone) para RAG.
    *   Criação do esqueleto da API Backend com as camadas de Clean Architecture.
    *   Definição das entidades de domínio iniciais (e.g., `Tenant`, `User`, `AgentDefinition`).
*   **Recursos Necessários**:
    *   2 Desenvolvedores Backend.
    *   1 Engenheiro de DevOps (50% do tempo).

#### Sprint 2: Módulo de Agentes e Orquestração
*   **Duração**: 3 semanas
*   **Objetivos**: Desenvolver o core da plataforma, permitindo a criação e orquestração de agentes de IA personalizados.
*   **Tarefas Chave**:
    *   Implementação do `AgentBuilder` para configuração de agentes (prompts, modelos, ferramentas).
    *   Integração com LangGraph para orquestração de fluxos de agentes.
    *   Desenvolvimento de APIs para gerenciamento de agentes (CRUD).
    *   Criação de ferramentas base (e.g., `get_customer_data`) e mecanismo de registro.
    *   Testes unitários e de integração para o módulo de agentes.
*   **Recursos Necessários**:
    *   3 Desenvolvedores Backend.
    *   1 Arquiteto de Soluções (25% do tempo).

#### Sprint 3: Pipeline de Métricas e Telemetria
*   **Duração**: 3 semanas
*   **Objetivos**: Estabelecer um sistema robusto de coleta e processamento de métricas para o dashboard, a "cereja do bolo".
*   **Tarefas Chave**:
    *   Instrumentação de todas as chamadas de LLM com OpenTelemetry.
    *   Configuração de um sistema de armazenamento de logs e métricas (ElasticSearch/ClickHouse).
    *   Desenvolvimento de serviços de `Telemetry` para processar e agregar dados.
    *   Criação de APIs para consulta de métricas agregadas por agente e tenant.
    *   Implementação de métricas de custo (token usage, custo por chamada).
*   **Recursos Necessários**:
    *   2 Desenvolvedores Backend.
    *   1 Engenheiro de DevOps (50% do tempo).

#### Sprint 4: Frontend do Dashboard e Área de Testes (Playground)
*   **Duração**: 2 semanas
*   **Objetivos**: Fornecer interfaces de usuário para monitoramento e lapidação de agentes.
*   **Tarefas Chave**:
    *   Desenvolvimento do Frontend do Dashboard, exibindo as métricas chave (Performance, Financeiro, Qualidade, Engajamento).
    *   Criação da Área de Testes (Playground) para interação em tempo real com agentes e depuração de prompts.
    *   Implementação de componentes de UI reutilizáveis para gráficos e tabelas de métricas.
    *   Integração do Frontend com as APIs de Agentes e Telemetria.
*   **Recursos Necessários**:
    *   2 Desenvolvedores Frontend.
    *   1 Desenvolvedor Backend (25% do tempo para suporte à API).

#### Sprint 5: Módulo de Broadcast e Refinamentos Finais
*   **Duração**: 2 semanas
*   **Objetivos**: Concluir as funcionalidades principais e realizar refinamentos para a primeira versão do produto.
*   **Tarefas Chave**:
    *   Implementação completa do módulo de Broadcast (serviço, worker, APIs).
    *   Integração do Broadcast com o sistema de agentes para disparos personalizados.
    *   Refinamento de UI/UX em todas as interfaces.
    *   Testes de integração de ponta a ponta e testes de carga.
    *   Preparação para deploy e documentação de uso.
*   **Recursos Necessários**:
    *   1 Desenvolvedor Backend.
    *   1 Desenvolvedor Frontend.
    *   1 Engenheiro de DevOps (25% do tempo).

### 8.3. Cronograma Resumido

| Sprint | Duração | Início (Estimado) | Fim (Estimado) |
| :--- | :--- | :--- | :--- |
| Sprint 1 | 2 semanas | Semana 1 | Semana 2 |
| Sprint 2 | 3 semanas | Semana 3 | Semana 5 |
| Sprint 3 | 3 semanas | Semana 6 | Semana 8 |
| Sprint 4 | 2 semanas | Semana 9 | Semana 10 |
| Sprint 5 | 2 semanas | Semana 11 | Semana 12 |

**Total Estimado**: 12 semanas (aproximadamente 3 meses) para a primeira versão do MVP (Minimum Viable Product).

### 8.4. Considerações Adicionais
*   **Ferramentas de Gerenciamento de Projeto**: Jira, Trello ou similar para acompanhamento das tarefas e sprints.
*   **Controle de Versão**: Git com GitHub/GitLab para colaboração e revisão de código.
*   **Monitoramento e Alertas**: Configuração de Grafana/Prometheus para monitoramento contínuo da infraestrutura e dos agentes.
*   **Testes**: Priorização de testes unitários, de integração e end-to-end para garantir a qualidade do software.

Este plano é um guia e pode ser ajustado com base em novas descobertas, feedback e prioridades do negócio. A flexibilidade e a comunicação contínua serão chaves para o sucesso do projeto Beacon.
