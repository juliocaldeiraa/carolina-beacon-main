/**
 * ContactDetail — Página de detalhe do contato
 * Layout 2 colunas: info editável | histórico de conversas
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft, Phone, Mail, StickyNote, Tag, MessageSquare,
  Trash2, Save, X, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useContact, useUpdateContact, useDeleteContact } from './hooks/useContacts'
import { useChannels } from '@/features/channels/hooks/useChannels'
import type { UpdateContactPayload } from '@/types/contact'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN:        { label: 'Aberta',   color: 'bg-blue-500/20 text-blue-300' },
  IN_PROGRESS: { label: 'Em andamento', color: 'bg-yellow-500/20 text-yellow-300' },
  RESOLVED:    { label: 'Resolvida', color: 'bg-green-500/20 text-green-300' },
  CLOSED:      { label: 'Fechada',  color: 'bg-white/8 text-white/50' },
}

const SUGGESTED_TAGS = ['VIP', 'Lead', 'Lead Quente', 'Cliente', 'Suporte']

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function getInitials(name?: string, phone?: string) {
  if (name?.trim()) return name.trim().split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  return phone?.slice(-2) ?? '?'
}

export function ContactDetail() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { toast }  = useToast()

  const { data: contact, isLoading } = useContact(id ?? '')
  const { data: channels = [] }      = useChannels()
  const updateMutation               = useUpdateContact()
  const deleteMutation               = useDeleteContact()

  const [tags, setTags]         = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [dirty, setDirty]       = useState(false)

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<UpdateContactPayload>()

  // Sincroniza form quando o contato carrega
  useEffect(() => {
    if (contact) {
      reset({ name: contact.name ?? '', email: contact.email ?? '', notes: contact.notes ?? '' })
      setTags((contact.tags as string[]) ?? [])
      setDirty(false)
    }
  }, [contact, reset])

  const onSubmit = handleSubmit(async (data) => {
    if (!id) return
    await updateMutation.mutateAsync({ id, data: { ...data, tags } })
    toast({ type: 'success', title: 'Contato atualizado' })
    setDirty(false)
  })

  const handleDelete = async () => {
    if (!id) return
    await deleteMutation.mutateAsync(id)
    toast({ type: 'success', title: 'Contato removido' })
    navigate('/contacts')
  }

  const addTag = (tag: string) => {
    const t = tag.trim()
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t])
      setDirty(true)
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
    setDirty(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-white/8 rounded animate-pulse" />
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-80 bg-white/8 rounded-xl animate-pulse" />
          <div className="h-80 bg-white/8 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!contact) return null

  const channelName = channels.find((ch) => ch.id === contact.channelId)?.name
  const statusInfo  = (s: string) => STATUS_LABELS[s] ?? { label: s, color: 'bg-white/8 text-white/50' }

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={() => navigate('/contacts')}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Contatos
      </button>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4 items-start">
        {/* ─── Coluna Esquerda — Info do contato ─── */}
        <div className="bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-5 space-y-4">
          {/* Avatar + nome + telefone */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-beacon-primary flex items-center justify-center text-white text-lg font-bold shrink-0">
              {getInitials(contact.name, contact.phone)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-base truncate">
                {contact.name ?? <span className="text-white/35 font-normal">Sem nome</span>}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-white/35" />
                <span className="text-xs font-mono text-white/50">{contact.phone}</span>
              </div>
              {channelName && (
                <p className="text-xs text-white/35 mt-0.5">via {channelName}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 py-3 border-y border-[rgba(255,255,255,0.07)]">
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-white">{contact.convCount}</p>
              <p className="text-[10px] text-white/40 mt-0.5">Conversas</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-xs font-medium text-white">{formatDate(contact.lastContactAt)}</p>
              <p className="text-[10px] text-white/40 mt-0.5">Último contato</p>
            </div>
          </div>

          {/* Formulário */}
          <form onSubmit={onSubmit} className="space-y-3">
            {/* Nome */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Nome</label>
              <input
                {...register('name')}
                onChange={(e) => { register('name').onChange(e); setDirty(true) }}
                placeholder="Nome do contato"
                className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-white/85 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]"
              />
            </div>

            {/* E-mail */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-white/70 mb-1">
                <Mail className="w-3.5 h-3.5" /> E-mail
              </label>
              <input
                {...register('email')}
                onChange={(e) => { register('email').onChange(e); setDirty(true) }}
                type="email"
                placeholder="email@exemplo.com"
                className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-white/85 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-white/70 mb-1">
                <Tag className="w-3.5 h-3.5" /> Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-white/8 px-2 py-0.5 rounded-full text-white/80">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-white/40 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                  placeholder="Nova tag…"
                  className="flex-1 border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-1.5 text-xs text-white/85 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="px-2 py-1.5 bg-white/8 rounded-lg text-white/60 hover:bg-white/12 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Sugestões */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => { setTags((prev) => [...prev, t]); setDirty(true) }}
                    className="text-[10px] px-1.5 py-0.5 rounded-full border border-[rgba(255,255,255,0.1)] text-white/50 hover:border-beacon-primary hover:text-beacon-primary transition-colors"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-white/70 mb-1">
                <StickyNote className="w-3.5 h-3.5" /> Notas internas
              </label>
              <textarea
                {...register('notes')}
                onChange={(e) => { register('notes').onChange(e); setDirty(true) }}
                rows={4}
                placeholder="Anotações sobre este contato…"
                className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-white/85 bg-beacon-surface resize-none focus:outline-none focus:border-[#00b4d8]/60"
              />
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                className="flex-1"
                loading={isSubmitting || updateMutation.isPending}
                disabled={!dirty}
              >
                <Save className="w-4 h-4" /> Salvar
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={deleteMutation.isPending}
                onClick={handleDelete}
                className="text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>

        {/* ─── Coluna Direita — Histórico de conversas ─── */}
        <div className="bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-white/40" />
            Histórico de conversas
            <span className="text-xs font-normal text-white/40">({contact.conversations.length})</span>
          </h3>

          {contact.conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
              <MessageSquare className="w-8 h-8 text-white/25" />
              <p className="text-sm text-white/40">Nenhuma conversa ainda</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {contact.conversations.map((conv) => {
                const st  = statusInfo(conv.status)
                const ch  = channels.find((c) => c.id === conv.channelId)
                const lastMsg = conv.messages[0]
                return (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/conversations?id=${conv.id}`)}
                    className="w-full text-left p-3 border border-[rgba(255,255,255,0.07)] rounded-lg hover:border-beacon-primary/40 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', st.color)}>
                        {st.label}
                      </span>
                      {conv.agent && (
                        <span className="text-[10px] text-white/40">
                          Agente: {conv.agent.name}
                        </span>
                      )}
                      {ch && (
                        <span className="text-[10px] text-white/40 ml-auto">{ch.name}</span>
                      )}
                    </div>
                    {lastMsg && (
                      <p className="text-xs text-white/50 line-clamp-2">
                        <span className={cn(
                          'font-medium mr-1',
                          lastMsg.role === 'USER' ? 'text-white' : 'text-beacon-primary',
                        )}>
                          {lastMsg.role === 'USER' ? 'Contato:' : 'Agente:'}
                        </span>
                        {lastMsg.content}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40">
                      <span>{formatDate(conv.startedAt)}</span>
                      <span>·</span>
                      <span>{conv.turns} mensagem{conv.turns !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
