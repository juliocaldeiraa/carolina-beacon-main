/**
 * PerformancePanel — Métricas de Performance
 *
 * Spec: SPEC.md §6.2
 * Métricas: Latência TTFT, Success Rate, Fallback Rate
 * Gráfico: Line chart com cor #f06529
 */

import { Zap, CheckCircle, AlertTriangle, Activity } from 'lucide-react'
import { MetricCard } from './MetricCard'
import { BeaconLineChart } from '@/components/charts/BeaconLineChart'
import type { ObservabilitySummary, TimeseriesPoint } from '@/types/metric'

interface PerformancePanelProps {
  summary:    ObservabilitySummary['performance'] | undefined
  timeseries: TimeseriesPoint[]
  loading:    boolean
}

export function PerformancePanel({ summary, timeseries, loading }: PerformancePanelProps) {
  const fmtMs  = (v: number) => `${v.toFixed(0)}ms`
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

  return (
    <section aria-labelledby="panel-performance">
      <h3 id="panel-performance" className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-beacon-primary" /> Performance
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Latência Média"
          value={loading ? '—' : fmtMs(summary?.avgLatencyMs ?? 0)}
          icon={Zap}
          loading={loading}
          invertTrend  // menor latência = melhor
          chart={
            <BeaconLineChart
              data={timeseries}
              dataKey="avgLatencyMs"
              formatter={fmtMs}
              height={72}
            />
          }
        />

        <MetricCard
          title="Taxa de Sucesso"
          value={loading ? '—' : fmtPct(summary?.successRate ?? 0)}
          icon={CheckCircle}
          loading={loading}
          chart={
            <BeaconLineChart
              data={timeseries.map((d) => ({ ...d, successRate: 0.95 }))}
              dataKey="successRate"
              formatter={fmtPct}
              height={72}
              color="#22c55e"
            />
          }
        />

        <MetricCard
          title="Taxa de Fallback"
          value={loading ? '—' : fmtPct(summary?.fallbackRate ?? 0)}
          icon={AlertTriangle}
          loading={loading}
          invertTrend
          chart={
            <BeaconLineChart
              data={timeseries.map((d) => ({ ...d, fallbackRate: 0.05 }))}
              dataKey="fallbackRate"
              formatter={fmtPct}
              height={72}
              color="#e34c26"
            />
          }
        />
      </div>
    </section>
  )
}
