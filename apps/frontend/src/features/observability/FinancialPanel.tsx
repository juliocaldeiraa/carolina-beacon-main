/**
 * FinancialPanel — Métricas Financeiras
 *
 * Spec: SPEC.md §6.2
 * Métricas: Tokens input/output, Custo/conversa, ROI por modelo
 * Gráfico: Bar chart com cor #f06529
 * Export CSV disponível
 */

import { DollarSign, Hash, TrendingDown, Download } from 'lucide-react'
import { MetricCard } from './MetricCard'
import { BeaconBarChart } from '@/components/charts/BeaconBarChart'
import { Button } from '@/components/ui/Button'
import type { ObservabilitySummary, TimeseriesPoint } from '@/types/metric'

interface FinancialPanelProps {
  summary:    ObservabilitySummary['financial'] | undefined
  timeseries: TimeseriesPoint[]
  loading:    boolean
}

function exportCsv(timeseries: TimeseriesPoint[]) {
  const header = 'data,custo_usd,total_tokens,conversas'
  const rows   = timeseries.map(
    (d) => `${d.date},${d.totalCostUsd.toFixed(4)},${d.totalTokens},${d.conversations}`,
  )
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `beacon-financeiro-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function FinancialPanel({ summary, timeseries, loading }: FinancialPanelProps) {
  const fmtUsd    = (v: number) => `$${v.toFixed(4)}`
  const fmtTokens = (v: number) => v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
    ? `${(v / 1000).toFixed(0)}K`
    : String(v)

  return (
    <section aria-labelledby="panel-financial">
      <div className="flex items-center justify-between mb-4">
        <h3 id="panel-financial" className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-beacon-primary" /> Financeiro
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => exportCsv(timeseries)}
          disabled={loading || timeseries.length === 0}
          title="Exportar CSV"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Custo Total"
          value={loading ? '—' : `$${(summary?.totalCostUsd ?? 0).toFixed(2)}`}
          icon={DollarSign}
          loading={loading}
          invertTrend
          chart={
            <BeaconBarChart
              data={timeseries}
              dataKey="totalCostUsd"
              formatter={fmtUsd}
              height={72}
            />
          }
        />

        <MetricCard
          title="Custo/Conversa"
          value={loading ? '—' : fmtUsd(summary?.avgCostPerConversation ?? 0)}
          icon={TrendingDown}
          loading={loading}
          invertTrend
        />

        <MetricCard
          title="Tokens Input"
          value={loading ? '—' : fmtTokens(summary?.totalInputTokens ?? 0)}
          icon={Hash}
          loading={loading}
          invertTrend
        />

        <MetricCard
          title="Tokens Output"
          value={loading ? '—' : fmtTokens(summary?.totalOutputTokens ?? 0)}
          icon={Hash}
          loading={loading}
          invertTrend
          chart={
            <BeaconBarChart
              data={timeseries}
              dataKey="totalTokens"
              formatter={fmtTokens}
              height={72}
            />
          }
        />
      </div>
    </section>
  )
}
