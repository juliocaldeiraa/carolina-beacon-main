/**
 * InsightsPage — Observabilidade consolidada da plataforma
 *
 * 3 abas:
 *  Visão Geral  — KPIs agregados de campanhas, conversas e saúde do sistema
 *  Campanhas    — Métricas de automações: enviados, respostas, conversões, timeline
 *  Chat IA      — Saúde do pipeline de ingestion + stats de conversas
 */

import { useMemo, useState } from 'react'
import {
  RefreshCw, TrendingUp, MessageSquare, Zap,
  CheckCircle2, AlertTriangle, Users, Activity,
  Send, Reply, Target, Bot, Radio, Ban,
  ShoppingBag, Clock, ArrowRight, Filter,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { cn }                   from '@/lib/utils'
import { Button }               from '@/components/ui/Button'
import { Select }               from '@/components/ui/Select'
import { useInsightsOverview, useInsightsCampaigns, useInsightsChat, useInsightsVendedor } from './hooks/useInsights'
import { useAutomations }       from '@/features/automations/hooks/useAutomations'
import { useChannels }          from '@/features/channels/hooks/useChannels'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d'

function periodToDates(p: Period) {
  const to   = new Date()
  const from = new Date(Date.now() - (p === '7d' ? 7 : p === '30d' ? 30 : 90) * 86_400_000)
  return { from: from.toISOString(), to: to.toISOString() }
}

function fmt(n: number) { return n.toLocaleString('pt-BR') }
function fmtMs(n: number) { return n > 0 ? `${n}ms` : '—' }

function healthColor(pct: number) {
  if (pct >= 90) return 'text-green-400'
  if (pct >= 70) return 'text-yellow-400'
  return 'text-red-400'
}

function healthBg(pct: number) {
  if (pct >= 90) return 'bg-green-500'
  if (pct >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:   string
  value:   string | number
  sub?:    string
  icon?:   React.ElementType
  accent?: string
  loading?: boolean
}

function StatCard({ label, value, sub, icon: Icon, accent = 'text-white', loading }: StatCardProps) {
  return (
    <div className="bg-white/4 border border-white/8 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={cn('w-3.5 h-3.5', accent)} />}
        <span className="text-[11px] text-white/50 uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-white/10 rounded animate-pulse" />
      ) : (
        <p className={cn('text-2xl font-bold leading-none', accent)}>{value}</p>
      )}
      {sub && !loading && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Tooltip dark ─────────────────────────────────────────────────────────────

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl px-3 py-2 text-xs">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Aba: Visão Geral ────────────────────────────────────────────────────────

function OverviewTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useInsightsOverview(from, to)

  const c = data?.campaigns
  const v = data?.conversations
  const s = data?.system
  const l = data?.leads

  return (
    <div className="flex flex-col gap-8">

      {/* Campanhas */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-beacon-primary" /> Campanhas de Prospecção
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Enviados (total)"   value={fmt(c?.totalSent ?? 0)}                           icon={Send}        accent="text-beacon-primary" loading={isLoading} />
          <StatCard label="Respondidos"         value={fmt(c?.totalReplied ?? 0)}                        icon={Reply}       accent="text-blue-400"       loading={isLoading} />
          <StatCard label="Conversões"          value={fmt(c?.totalConverted ?? 0)}                      icon={Target}      accent="text-green-400"      loading={isLoading} />
          <StatCard label="Taxa de Resposta"    value={`${c?.replyRate ?? 0}%`}                          icon={TrendingUp}  accent="text-blue-400"       loading={isLoading} sub={`de ${fmt(c?.totalSent ?? 0)} enviados`} />
          <StatCard label="Taxa de Conversão"   value={`${c?.conversionRate ?? 0}%`}                     icon={Target}      accent="text-green-400"      loading={isLoading} sub="leads → clientes" />
          <StatCard label="Campanhas Ativas"    value={`${c?.activeCampaigns ?? 0}/${c?.total ?? 0}`}    icon={Activity}    accent="text-beacon-primary" loading={isLoading} />
        </div>
      </section>

      {/* Conversas IA */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-beacon-primary" /> Chat IA (no período)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Conversas"          value={fmt(v?.total ?? 0)}              icon={MessageSquare} accent="text-white"         loading={isLoading} />
          <StatCard label="Abertas"            value={fmt(v?.open ?? 0)}               icon={MessageSquare} accent="text-yellow-400"    loading={isLoading} />
          <StatCard label="Humano Assumiu"     value={fmt(v?.humanTakeover ?? 0)}      icon={Users}         accent="text-orange-400"    loading={isLoading} sub={`${v?.humanTakeoverRate ?? 0}% do total`} />
          <StatCard label="Mensagens IA"       value={fmt(s?.totalIngested ?? 0)}      icon={Zap}           accent="text-blue-400"      loading={isLoading} sub="no período" />
        </div>
      </section>

      {/* Sistema */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-beacon-primary" /> Saúde do Sistema (no período)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Saúde Geral"          value={`${s?.healthPct ?? 0}%`}    icon={CheckCircle2}  accent={healthColor(s?.healthPct ?? 0)} loading={isLoading} />
          <StatCard label="Entregues com sucesso" value={fmt(s?.completed ?? 0)}     icon={CheckCircle2}  accent="text-green-400"  loading={isLoading} />
          <StatCard label="Erros de IA"          value={fmt(s?.aiErrors ?? 0)}       icon={AlertTriangle} accent="text-red-400"    loading={isLoading} />
          <StatCard label="Latência Média"       value={fmtMs(s?.avgLatencyMs ?? 0)} icon={Zap}           accent="text-white"      loading={isLoading} sub="processamento IA" />
        </div>

        {/* Barra de saúde */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-white/40 w-16 shrink-0">Sistema</span>
          <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden">
            {!isLoading && (
              <div
                className={cn('h-full rounded-full transition-all', healthBg(s?.healthPct ?? 100))}
                style={{ width: `${s?.healthPct ?? 100}%` }}
              />
            )}
          </div>
          <span className={cn('text-xs font-semibold w-10 text-right', healthColor(s?.healthPct ?? 100))}>
            {isLoading ? '—' : `${s?.healthPct ?? 100}%`}
          </span>
        </div>
      </section>

      {/* Funil de leads */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-beacon-primary" /> Funil de Leads
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Captados"    value={fmt(l?.total ?? 0)}                icon={Users}         accent="text-white"       loading={isLoading} sub="base completa" />
          <StatCard label="Convertidos"       value={fmt(l?.converted ?? 0)}            icon={Target}        accent="text-green-400"   loading={isLoading} sub={`${l?.conversionRate ?? 0}% da base`} />
          <StatCard label="Opt-out"           value={fmt(l?.optOut ?? 0)}               icon={AlertTriangle} accent="text-orange-400"  loading={isLoading} sub="solicitaram saída" />
          <StatCard label="Lista de Exclusão" value={fmt(l?.exclusionListTotal ?? 0)}   icon={Ban}           accent="text-red-400"     loading={isLoading} sub="bloqueados para disparo" />
        </div>
      </section>
    </div>
  )
}

// ─── Aba: Campanhas ───────────────────────────────────────────────────────────

function CampaignsTab({ from, to }: { from: string; to: string }) {
  const [automationId, setAutomationId] = useState('')
  const { data: automations = [] }    = useAutomations()
  const { data, isLoading }           = useInsightsCampaigns(from, to, automationId || undefined)

  const chartData = data?.automations
    .filter(a => a.totalSent > 0)
    .map(a => ({
      name:      a.name.length > 18 ? a.name.slice(0, 16) + '…' : a.name,
      Enviados:  a.totalSent,
      Respostas: a.totalReplied,
      Convertidos: a.totalConverted,
    })) ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro */}
      <div className="flex items-center gap-3">
        <Select value={automationId} onChange={e => setAutomationId(e.target.value)} className="w-56">
          <option value="">Todas as campanhas</option>
          {automations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>

      {/* KPI totais */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Enviados"   value={fmt(data?.totals.sent      ?? 0)} icon={Send}    accent="text-beacon-primary" loading={isLoading} />
        <StatCard label="Total Respostas"  value={fmt(data?.totals.replied   ?? 0)} icon={Reply}   accent="text-blue-400"       loading={isLoading} />
        <StatCard label="Total Conversões" value={fmt(data?.totals.converted ?? 0)} icon={Target}  accent="text-green-400"      loading={isLoading} />
      </div>

      {/* Gráfico de barras: performance por campanha */}
      <div className="bg-white/4 border border-white/8 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-white/60 mb-4 uppercase tracking-wide">Performance por Campanha</h4>
        {isLoading ? (
          <div className="h-[220px] bg-white/4 rounded-lg animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-2">
            <div className="flex gap-2">
              {[3, 5, 2, 7, 4].map((h, i) => (
                <div key={i} className="w-8 bg-white/6 rounded-t-sm" style={{ height: h * 14 }} />
              ))}
            </div>
            <p className="text-xs text-white/20 mt-2">Sem dados no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip content={<DarkTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', paddingTop: 8 }} />
              <Bar dataKey="Enviados"    fill="#f06529" radius={[3,3,0,0]} />
              <Bar dataKey="Respostas"   fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="Convertidos" fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Timeline de logs no período */}
      <div className="bg-white/4 border border-white/8 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-white/60 mb-4 uppercase tracking-wide">Disparos no Período</h4>
        {isLoading ? (
          <div className="h-[180px] bg-white/4 rounded-lg animate-pulse" />
        ) : (data?.timeline.length ?? 0) === 0 ? (
          <div className="h-[180px] flex flex-col items-center justify-center gap-2">
            <div className="w-full flex items-end gap-1 px-4" style={{ height: 100 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex-1 bg-white/5 rounded-t-sm" style={{ height: `${(i % 3 + 1) * 20}%` }} />
              ))}
            </div>
            <p className="text-xs text-white/20">Sem disparos registrados no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data!.timeline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
              <YAxis hide />
              <Tooltip content={<DarkTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', paddingTop: 8 }} />
              <Bar dataKey="sent"    name="Enviados" fill="#f06529" radius={[3,3,0,0]} />
              <Bar dataKey="skipped" name="Pulados"  fill="#6b7280" radius={[3,3,0,0]} />
              <Bar dataKey="errors"  name="Erros"    fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabela de campanhas — sempre mostra, skeletons enquanto carrega */}
      <div className="bg-white/4 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wide">Campanhas</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-white/8">
              {['Nome', 'Status', 'Enviados', 'Respostas', 'Conversões', 'Taxa Resp.', 'Taxa Conv.', 'Último Disparo'].map(h => (
                <th key={h} className="px-4 py-2.5 text-[11px] text-white/40 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-white/4">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3.5 bg-white/8 rounded animate-pulse" style={{ width: j === 0 ? 120 : j === 1 ? 60 : 50 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (data?.automations.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-white/25 text-xs">
                  Nenhuma campanha criada ainda
                </td>
              </tr>
            ) : (
              data!.automations.map((a, i) => (
                <tr key={a.id} className={cn('border-b border-white/4 hover:bg-white/3', i % 2 === 0 && 'bg-white/2')}>
                  <td className="px-4 py-2.5 text-white font-medium">{a.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', a.status === 'ACTIVE' ? 'bg-green-500/15 text-green-400' : 'bg-white/8 text-white/40')}>
                      {a.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/80">{fmt(a.totalSent)}</td>
                  <td className="px-4 py-2.5 text-blue-400">{fmt(a.totalReplied)}</td>
                  <td className="px-4 py-2.5 text-green-400">{fmt(a.totalConverted)}</td>
                  <td className="px-4 py-2.5 text-white/60">{a.replyRate}%</td>
                  <td className="px-4 py-2.5 text-white/60">{a.conversionRate}%</td>
                  <td className="px-4 py-2.5 text-white/40 text-xs">
                    {a.lastBatchAt ? new Date(a.lastBatchAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Aba: Chat IA ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  completed:        { label: 'Entregue',        color: 'text-green-400',   bg: 'bg-green-500/15' },
  no_agent:         { label: 'Sem agente',       color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  ai_error:         { label: 'Erro de IA',       color: 'text-red-400',     bg: 'bg-red-500/15' },
  parse_error:      { label: 'Erro de parsing',  color: 'text-red-400',     bg: 'bg-red-500/15' },
  send_error:       { label: 'Erro de envio',    color: 'text-red-400',     bg: 'bg-red-500/15' },
  human_takeover:   { label: 'Humano assumiu',   color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  ignored_group:    { label: 'Grupo ignorado',   color: 'text-white/40',    bg: 'bg-white/8' },
  ignored_trigger:  { label: 'Gatilho ignorado', color: 'text-white/40',    bg: 'bg-white/8' },
  debounced:        { label: 'Debounced',        color: 'text-white/40',    bg: 'bg-white/8' },
}

function ChatTab({ from, to }: { from: string; to: string }) {
  const [channelId, setChannelId] = useState('')
  const { data: channels = [] }   = useChannels()
  const { data, isLoading }       = useInsightsChat(from, to, channelId || undefined)

  const ing  = data?.ingestion
  const conv = data?.conversations

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro canal */}
      <div className="flex items-center gap-3">
        <Select value={channelId} onChange={e => setChannelId(e.target.value)} className="w-56">
          <option value="">Todos os canais</option>
          {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {/* Saúde da IA */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-beacon-primary" /> Saúde do Pipeline de Mensagens
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Recebido"   value={fmt(ing?.total ?? 0)}         icon={MessageSquare} accent="text-white"       loading={isLoading} />
          <StatCard label="Taxa de Sucesso"  value={`${ing?.successRate ?? 0}%`}  icon={CheckCircle2}  accent={healthColor(ing?.successRate ?? 0)} loading={isLoading} />
          <StatCard label="Latência Média"   value={fmtMs(ing?.avgLatencyMs ?? 0)} icon={Zap}          accent="text-white"       loading={isLoading} sub="mensagens completas" />
          <StatCard label="Latência Máxima"  value={fmtMs(ing?.maxLatencyMs ?? 0)} icon={Zap}          accent="text-yellow-400"  loading={isLoading} />
        </div>
      </section>

      {/* Breakdown de status — sempre visível */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">Breakdown por Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(STATUS_LABELS).map(([key, { label, color, bg }]) => {
            const count = ing?.breakdown[key] ?? 0
            const pct   = (ing?.total ?? 0) > 0 ? Math.round((count / ing!.total) * 100) : 0
            return (
              <div key={key} className={cn('rounded-xl border border-white/8 p-3', bg)}>
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{label}</p>
                {isLoading ? (
                  <div className="h-6 w-12 bg-white/10 rounded animate-pulse" />
                ) : (
                  <p className={cn('text-xl font-bold', color)}>{fmt(count)}</p>
                )}
                <p className="text-[10px] text-white/30 mt-0.5">{isLoading ? '—' : `${pct}% do total`}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Timeline ingestion — sempre visível */}
      <div className="bg-white/4 border border-white/8 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-white/60 mb-4 uppercase tracking-wide">Volume de Mensagens por Dia</h4>
        {isLoading ? (
          <div className="h-[200px] bg-white/4 rounded-lg animate-pulse" />
        ) : (data?.timeline.length ?? 0) === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2">
            <div className="w-full flex items-end gap-1 px-4" style={{ height: 120 }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="flex-1 bg-white/5 rounded-t-sm" style={{ height: `${((i * 3 + 7) % 10 + 1) * 8}%` }} />
              ))}
            </div>
            <p className="text-xs text-white/20">Sem mensagens registradas no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data!.timeline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
              <YAxis hide />
              <Tooltip content={<DarkTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', paddingTop: 8 }} />
              <Line type="monotone" dataKey="total"     name="Total"     stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="completed" name="Entregues" stroke="#22c55e"              strokeWidth={2}   dot={false} />
              <Line type="monotone" dataKey="errors"    name="Erros"     stroke="#ef4444"              strokeWidth={2}   dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Conversas — sempre visível */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-beacon-primary" /> Conversas no Período
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Conversas"       value={fmt(conv?.total ?? 0)}                    icon={MessageSquare} accent="text-white"      loading={isLoading} />
          <StatCard label="Turns médios"    value={conv?.avgTurns ?? 0}                       icon={Activity}      accent="text-white"      loading={isLoading} sub="trocas por conversa" />
          <StatCard label="Humano assumiu"  value={fmt(conv?.humanTakeover ?? 0)}             icon={Users}         accent="text-orange-400" loading={isLoading} sub={`${conv?.humanTakeoverRate ?? 0}% do total`} />
          <StatCard label="% Automatizadas" value={`${100 - (conv?.humanTakeoverRate ?? 0)}%`} icon={Bot}          accent="text-blue-400"   loading={isLoading} sub="resolvidas pela IA" />
        </div>
      </section>
    </div>
  )
}

// ─── Aba: Vendedor ────────────────────────────────────────────────────────────

function FunnelStep({
  label, value, sub, color, pct, loading,
}: {
  label: string; value: number; sub?: string; color: string; pct?: number; loading?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className={cn('w-full rounded-xl border border-white/8 p-3 text-center', color.replace('text-', 'bg-').replace('400', '500/10'))}>
        {loading ? (
          <div className="h-7 w-16 bg-white/10 rounded animate-pulse mx-auto mb-1" />
        ) : (
          <p className={cn('text-2xl font-bold leading-none', color)}>{fmt(value)}</p>
        )}
        <p className="text-[10px] text-white/50 mt-1 font-medium uppercase tracking-wide">{label}</p>
        {sub && !loading && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
      </div>
      {pct !== undefined && !loading && (
        <div className="flex items-center gap-1 text-[10px] text-white/30">
          <ArrowRight className="w-3 h-3" />
          <span>{pct}%</span>
        </div>
      )}
    </div>
  )
}

function VendedorTab() {
  const { data, isLoading } = useInsightsVendedor()
  const s = data?.summary
  const automations = data?.automations ?? []

  // Converte taxas do funil
  const taxaEnvioFila    = s && s.totalNaFila > 0
    ? Math.round((s.totalEnviados    / (s.totalNaFila + s.totalEnviados)) * 100) : null
  const taxaResposta     = s?.taxaResposta     ?? 0
  const taxaConversao    = s?.taxaConversao    ?? 0

  return (
    <div className="flex flex-col gap-8">

      {/* KPIs de resumo */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <ShoppingBag className="w-3.5 h-3.5 text-beacon-primary" /> Resumo Geral
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          <StatCard label="Campanhas Ativas"  value={`${s?.campanhasAtivas ?? 0}/${s?.totalCampanhas ?? 0}`}  icon={Radio}        accent="text-beacon-primary" loading={isLoading} />
          <StatCard label="Leads na Fila"     value={fmt(s?.totalNaFila ?? 0)}      icon={Users}        accent="text-blue-400"       loading={isLoading} sub="prontos para disparo" />
          <StatCard label="Taxa de Resposta"  value={`${taxaResposta}%`}             icon={Reply}        accent="text-cyan-400"       loading={isLoading} sub={`de ${fmt(s?.totalEnviados ?? 0)} enviados`} />
          <StatCard label="Taxa de Conversão" value={`${taxaConversao}%`}            icon={Target}       accent="text-green-400"      loading={isLoading} sub="enviados → clientes" />
        </div>
      </section>

      {/* Funil de conversão */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-beacon-primary" /> Funil de Conversão
        </h3>
        <div className="grid grid-cols-4 gap-2 items-start">
          <FunnelStep label="Na Fila"     value={s?.totalNaFila ?? 0}      color="text-blue-400"    loading={isLoading}
            pct={taxaEnvioFila ?? undefined} />
          <FunnelStep label="Enviados"    value={s?.totalEnviados ?? 0}    color="text-beacon-primary" loading={isLoading}
            pct={taxaResposta} />
          <FunnelStep label="Respondidos" value={s?.totalRespostas ?? 0}   color="text-cyan-400"    loading={isLoading}
            pct={s && s.totalRespostas > 0 ? Math.round((s.totalConvertidos / s.totalRespostas) * 100) : undefined} />
          <FunnelStep label="Convertidos" value={s?.totalConvertidos ?? 0} color="text-green-400"   loading={isLoading} />
        </div>
        {/* Barra proporcional */}
        {!isLoading && s && s.totalEnviados > 0 && (
          <div className="mt-3 flex rounded-full overflow-hidden h-2 gap-px">
            <div className="bg-cyan-400/60  transition-all" style={{ width: `${s.taxaResposta}%` }} />
            <div className="bg-green-500/60 transition-all" style={{ width: `${s.taxaConversao}%` }} />
            <div className="bg-white/8 flex-1" />
          </div>
        )}
      </section>

      {/* Tabela por campanha */}
      <section>
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-beacon-primary" /> Performance por Campanha
        </h3>
        <div className="bg-white/4 border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left">
                {['Campanha', 'Status', 'Filtro', 'Na Fila', 'Enviados', 'Respostas', 'Conversões', 'Taxa Resp.', 'Taxa Conv.', 'Excluídos', 'Último Lote'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-[11px] text-white/40 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/4">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3 bg-white/8 rounded animate-pulse" style={{ width: j === 0 ? 100 : 40 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : automations.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-white/25 text-xs">
                    Nenhuma campanha criada ainda
                  </td>
                </tr>
              ) : (
                automations.map((a, i) => (
                  <tr key={a.id} className={cn('border-b border-white/4 hover:bg-white/3 transition-colors', i % 2 === 0 && 'bg-white/2')}>
                    <td className="px-3 py-2.5 font-medium text-white max-w-[140px] truncate">{a.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', a.status === 'ACTIVE' ? 'bg-green-500/15 text-green-400' : 'bg-white/8 text-white/35')}>
                        {a.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1 max-w-[120px]">
                        {a.filterStatus.split(',').map((s) => s.trim()).filter(Boolean).map((tag) => (
                          <span key={tag} className="text-[9px] bg-[#00b4d8]/10 text-[#38bdf8] border border-[#00b4d8]/20 px-1.5 py-0.5 rounded font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-blue-400 font-semibold">{fmt(a.leadsNaFila)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-white/80">{fmt(a.totalSent)}</td>
                    <td className="px-3 py-2.5 text-cyan-400">{fmt(a.totalReplied)}</td>
                    <td className="px-3 py-2.5 text-green-400 font-semibold">{fmt(a.totalConverted)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs font-medium', a.replyRate >= 20 ? 'text-green-400' : a.replyRate >= 10 ? 'text-yellow-400' : 'text-white/50')}>
                        {a.replyRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs font-medium', a.conversionRate >= 5 ? 'text-green-400' : a.conversionRate >= 2 ? 'text-yellow-400' : 'text-white/50')}>
                        {a.conversionRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.useExclusionList && a.leadsExcluidos > 0 ? (
                        <span className="text-orange-400 text-xs font-medium flex items-center gap-1">
                          <Ban className="w-3 h-3" />{fmt(a.leadsExcluidos)}
                        </span>
                      ) : (
                        <span className="text-white/25 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-white/35 text-xs whitespace-nowrap">
                      {a.lastBatchAt
                        ? new Date(a.lastBatchAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Aguardando</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gráfico: comparativo de campanhas */}
      {!isLoading && automations.some(a => a.totalSent > 0) && (
        <section>
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-beacon-primary" /> Comparativo de Campanhas
          </h3>
          <div className="bg-white/4 border border-white/8 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={automations.filter(a => a.totalSent > 0).map(a => ({
                  name:        a.name.length > 14 ? a.name.slice(0, 12) + '…' : a.name,
                  'Na Fila':   a.leadsNaFila,
                  Enviados:    a.totalSent,
                  Respostas:   a.totalReplied,
                  Convertidos: a.totalConverted,
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip content={<DarkTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', paddingTop: 8 }} />
                <Bar dataKey="Na Fila"    fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="Enviados"   fill="#f06529" radius={[3,3,0,0]} />
                <Bar dataKey="Respostas"  fill="#22d3ee" radius={[3,3,0,0]} />
                <Bar dataKey="Convertidos" fill="#22c55e" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  )
}

// ─── InsightsPage ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'campaigns' | 'chat' | 'vendedor'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Visão Geral', icon: Activity      },
  { id: 'campaigns', label: 'Campanhas',   icon: Radio         },
  { id: 'vendedor',  label: 'Vendedor',    icon: ShoppingBag   },
  { id: 'chat',      label: 'Chat IA',     icon: MessageSquare },
]

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d',  label: '7 dias'  },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

export function InsightsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [tab,    setTab   ] = useState<Tab>('overview')
  const [ts,     setTs    ] = useState(Date.now())

  const dates = useMemo(() => periodToDates(period), [period, ts])

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho: período + refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div
          className="flex rounded-lg border border-white/8 overflow-hidden"
          role="group"
          aria-label="Período"
        >
          {PERIODS.map(p => (
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

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTs(Date.now())}
          aria-label="Atualizar dados"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/8">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === id
                ? 'border-beacon-primary text-beacon-primary'
                : 'border-transparent text-white/50 hover:text-white',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      {tab === 'overview'  && <OverviewTab  from={dates.from} to={dates.to} />}
      {tab === 'campaigns' && <CampaignsTab from={dates.from} to={dates.to} />}
      {tab === 'vendedor'  && <VendedorTab />}
      {tab === 'chat'      && <ChatTab      from={dates.from} to={dates.to} />}
    </div>
  )
}
