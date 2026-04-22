# Carolina Beacon — Contexto para Claude

## Contexto do Projeto

Este projeto tem uma **base de conhecimento persistente** no vault Obsidian `beacon-carolina-context`, localizado em:
`~/Library/Mobile Documents/com~apple~CloudDocs/obsidian/beacon-carolina-context/`

### O que é
Plataforma SaaS de IA Conversacional e Gestão de Agentes. Permite criar, testar, monitorar e deployar agentes de IA com observabilidade profunda, multi-tenant, multi-canal e automações.

### Stack
- **Backend:** NestJS 10.4 + TypeScript 5.5 + Prisma 5.20 + PostgreSQL 15 + Redis 7 + BullMQ
- **Frontend:** React 18 + Vite 5.4 + Tailwind CSS 3.4 + Shadcn/UI + TanStack Query + Zustand
- **IA:** Anthropic SDK + OpenAI SDK (roteamento por prefixo do modelo)
- **Infra:** Docker + Nginx + Traefik + GitHub Actions
- **Banco prod:** Supabase PostgreSQL | **Cache prod:** Upstash Redis

### Estrutura
```
/apps/backend    ← NestJS (Clean Architecture: core/application/infrastructure/presentation)
/apps/frontend   ← React (Feature-Based: components/features/services/store/types)
```

### Convenções
- Backend: PascalCase classes, camelCase métodos, kebab-case arquivos, DTOs com `Dto` suffix
- Frontend: PascalCase componentes, camelCase hooks com `use` prefix, path alias `@/`
- Multi-tenant: Pool Isolation, `@Tenant()` decorator, JWT com tenantId
- Repository Pattern: Interfaces no `core/`, implementações em `infrastructure/`

### Deploy
- Domínio: `beacon.carolinapedrollo.com.br` (HTTPS via Traefik + Let's Encrypt)
- VPS: 62.171.171.144
- Docker multi-stage (node:20-alpine → nginx:alpine)
- CI: GitHub Actions (lint + test em push/PR)
- Registry: `ghcr.io/higrow-auto`

## Rotina de Sessão

- **No início:** consultar `/sessoes/` no vault para saber onde paramos
- **Ao finalizar:** criar nota de sessão no vault com: o que foi feito, decisões, próximos passos
- **Antes de implementar:** consultar `/padroes/` no vault para manter consistência
- **Decisões técnicas importantes:** registrar em `/decisoes/` no vault
- **Contexto técnico:** consultar `/projeto/` no vault quando precisar de contexto

## Crescimento da Base de Conhecimento

- Sempre usar `[[wikilinks]]` para conectar notas relacionadas
- Tags no frontmatter para categorização
- Quando descobrir algo não documentado, criar nota e conectar
- Notas podem linkar entre pastas livremente
- Ao criar decisão, linkar: sessão que originou, arquivos afetados, padrões aplicados
- Periodicamente sugerir consolidação de padrões recorrentes
- O grafo do Obsidian deve crescer organicamente

## Supabase MCP

O projeto tem MCP do Supabase configurado em `.mcp.json` (project ref: `qeoppextysyhmrgutoty`).

## Obsidian MCP

O vault Obsidian está acessível via MCP server na porta 22360 (configurado em `~/.claude/settings.json`).
O Obsidian precisa estar aberto para o MCP funcionar.
