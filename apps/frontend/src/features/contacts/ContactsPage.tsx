/**
 * ContactsPage — Banco de dados de contatos
 * Lista todos os contatos com busca, filtro por canal e link para detalhe
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search, Phone, MessageSquare, ChevronRight } from 'lucide-react'
import { useContacts } from './hooks/useContacts'
import { useChannels } from '@/features/channels/hooks/useChannels'
import { cn } from '@/lib/utils'

// Paleta de cores para tags
const TAG_COLORS: Record<string, string> = {
  VIP:          'bg-amber-500/20 text-amber-300',
  Lead:         'bg-blue-500/20 text-blue-300',
  'Lead Quente': 'bg-orange-500/20 text-orange-300',
  Cliente:      'bg-green-500/20 text-green-300',
  Suporte:      'bg-purple-500/20 text-purple-300',
}
function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? 'bg-white/8 text-white/60'
}

function getInitials(name?: string, phone?: string): string {
  if (name && name.trim()) {
    return name.trim().split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  }
  return phone?.slice(-2) ?? '?'
}

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export function ContactsPage() {
  const navigate = useNavigate()
  const [search,    setSearch]    = useState('')
  const [channelId, setChannelId] = useState('')
  const [page, setPage]           = useState(1)

  const { data, isLoading } = useContacts({
    search:    search || undefined,
    channelId: channelId || undefined,
    page,
    limit:     50,
  })
  const { data: channels = [] } = useChannels()

  const contacts   = data?.items ?? []
  const total      = data?.total ?? 0

  return (
    <div className="space-y-4">
      {/* Cabeçalho + filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nome, telefone ou e-mail…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-[rgba(255,255,255,0.08)] rounded-lg text-white/85 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 placeholder:text-white/25"
          />
        </div>
        <select
          value={channelId}
          onChange={(e) => { setChannelId(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-[rgba(255,255,255,0.08)] rounded-lg bg-beacon-surface text-white/85 focus:outline-none focus:border-[#00b4d8]/60"
        >
          <option value="">Todos os canais</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.name}</option>
          ))}
        </select>
      </div>

      {/* Contagem */}
      <p className="text-xs text-white/40">
        {isLoading ? 'Carregando…' : `${total} contato${total !== 1 ? 's' : ''}`}
      </p>

      {/* Estado vazio */}
      {!isLoading && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-xl">
          <div className="w-14 h-14 rounded-full bg-white/8 flex items-center justify-center">
            <Users className="w-7 h-7 text-white/35" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Nenhum contato encontrado</p>
            <p className="text-xs text-white/40 mt-1">
              {search || channelId
                ? 'Tente remover os filtros'
                : 'Os contatos aparecem automaticamente quando mensagens chegam pelos canais'}
            </p>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/8 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Tabela */}
      {!isLoading && contacts.length > 0 && (
        <div className="bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[2.5rem_1fr_1fr_1fr_6rem_8rem_2.5rem] items-center gap-3 px-4 py-2.5 bg-white/4 text-[10px] font-semibold text-white/40 uppercase tracking-wide border-b border-[rgba(255,255,255,0.07)]">
            <span />
            <span>Nome</span>
            <span>Telefone</span>
            <span>Canal / Última interação</span>
            <span>Conversas</span>
            <span>Tags</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {contacts.map((c) => {
              const channelName = channels.find((ch) => ch.id === c.channelId)?.name
              const tags = c.tags as string[]
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                  className="w-full text-left grid sm:grid-cols-[2.5rem_1fr_1fr_1fr_6rem_8rem_2.5rem] items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                    'bg-beacon-primary',
                  )}>
                    {getInitials(c.name, c.phone)}
                  </div>

                  {/* Nome */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {c.name ?? <span className="text-white/35 font-normal">Sem nome</span>}
                    </p>
                    {c.email && (
                      <p className="text-xs text-white/50 truncate">{c.email}</p>
                    )}
                  </div>

                  {/* Telefone */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Phone className="w-3.5 h-3.5 text-white/35 shrink-0" />
                    <span className="text-xs text-white/50 font-mono truncate">{c.phone}</span>
                  </div>

                  {/* Canal + última interação */}
                  <div className="min-w-0">
                    {channelName && (
                      <p className="text-xs text-white/50 truncate">{channelName}</p>
                    )}
                    <p className="text-[10px] text-white/35">{formatDate(c.lastContactAt)}</p>
                  </div>

                  {/* Conversas */}
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-white/35 shrink-0" />
                    <span className="text-xs text-white/50">{c.convCount}</span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 2).map((tag) => (
                      <span key={tag} className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', tagColor(tag))}>
                        {tag}
                      </span>
                    ))}
                    {tags.length > 2 && (
                      <span className="text-[10px] text-white/40">+{tags.length - 2}</span>
                    )}
                  </div>

                  {/* Seta */}
                  <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Paginação */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-xs border border-[rgba(255,255,255,0.08)] rounded-lg text-white/70 hover:border-beacon-primary disabled:opacity-40 transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-white/40">Página {page}</span>
          <button
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-xs border border-[rgba(255,255,255,0.08)] rounded-lg text-white/70 hover:border-beacon-primary disabled:opacity-40 transition-colors"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
