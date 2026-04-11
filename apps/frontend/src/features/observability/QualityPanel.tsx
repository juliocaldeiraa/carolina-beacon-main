/**
 * QualityPanel — Métricas de Qualidade
 *
 * Spec: SPEC.md §6.2
 * Métricas: Sentiment, Hallucination Score, Rating médio, Relevância
 */

import { Heart, ShieldCheck, Star, Target } from 'lucide-react'
import { KpiCard } from './MetricCard'
import type { ObservabilitySummary } from '@/types/metric'

interface QualityPanelProps {
  summary: ObservabilitySummary['quality'] | undefined
  loading: boolean
}

function StarRating({ value }: { value: number }) {
  const stars = Math.round(value)
  return (
    <div className="flex gap-0.5" aria-label={`${value.toFixed(1)} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < stars ? 'text-beacon-primary fill-beacon-primary' : 'text-white/20'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

function sentimentLabel(score: number): string {
  if (score >= 0.3)  return 'Positivo'
  if (score <= -0.3) return 'Negativo'
  return 'Neutro'
}

function sentimentColor(score: number): string {
  if (score >= 0.3)  return 'text-green-400'
  if (score <= -0.3) return 'text-red-400'
  return 'text-white/50'
}

export function QualityPanel({ summary, loading }: QualityPanelProps) {
  const sentiment = summary?.avgSentimentScore ?? 0
  const halluc    = summary?.avgHallucinationScore ?? 0
  const rating    = summary?.avgUserRating ?? 0
  const relevance = summary?.avgRelevanceScore ?? 0

  return (
    <section aria-labelledby="panel-quality">
      <h3 id="panel-quality" className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-beacon-primary" /> Qualidade
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sentiment */}
        <KpiCard
          title="Sentimento"
          value={loading ? '—' : sentimentLabel(sentiment)}
          icon={Heart}
          description={
            loading ? undefined
            : `Score: ${sentiment.toFixed(2)} (-1 a 1)`
          }
          className={loading ? '' : sentimentColor(sentiment)}
        />

        {/* Hallucination */}
        <KpiCard
          title="Alucinação"
          value={loading ? '—' : `${(halluc * 100).toFixed(1)}%`}
          icon={ShieldCheck}
          description="Menor é melhor"
        />

        {/* User Rating */}
        <div className="bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-beacon-primary" aria-hidden="true" />
            <span className="text-xs text-white/50 uppercase tracking-wide font-medium">Avaliação</span>
          </div>
          {loading ? (
            <div className="h-6 w-20 bg-white/8 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-bold text-white">{rating.toFixed(1)}</p>
              <StarRating value={rating} />
            </>
          )}
        </div>

        {/* Relevance */}
        <KpiCard
          title="Relevância"
          value={loading ? '—' : `${(relevance * 100).toFixed(1)}%`}
          icon={Target}
          description="Aderência ao contexto"
        />
      </div>
    </section>
  )
}
