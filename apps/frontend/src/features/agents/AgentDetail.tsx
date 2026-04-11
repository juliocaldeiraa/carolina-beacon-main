/**
 * AgentDetail — Visão detalhada do agente
 */

import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, ArrowLeft, Bot, Wrench, Brain, Target, Settings2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAgent } from './hooks/useAgents'

const statusVariant = { ACTIVE: 'active', PAUSED: 'paused', DRAFT: 'draft', DELETED: 'error' } as const
const statusLabel   = { ACTIVE: 'Ativo', PAUSED: 'Pausado', DRAFT: 'Rascunho', DELETED: 'Removido' }

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: agent, isLoading } = useAgent(id ?? '')

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-card bg-white/8 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-white/50">Agente não encontrado.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/agents')}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/agents')}
            className="p-2 rounded-lg text-white/50 hover:bg-white/8 hover:text-white transition-colors"
            aria-label="Voltar para lista"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center">
            <Bot className="w-6 h-6 text-beacon-primary" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <Badge variant={statusVariant[agent.status]}>{statusLabel[agent.status]}</Badge>
            </div>
            <p className="text-sm text-white/50 mt-0.5">{agent.description ?? 'Sem descrição'}</p>
          </div>
        </div>

        <Button variant="secondary" onClick={() => navigate(`/agents/${agent.id}/edit`)}>
          <Pencil className="w-4 h-4" /> Editar
        </Button>
      </div>

      {/* Personalidade */}
      {(agent.personality || agent.systemPrompt) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-beacon-primary" /> Personalidade e Regras de Comportamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-white/85 bg-white/6 p-3 rounded-lg overflow-auto whitespace-pre-wrap font-mono">
              {agent.personality ?? agent.systemPrompt}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Instrução de Ação */}
      {agent.actionPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-4 h-4 text-beacon-primary" /> Instrução de Ação / Objetivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-white/85 bg-white/6 p-3 rounded-lg overflow-auto whitespace-pre-wrap font-mono">
              {agent.actionPrompt}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-beacon-primary" /> Configurações Avançadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-xs text-white/40">Temperatura</dt>
                <dd className="text-xs text-white font-medium">{agent.temperature.toFixed(1)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-white/40">Max Tokens</dt>
                <dd className="text-xs text-white font-medium">{agent.maxTokens}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-white/40">Limite de Trocas</dt>
                <dd className="text-xs text-white font-medium">
                  {agent.limitTurns ? `${agent.maxTurns} trocas` : 'Sem limite'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-white/40">Fallback</dt>
                <dd className="text-xs text-white font-medium">
                  {agent.fallbackEnabled ? 'Ativado' : 'Desativado'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-beacon-primary" /> Ferramentas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agent.tools && agent.tools.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {agent.tools.map((t) => (
                  <Badge key={t} variant="default">{t}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40">Nenhuma ferramenta configurada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Criado em</dt>
              <dd className="text-white mt-1">{new Date(agent.createdAt).toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">Atualizado em</dt>
              <dd className="text-white mt-1">{new Date(agent.updatedAt).toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40 font-medium uppercase tracking-wide">ID</dt>
              <dd className="text-white/50 mt-1 font-mono text-xs">{agent.id}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
