/**
 * AgentList — Grid de agentes com busca e filtros
 *
 * Spec: SPEC.md §6.1
 * - Grid de AgentCards com busca + filtro por status/modelo
 * - FAB "Criar Novo Agente" conforme Brand (cor #f06529, posição fixed)
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, Bot } from 'lucide-react'
import { AgentCard } from './AgentCard'
import { FAB } from '@/components/layout/FAB'
import { Select } from '@/components/ui/Select'
import { useAgents } from './hooks/useAgents'
import type { AgentStatus, AgentType } from '@/types/agent'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: { value: AgentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL',    label: 'Todos os status' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'PAUSED', label: 'Pausados' },
  { value: 'DRAFT',  label: 'Rascunhos' },
]

const TYPE_TABS: { value: AgentType | 'ALL'; label: string }[] = [
  { value: 'ALL',     label: 'Todos' },
  { value: 'ATIVO',   label: 'Ativo' },
  { value: 'PASSIVO', label: 'Passivo' },
]

export function AgentList() {
  const navigate = useNavigate()
  const { data: agents = [], isLoading, isError } = useAgents()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL')

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      const matchSearch =
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.description?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'ALL' || a.status === statusFilter
      const matchType   = typeFilter === 'ALL' || (a.agentType ?? 'PASSIVO') === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [agents, search, statusFilter, typeFilter])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 rounded-card bg-white/8 animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="text-sm text-red-600 font-medium">Erro ao carregar agentes</p>
        <p className="text-xs text-white/40">Verifique sua conexão e tente novamente.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Type filter tabs */}
      <div className="flex gap-1 bg-white/6 p-1 rounded-lg w-fit">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTypeFilter(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              typeFilter === t.value
                ? 'bg-beacon-surface-2 text-white shadow-sm'
                : 'text-white/50 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar agentes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm text-white/85 bg-beacon-surface rounded-lg
                         border border-[rgba(255,255,255,0.08)]
                         focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]
                         placeholder:text-white/25"
              aria-label="Buscar agentes"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <SlidersHorizontal className="w-4 h-4 text-white/35 self-center shrink-0" aria-hidden="true" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AgentStatus | 'ALL')}
            aria-label="Filtrar por status"
            className="w-40"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Contagem */}
      {agents.length > 0 && (
        <p className="text-xs text-white/40">
          {filtered.length} de {agents.length} agente{agents.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Grid de cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/8 flex items-center justify-center">
            <Bot className="w-8 h-8 text-beacon-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'Nenhum agente encontrado'
                : 'Nenhum agente criado ainda'}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'Tente ajustar os filtros de busca'
                : 'Clique no botão + para criar seu primeiro agente'}
            </p>
          </div>
        </div>
      )}

      {/* FAB — conforme Brand §3.3 */}
      <FAB
        onClick={() => navigate('/agents/new')}
        label="Criar novo agente"
      />
    </div>
  )
}
