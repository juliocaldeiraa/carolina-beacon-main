/**
 * EngagementPanel — Métricas de Engajamento
 *
 * Spec: SPEC.md §6.2
 * Métricas: Conversas/dia, Retenção, Turns médio
 * Gráfico: Area chart com gradiente #f06529
 */

import { MessageSquare, TrendingUp, Repeat } from 'lucide-react'
import { MetricCard, KpiCard } from './MetricCard'
import { BeaconAreaChart } from '@/components/charts/BeaconAreaChart'
import type { ObservabilitySummary, TimeseriesPoint } from '@/types/metric'

interface EngagementPanelProps {
  summary:    ObservabilitySummary['engagement'] | undefined
  timeseries: TimeseriesPoint[]
  loading:    boolean
}

export function EngagementPanel({ summary, timeseries, loading }: EngagementPanelProps) {
  const totalConvs = summary?.totalConversations ?? 0
  const avgTurns   = summary?.avgTurnsPerConversation ?? 0
  const days       = new Set(timeseries.map((d) => d.date.slice(0, 10))).size || 1
  const convPerDay = (totalConvs / days).toFixed(1)

  return (
    <section aria-labelledby="panel-engagement">
      <h3 id="panel-engagement" className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-beacon-primary" /> Engajamento
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Conversas"
          value={loading ? '—' : totalConvs.toLocaleString('pt-BR')}
          icon={MessageSquare}
          loading={loading}
          trendLabel={loading ? undefined : `${convPerDay}/dia em média`}
          chart={
            <BeaconAreaChart
              data={timeseries}
              dataKey="conversations"
              height={72}
            />
          }
        />

        <MetricCard
          title="Turns/Conversa"
          value={loading ? '—' : avgTurns.toFixed(1)}
          icon={Repeat}
          loading={loading}
          trendLabel="média de mensagens por sessão"
          chart={
            <BeaconAreaChart
              data={timeseries.map((d) => ({ ...d, turns: avgTurns }))}
              dataKey="turns"
              height={72}
            />
          }
        />

        <KpiCard
          title="Conversas/Dia"
          value={loading ? '—' : convPerDay}
          icon={TrendingUp}
          description={`Total: ${totalConvs.toLocaleString('pt-BR')} conversas`}
        />
      </div>
    </section>
  )
}
