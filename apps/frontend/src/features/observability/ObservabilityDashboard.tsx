/**
 * ObservabilityDashboard — Dashboard principal de observabilidade
 *
 * Spec: SPEC.md §6.2
 * - Filtros globais: agente, período (7d / 30d / 90d)
 * - 4 painéis: Performance, Financial, Quality, Engagement
 * - Skeleton loaders (UX Playbook §4.4)
 * - Refresh automático a cada 2 min
 */

import { useState } from 'react'
import { RefreshCw, BarChart3 } from 'lucide-react'
import { PerformancePanel }  from './PerformancePanel'
import { FinancialPanel }    from './FinancialPanel'
import { QualityPanel }      from './QualityPanel'
import { EngagementPanel }   from './EngagementPanel'
import { useObservabilitySummary, useTimeseries } from './hooks/useMetrics'
import { useAgents } from '@/features/agents/hooks/useAgents'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { TimePeriod } from '@/types/metric'
import { cn } from '@/lib/utils'

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '7d',  label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
]

export function ObservabilityDashboard() {
  const [period,  setPeriod]  = useState<TimePeriod>('30d')
  const [agentId, setAgentId] = useState<string>('')

  const { data: agents = [] } = useAgents()

  const {
    data: summary,
    isLoading: loadingSummary,
    refetch: refetchSummary,
    dataUpdatedAt,
  } = useObservabilitySummary(period, agentId || undefined)

  const {
    data: timeseries = [],
    isLoading: loadingTs,
    refetch: refetchTs,
  } = useTimeseries(period, agentId || undefined)

  const loading = loadingSummary || loadingTs

  function handleRefresh() {
    void refetchSummary()
    void refetchTs()
  }

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-col gap-8">
      {/* Filtros globais */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Período */}
          <div className="flex rounded-lg border border-[rgba(255,255,255,0.08)] overflow-hidden" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  period === p.value
                    ? 'bg-beacon-primary text-white'
                    : 'bg-transparent text-white/50 hover:bg-white/8',
                )}
                aria-pressed={period === p.value}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Agente */}
          <Select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            aria-label="Filtrar por agente"
            className="w-48"
          >
            <option value="">Todos os agentes</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>

        {/* Refresh */}
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-white/40">Atualizado às {lastUpdate}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Atualizar dados"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Empty state quando não há dados */}
      {!loading && timeseries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/8 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-beacon-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nenhum dado disponível</p>
            <p className="text-xs text-white/40 mt-1">
              As métricas aparecerão aqui conforme os agentes forem utilizados.
            </p>
          </div>
        </div>
      )}

      {/* Painéis */}
      {(loading || timeseries.length > 0) && (
        <>
          <PerformancePanel
            summary={summary?.performance}
            timeseries={timeseries}
            loading={loading}
          />

          <div className="border-t border-[rgba(255,255,255,0.07)]" />

          <FinancialPanel
            summary={summary?.financial}
            timeseries={timeseries}
            loading={loading}
          />

          <div className="border-t border-[rgba(255,255,255,0.07)]" />

          <QualityPanel
            summary={summary?.quality}
            loading={loading}
          />

          <div className="border-t border-[rgba(255,255,255,0.07)]" />

          <EngagementPanel
            summary={summary?.engagement}
            timeseries={timeseries}
            loading={loading}
          />
        </>
      )}
    </div>
  )
}
