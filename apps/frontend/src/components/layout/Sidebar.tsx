/**
 * Sidebar — Navegação lateral fixa
 *
 * Spec: /Brand/Playbook de Layout e UX - Plataforma Beacon.md §3.2
 * - bg: #000000 (dark mode sidebar)
 * - text: #ffffff
 * - item ativo: bg #f06529, text #ffffff
 * - item hover: bg rgba(255,255,255,0.1)
 */

import { NavLink } from 'react-router-dom'
import {
  Bot,
  BarChart3,
  BookOpen,
  Radio,
  Megaphone,
  Smartphone,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  Settings,
  Users,
  TrendingUp,
  Kanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import type { UserRole } from '@/store/useAuthStore'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  roles: UserRole[] | 'all'
}

const navItems: NavItem[] = [
  { to: '/agents',        icon: Bot,           label: 'Agentes',          roles: ['ADMIN', 'EQUIPE'] },
  { to: '/insights',      icon: BarChart3,      label: 'Insights',         roles: ['ADMIN', 'EQUIPE'] },
  { to: '/playground',    icon: BookOpen,       label: 'Playground',       roles: ['ADMIN', 'EQUIPE'] },
  { to: '/chat-ia',       icon: MessageCircle,  label: 'Chat IA',          roles: ['ADMIN', 'EQUIPE'] },
  { to: '/channels',      icon: Smartphone,     label: 'Canais',           roles: ['ADMIN', 'EQUIPE'] },
  { to: '/conversations', icon: MessageSquare,  label: 'Conversas',        roles: 'all' },
  { to: '/contacts',      icon: Users,          label: 'Contatos',         roles: 'all' },
  { to: '/campaigns',     icon: Megaphone,      label: 'Campanhas',        roles: ['ADMIN', 'EQUIPE', 'COMERCIAL'] },
  { to: '/crm',           icon: Kanban,         label: 'CRM',              roles: ['ADMIN', 'EQUIPE', 'COMERCIAL'] },
  { to: '/vendedor',      icon: TrendingUp,     label: 'Vendedor',         roles: ['ADMIN', 'EQUIPE'] },
  { to: '/settings',      icon: Settings,       label: 'Configurações',    roles: ['ADMIN'] },
]

export function Sidebar() {
  const { user } = useAuthStore()
  const role = user?.role ?? 'SUPORTE'

  const visible = navItems.filter((item) =>
    item.roles === 'all' || item.roles.includes(role),
  )

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a] flex flex-col z-40"
      aria-label="Navegação principal"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-[#1e1e1e]">
        <div className="w-8 h-8 bg-beacon-primary rounded-lg flex items-center justify-center shadow-glow-sm">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Beacon</span>
      </div>

      {/* Company label */}
      <div className="px-4 py-3 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-beacon-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            B
          </div>
          <span className="text-white/70 text-sm truncate">Minha Empresa</span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="Menu de navegação">
        {visible.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-beacon-primary text-white shadow-[0_0_16px_rgba(240,101,41,0.25)]'
                  : 'text-white/70 hover:bg-white/6 hover:text-white',
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Support Links */}
      <div className="px-3 pb-4 border-t border-[#1e1e1e] pt-3 space-y-0.5">
        <a
          href="https://docs.beacon.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50
                     hover:bg-white/6 hover:text-white transition-colors"
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span>Documentação</span>
          <ExternalLink className="w-3 h-3 ml-auto" aria-hidden="true" />
        </a>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2 text-white/50 text-xs">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="truncate">{user?.email ?? 'user@beacon.ai'}</span>
        </div>
      </div>
    </aside>
  )
}
