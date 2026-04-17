/**
 * Sidebar — Navegação lateral
 * Healthcare design system: clean, teal primary, white surface
 */

import { NavLink } from 'react-router-dom'
import {
  Bot,
  BarChart3,
  BookOpen,
  Megaphone,
  Smartphone,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  Settings,
  Users,
  TrendingUp,
  Kanban,
  Heart,
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
  { to: '/insights',      icon: BarChart3,     label: 'Insights',         roles: ['ADMIN', 'EQUIPE'] },
  { to: '/playground',    icon: BookOpen,      label: 'Playground',       roles: ['ADMIN', 'EQUIPE'] },
  { to: '/chat-ia',       icon: MessageCircle, label: 'Chat IA',          roles: ['ADMIN', 'EQUIPE'] },
  { to: '/channels',      icon: Smartphone,    label: 'Canais',           roles: ['ADMIN', 'EQUIPE'] },
  { to: '/conversations', icon: MessageSquare, label: 'Conversas',        roles: 'all' },
  { to: '/contacts',      icon: Users,         label: 'Contatos',         roles: 'all' },
  { to: '/campaigns',     icon: Megaphone,     label: 'Campanhas',        roles: ['ADMIN', 'EQUIPE', 'COMERCIAL'] },
  { to: '/crm/whatsapp',  icon: MessageCircle, label: 'CRM WhatsApp',     roles: 'all' },
  { to: '/crm',           icon: Kanban,        label: 'CRM',              roles: ['ADMIN', 'EQUIPE', 'COMERCIAL'] },
  { to: '/vendedor',      icon: TrendingUp,    label: 'Vendedor',         roles: ['ADMIN', 'EQUIPE'] },
  { to: '/settings',      icon: Settings,      label: 'Configurações',    roles: ['ADMIN'] },
]

export function Sidebar() {
  const { user, activeTenant } = useAuthStore()
  const role = user?.role ?? 'SUPORTE'

  const visible = navItems.filter((item) =>
    item.roles === 'all' || item.roles.includes(role),
  )

  return (
    <aside
      className="fixed left-0 top-0 h-full w-[260px] bg-white border-r border-gray-100 flex flex-col z-40"
      aria-label="Navegação principal"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-gradient-to-br from-[#0891B2] to-[#0E7490] rounded-xl flex items-center justify-center shadow-sm">
          <Heart className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-[#134E4A] font-heading font-bold text-lg tracking-tight">Beacon</span>
          <span className="text-[#0891B2] font-heading font-bold text-lg ml-0.5">.</span>
        </div>
      </div>

      {/* Workspace */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#0891B2]/10 flex items-center justify-center text-[#0891B2] text-xs font-bold">
            {activeTenant?.name?.[0]?.toUpperCase() ?? 'B'}
          </div>
          <span className="text-sm text-gray-500 truncate font-medium">{activeTenant?.name ?? 'Beacon'}</span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="Menu de navegação">
        {visible.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[#0891B2] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-[#134E4A]',
              )
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-1">
        <a
          href="https://docs.beacon.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400
                     hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span>Documentação</span>
          <ExternalLink className="w-3 h-3 ml-auto" aria-hidden="true" />
        </a>

        <div className="flex items-center gap-3 px-3 py-2 text-xs">
          <div className="w-7 h-7 rounded-full bg-[#0891B2]/10 flex items-center justify-center text-[#0891B2] text-xs font-semibold">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-gray-400 truncate">{user?.email ?? 'user@beacon.ai'}</span>
        </div>
      </div>
    </aside>
  )
}
