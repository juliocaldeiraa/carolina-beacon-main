/**
 * MetricCard — Card de métrica com gráfico inline
 *
 * Spec: /Brand/Playbook de Layout e UX - Plataforma Beacon.md §3.3
 * - Header: título da métrica + ícone
 * - Valor principal: fonte grande, bold, cor #000000
 * - Gráfico inline: Recharts, cor primária #f06529
 * - Trend indicator: ▲ verde / ▼ vermelho
 */

import { type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface MetricCardProps {
  title:       string
  value:       string | number
  icon:        LucideIcon
  trend?:      number   // positivo = bom, negativo = ruim (%)
  trendLabel?: string
  chart?:      ReactNode
  loading?:    boolean
  className?:  string
  invertTrend?: boolean  // para métricas onde menor é melhor (ex: custo, latência)
}

function TrendBadge({ trend, invertTrend }: { trend: number; invertTrend?: boolean }) {
  const isGood = invertTrend ? trend < 0 : trend > 0
  const pct    = Math.abs(trend).toFixed(1)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isGood ? 'text-green-600' : 'text-red-500',
      )}
      aria-label={`${isGood ? 'Melhora' : 'Piora'} de ${pct}%`}
    >
      {trend > 0 ? '▲' : '▼'} {pct}%
    </span>
  )
}

export function MetricCard({
  title, value, icon: Icon, trend, trendLabel, chart, loading, className, invertTrend,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn('flex flex-col gap-3', className)}>
        <div className="h-4 w-24 bg-white/8 rounded animate-pulse" />
        <div className="h-8 w-16 bg-white/8 rounded animate-pulse" />
        {chart && <div className="h-20 bg-white/8 rounded animate-pulse" />}
      </Card>
    )
  }

  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-beacon-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{title}</span>
        </div>
        {trend !== undefined && (
          <TrendBadge trend={trend} invertTrend={invertTrend} />
        )}
      </div>

      {/* Valor principal */}
      <p className="text-2xl font-bold text-white leading-none">{value}</p>

      {/* Trend label */}
      {trendLabel && (
        <p className="text-xs text-white/40">{trendLabel}</p>
      )}

      {/* Gráfico inline */}
      {chart && (
        <div className="mt-1">
          {chart}
        </div>
      )}
    </Card>
  )
}

/** KPI Card simples sem gráfico */
export function KpiCard({
  title, value, icon: Icon, description, className,
}: {
  title: string; value: string; icon: LucideIcon; description?: string; className?: string
}) {
  return (
    <Card className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-beacon-primary" aria-hidden="true" />
        <span className="text-xs text-white/50 uppercase tracking-wide font-medium">{title}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {description && <p className="text-xs text-white/40">{description}</p>}
    </Card>
  )
}
