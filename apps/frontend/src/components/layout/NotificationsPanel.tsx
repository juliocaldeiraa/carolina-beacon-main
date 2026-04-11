/**
 * NotificationsPanel — Sininho com histórico de eventos
 *
 * Abre um painel dropdown ao clicar no sino.
 * Registra automaticamente todos os toasts disparados na aplicação.
 * Persiste em localStorage entre sessões.
 */

import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCircle, XCircle, Info, Trash2, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useNotificationsStore,
  selectUnreadCount,
  type Notification,
} from '@/store/useNotificationsStore'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'agora mesmo'
  const m = Math.floor(s / 60)
  if (m < 60)  return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

const typeConfig = {
  success: { Icon: CheckCircle, color: 'text-green-400',         bg: 'bg-green-500/15'  },
  error:   { Icon: XCircle,     color: 'text-red-400',           bg: 'bg-red-500/15'    },
  info:    { Icon: Info,        color: 'text-beacon-primary',    bg: 'bg-beacon-primary/15' },
}

// ─── Item ────────────────────────────────────────────────────────────────────

function NotificationItem({ n }: { n: Notification }) {
  const { Icon, color, bg } = typeConfig[n.type]
  return (
    <div className={cn('flex gap-3 px-4 py-3 transition-colors', !n.read && 'bg-white/5')}>
      <div className={cn('mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0', bg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold text-white leading-snug', !n.read && 'font-bold')}>
          {n.title}
        </p>
        {n.message && (
          <p className="text-[11px] text-white/50 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
        )}
        <p className="text-[10px] text-white/35 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && (
        <div className="w-2 h-2 rounded-full bg-beacon-primary mt-1.5 shrink-0" />
      )}
    </div>
  )
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function NotificationsPanel() {
  const [open, setOpen]         = useState(false)
  const panelRef                = useRef<HTMLDivElement>(null)
  const notifications           = useNotificationsStore((s) => s.notifications)
  const unread                  = useNotificationsStore(selectUnreadCount)
  const { markAllRead, clearAll } = useNotificationsStore()

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return ()  => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Marca como lidas ao abrir
  const handleOpen = () => {
    setOpen((v) => {
      if (!v && unread > 0) setTimeout(markAllRead, 400)
      return !v
    })
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Sino */}
      <button
        onClick={handleOpen}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          open
            ? 'bg-white/10 text-white'
            : 'text-white/50 hover:bg-white/8 hover:text-white',
        )}
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-80 bg-beacon-surface rounded-xl shadow-surface border border-[rgba(255,255,255,0.08)] z-50',
            'flex flex-col overflow-hidden',
          )}
          style={{ maxHeight: 480 }}
        >
          {/* Header do painel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
            <span className="text-sm font-semibold text-white">
              Notificações
              {unread > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-red-500/15 text-red-400 rounded-full font-bold">
                  {unread} nova{unread !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {notifications.some((n) => !n.read) && (
                <button
                  onClick={markAllRead}
                  className="p-1.5 rounded-lg text-white/40 hover:text-beacon-primary hover:bg-white/8 transition-colors"
                  title="Marcar tudo como lido"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Limpar histórico"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <Bell className="w-8 h-8 text-white/25" />
                <p className="text-xs text-white/40">Nenhuma notificação ainda</p>
              </div>
            ) : (
              notifications.map((n) => <NotificationItem key={n.id} n={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
