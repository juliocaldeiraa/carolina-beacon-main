import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Check, Loader2, TrendingUp } from 'lucide-react'
import { api } from '@/services/api'

// ─── Etapas fixas do funil ────────────────────────────────────────────────────

const STAGES = [
  { key: 'MENSAGEM_ENVIADA', label: 'Mensagem Enviada' },
  { key: 'RESPONDEU',        label: 'Respondeu'        },
  { key: 'EM_CONTATO',       label: 'Em Contato'       },
  { key: 'AGENDADO',         label: 'Agendado'         },
  { key: 'CONVERTIDO',       label: 'Convertido'       },
] as const

// Paleta laranja → âmbar → verde (escurece progressivamente)
const STEP_COLORS = [
  '#f06529',
  '#d4521e',
  '#b84016',
  '#9c2e0e',
  '#16a34a',  // verde no fim = conversão
]

const MAX_WIDTH_PCT = 88

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FunnelItem {
  id:              string
  name:            string
  status:          string
  total:           number
  columns:         Record<string, number>
  conversionTotal?: number
  conversionCount?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtNumber(v: number) {
  return v.toLocaleString('pt-BR')
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function CampaignFunnelPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dropdown, setDropdown]     = useState(false)

  const { data = [], isLoading } = useQuery<FunnelItem[]>({
    queryKey: ['funnel'],
    queryFn:  () => api.get('/campaigns/funnel').then(r => r.data),
    refetchInterval: 30_000,
  })

  const selected = selectedId ? (data.find(d => d.id === selectedId) ?? null) : null

  const aggregated: FunnelItem | null = data.length > 1 && !selected ? {
    id:     'all',
    name:   'Todas as campanhas',
    status: '',
    total:  data.reduce((s, d) => s + d.total, 0),
    columns: STAGES.reduce((acc, s) => {
      acc[s.key] = data.reduce((sum, d) => sum + (d.columns[s.key] ?? 0), 0)
      return acc
    }, {} as Record<string, number>),
    conversionTotal: data.reduce((s, d) => s + (d.conversionTotal ?? 0), 0),
    conversionCount: data.reduce((s, d) => s + (d.conversionCount ?? 0), 0),
  } : null

  const active = selected ?? (data.length === 1 ? data[0] : aggregated)
  const values = STAGES.map(s => active?.columns[s.key] ?? 0)
  const convCount = active?.conversionCount ?? (active?.columns?.['CONVERTIDO'] ?? 0)
  const convTotal = active?.conversionTotal ?? 0
  const total     = active?.total ?? 0

  const closeAll = () => setDropdown(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 gap-2 text-white/40">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-white/30 gap-3">
        <TrendingUp className="w-8 h-8" />
        <p className="text-sm">Nenhuma campanha com leads ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5" onClick={closeAll}>
      {/* ── Cards de métricas ── */}
      {active && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Total disparado',
              value: fmtNumber(total),
              sub:   'leads na campanha',
              color: '#f06529',
            },
            {
              label: 'Convertidos',
              value: fmtNumber(convCount),
              sub:   total > 0 ? ((convCount / total) * 100).toFixed(1) + '% de conversão' : '—',
              color: '#16a34a',
            },
            {
              label: 'Receita gerada',
              value: convTotal > 0 ? fmtCurrency(convTotal) : '—',
              sub:   convCount > 0 ? fmtCurrency(convTotal / convCount) + ' / lead' : 'Sem registros',
              color: '#0891b2',
            },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-2">{card.label}</p>
              <p className="font-bold leading-none tabular-nums text-2xl" style={{ color: card.color }}>
                {card.value}
              </p>
              <p className="text-[11px] text-gray-400 mt-1.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Funil visual (dark) ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header do container escuro */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="px-5 py-3">
          <p className="text-sm font-medium text-white/70">Funil de Conversão</p>
        </div>

      <div className="p-5 space-y-5">

        {/* Seletor de campanha */}
        <div className="flex justify-center">
          <div className="relative">
            <button
              onClick={() => setDropdown(o => !o)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm min-w-[240px] justify-between transition-colors"
              style={{
                color:      'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.06)',
                border:     '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <span className="truncate max-w-[220px]">
                {selected?.name ?? (data.length === 1 ? data[0].name : 'Todas as campanhas')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>

            {dropdown && data.length > 1 && (
              <div
                className="absolute top-full mt-1 left-0 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
                style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                <div className="px-3 pt-2 pb-1">
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.30)' }}>
                    Selecionar campanha
                  </p>
                </div>
                <div className="py-1 max-h-56 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedId(null); setDropdown(false) }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                    style={{ color: !selectedId ? '#f06529' : 'rgba(255,255,255,0.60)' }}
                  >
                    {!selectedId
                      ? <Check className="w-3.5 h-3.5 shrink-0" />
                      : <span className="w-3.5 h-3.5 shrink-0" />
                    }
                    Todas as campanhas
                  </button>
                  {data.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedId(c.id); setDropdown(false) }}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                      style={{ color: selectedId === c.id ? '#f06529' : 'rgba(255,255,255,0.60)' }}
                    >
                      {selectedId === c.id
                        ? <Check className="w-3.5 h-3.5 shrink-0" />
                        : <span className="w-3.5 h-3.5 shrink-0" />
                      }
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Badge taxa de conversão */}
        {active && total > 0 && (
          <div className="flex justify-center">
            <div
              className="px-5 py-2 rounded-xl text-sm font-semibold"
              style={{ background: '#f06529', color: '#fff' }}
            >
              Taxa de conversão: {convCount > 0 ? ((convCount / total) * 100).toFixed(1) + '%' : '0%'}
            </div>
          </div>
        )}

        {/* Funil visual */}
        {active && (
          <div className="flex flex-col items-center w-full gap-0">
            {STAGES.map((stage, idx) => {
              const val = values[idx]
              const widthPct = MAX_WIDTH_PCT * (STAGES.length - idx) / STAGES.length
              const color = STEP_COLORS[idx]
              const prevVal = idx > 0 ? values[idx - 1] : null
              const conversionRate = prevVal !== null && prevVal > 0
                ? ((val / prevVal) * 100).toFixed(1) + '%'
                : null

              return (
                <div key={stage.key} className="w-full flex flex-col items-center">
                  {/* Conector entre etapas */}
                  {idx > 0 && (
                    <div className="flex flex-col items-center" style={{ width: `${widthPct}%` }}>
                      <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.10)' }} />
                      {conversionRate !== null ? (
                        <div
                          className="flex items-center gap-1 px-3 py-1 rounded-full my-1"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>↓</span>
                          <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.50)' }}>
                            {conversionRate} convertido
                          </span>
                        </div>
                      ) : (
                        <div style={{ height: 8 }} />
                      )}
                      <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.10)' }} />
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-6 py-5 text-center transition-all duration-500"
                    style={{ width: `${widthPct}%`, background: color }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{stage.label}</p>
                    <p className="text-4xl font-bold text-white leading-tight tabular-nums">
                      {fmtNumber(val)}
                    </p>
                    {total > 0 && (
                      <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.50)' }}>
                        {val > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%'} do total
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!active && (
          <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
            Selecione uma campanha
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
