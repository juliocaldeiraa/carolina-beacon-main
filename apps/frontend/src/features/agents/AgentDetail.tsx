/**
 * AgentDetail — Visão detalhada do agente com tabs (estilo GPT Maker)
 *
 * Tabs: Perfil | Treinamentos | Configurações | Testar
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Pencil, ArrowLeft, Bot, Brain, Settings2, BookOpen, Play,
  Trash2, Plus, FileText, Globe, Loader2, Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAgent } from './hooks/useAgents'
import { api } from '@/services/api'

const statusVariant = { ACTIVE: 'active', PAUSED: 'paused', DRAFT: 'draft', DELETED: 'error' } as const
const statusLabel   = { ACTIVE: 'Ativo', PAUSED: 'Pausado', DRAFT: 'Rascunho', DELETED: 'Removido' }

type Tab = 'profile' | 'trainings' | 'settings' | 'test'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile',   label: 'Perfil',         icon: Bot },
  { id: 'trainings', label: 'Treinamentos',   icon: BookOpen },
  { id: 'settings',  label: 'Configurações',  icon: Settings2 },
  { id: 'test',      label: 'Testar',         icon: Play },
]

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: agent, isLoading } = useAgent(id ?? '')
  const [tab, setTab] = useState<Tab>('profile')

  // Treinamentos
  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings', id],
    queryFn: () => api.get(`/agents/${id}/trainings`).then((r) => r.data),
    enabled: !!id,
  })
  const [trainingType, setTrainingType] = useState<'text' | 'url'>('text')
  const [trainingTitle, setTrainingTitle] = useState('')
  const [trainingContent, setTrainingContent] = useState('')
  const createTraining = useMutation({
    mutationFn: () => api.post(`/agents/${id}/trainings`, {
      type: trainingType, title: trainingTitle || undefined, content: trainingContent,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainings', id] })
      setTrainingTitle(''); setTrainingContent('')
    },
  })
  const deleteTraining = useMutation({
    mutationFn: (tid: string) => api.delete(`/agents/${id}/trainings/${tid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainings', id] }),
  })

  // Testar
  const [testMsg, setTestMsg] = useState('')
  const [testReply, setTestReply] = useState<string | null>(null)
  const testMutation = useMutation({
    mutationFn: () => api.post(`/agents/${id}/test`, { message: testMsg }).then((r) => r.data),
    onSuccess: (data: any) => setTestReply(data.reply),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-beacon-primary" />
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
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/agents')} className="p-2 rounded-lg text-white/50 hover:bg-white/8">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-beacon-primary/20 flex items-center justify-center">
            <Bot className="w-6 h-6 text-beacon-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <Badge variant={statusVariant[agent.status]}>{statusLabel[agent.status]}</Badge>
            </div>
            <p className="text-sm text-white/50">{agent.description ?? 'Sem descrição'} · {agent.model}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/agents/${agent.id}/edit`)}>
          <Pencil className="w-4 h-4" /> Editar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-beacon-primary text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ─── Tab: Perfil ─── */}
      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white/70">Informações</h3>
            {[
              ['Tipo', agent.agentType === 'ATIVO' ? 'Ativo (Vendas)' : 'Passivo (Chat IA)'],
              ['Modelo', agent.model],
              ['Objetivo', (agent as any).purpose ?? 'support'],
              ['Empresa', (agent as any).companyName ?? '—'],
              ['Tom', (agent as any).communicationTone ?? 'normal'],
              ['Criado', new Date(agent.createdAt).toLocaleString('pt-BR')],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-white/40">{label}</span>
                <span className="text-white">{value}</span>
              </div>
            ))}
          </div>

          {(agent.personality || agent.systemPrompt) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-beacon-primary" /> Personalidade
              </h3>
              <pre className="text-xs text-white/85 bg-white/6 p-3 rounded-lg whitespace-pre-wrap font-mono">
                {agent.personality ?? agent.systemPrompt}
              </pre>
            </div>
          )}

          {agent.actionPrompt && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Instrução de Ação</h3>
              <pre className="text-xs text-white/85 bg-white/6 p-3 rounded-lg whitespace-pre-wrap font-mono">
                {agent.actionPrompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Treinamentos ─── */}
      {tab === 'trainings' && (
        <div className="space-y-4">
          {/* Tabs tipo */}
          <div className="flex gap-2">
            {[
              { id: 'text' as const, label: 'Texto', icon: FileText },
              { id: 'url' as const, label: 'Website', icon: Globe },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTrainingType(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  trainingType === t.id ? 'bg-beacon-primary text-white' : 'bg-white/5 text-white/50 hover:text-white/80'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white/70">
              {trainingType === 'text' ? 'Novo treinamento via texto' : 'Novo treinamento via website'}
            </h3>
            <input
              value={trainingTitle}
              onChange={(e) => setTrainingTitle(e.target.value)}
              placeholder="Título (opcional)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
            <textarea
              value={trainingContent}
              onChange={(e) => setTrainingContent(e.target.value)}
              placeholder={trainingType === 'text'
                ? 'Escreva uma afirmação e tecle cadastrar...'
                : 'Cole a URL de um website ou sitemap'}
              rows={trainingType === 'text' ? 4 : 2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-y"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/30">{trainingContent.length} caracteres</span>
              <Button
                onClick={() => createTraining.mutate()}
                disabled={!trainingContent.trim() || createTraining.isPending}
                className="bg-beacon-primary"
              >
                {createTraining.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Cadastrar
              </Button>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {trainings.length === 0 ? (
              <p className="text-center text-sm text-white/30 py-8">Nenhum treinamento cadastrado ainda.</p>
            ) : (
              trainings.map((t: any) => (
                <div key={t.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {t.type === 'text' ? <FileText className="w-3.5 h-3.5 text-white/40" /> : <Globe className="w-3.5 h-3.5 text-white/40" />}
                      <span className="text-xs font-semibold text-white/60 uppercase">{t.type}</span>
                      {t.title && <span className="text-xs text-white/40">· {t.title}</span>}
                    </div>
                    <p className="text-xs text-white/70 line-clamp-2">{t.content}</p>
                  </div>
                  <button
                    onClick={() => deleteTraining.mutate(t.id)}
                    className="p-1.5 text-white/30 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Configurações ─── */}
      {tab === 'settings' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
          {[
            ['Temperatura', agent.temperature.toFixed(1)],
            ['Max Tokens', String(agent.maxTokens)],
            ['Memória', `${agent.historyLimit} mensagens`],
            ['Limite de trocas', agent.limitTurns ? `${agent.maxTurns} trocas` : 'Sem limite'],
            ['Fallback', agent.fallbackEnabled ? 'Ativado' : 'Desativado'],
            ['Emojis', (agent as any).useEmojis !== false ? 'Sim' : 'Não'],
            ['Dividir resposta', (agent as any).splitResponse !== false ? 'Sim' : 'Não'],
            ['Restringir temas', (agent as any).restrictTopics ? 'Sim' : 'Não'],
            ['Assinar nome', (agent as any).signName ? 'Sim' : 'Não'],
            ['Inatividade', `${(agent as any).inactivityMinutes ?? 10}min → ${(agent as any).inactivityAction ?? 'close'}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm py-1">
              <span className="text-white/40">{label}</span>
              <span className="text-white font-medium">{value}</span>
            </div>
          ))}
          <div className="pt-3 border-t border-white/10">
            <Button variant="secondary" onClick={() => navigate(`/agents/${agent.id}/edit`)}>
              <Settings2 className="w-4 h-4" /> Alterar configurações
            </Button>
          </div>
        </div>
      )}

      {/* ─── Tab: Testar ─── */}
      {tab === 'test' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Play className="w-4 h-4 text-beacon-primary" /> Teste sua IA
          </h3>

          {testReply && (
            <div className="bg-beacon-primary/10 border border-beacon-primary/20 rounded-lg p-4">
              <p className="text-xs text-white/40 mb-1">Resposta do agente:</p>
              <p className="text-sm text-white whitespace-pre-wrap">{testReply}</p>
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              placeholder="Envie uma mensagem para testar..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30"
              onKeyDown={(e) => { if (e.key === 'Enter' && testMsg.trim()) testMutation.mutate() }}
            />
            <Button
              onClick={() => testMutation.mutate()}
              disabled={!testMsg.trim() || testMutation.isPending}
              className="bg-beacon-primary"
            >
              {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
