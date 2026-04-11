/**
 * SettingsShell — Shell da área de Configurações
 * Sub-nav vertical à esquerda + área de conteúdo à direita
 */

import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { User, Users, Bot, Webhook, Puzzle, Brain, Database } from 'lucide-react'
import { ProfilePage }      from './pages/ProfilePage'
import { TeamPage }         from './pages/TeamPage'
import { AiProvidersPage }  from './pages/AiProvidersPage'
import { WebhooksPage }     from './pages/WebhooksPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { CentralAiPage }    from './pages/CentralAiPage'
import { DatabasePage }     from './pages/DatabasePage'
import { useAuthStore }     from '@/store/useAuthStore'
import { cn }               from '@/lib/utils'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  description: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    to: 'profile',
    icon: User,
    label: 'Perfil',
    description: 'Informações pessoais e senha',
  },
  {
    to: 'team',
    icon: Users,
    label: 'Equipe',
    description: 'Usuários e permissões',
    adminOnly: true,
  },
  {
    to: 'ai',
    icon: Bot,
    label: 'Provedores de IA',
    description: 'Chaves de API dos modelos',
    adminOnly: true,
  },
  {
    to: 'webhooks',
    icon: Webhook,
    label: 'Webhooks',
    description: 'Notificações para sistemas externos',
    adminOnly: true,
  },
  {
    to: 'integrations',
    icon: Puzzle,
    label: 'Integrações',
    description: 'Conecte suas ferramentas',
    adminOnly: true,
  },
  {
    to: 'central-ai',
    icon: Brain,
    label: 'IA Central',
    description: 'IA auxiliar para tarefas automáticas',
    adminOnly: true,
  },
  {
    to: 'database',
    icon: Database,
    label: 'Banco de Dados',
    description: 'Inspecionar e limpar dados',
    adminOnly: true,
  },
]

export function SettingsShell() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="flex gap-6 -m-6 min-h-[calc(100vh-88px)]">
      {/* Sub-nav */}
      <div className="w-56 shrink-0 bg-beacon-surface border-r border-[rgba(255,255,255,0.07)] pt-6 pb-6 px-3">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest px-3 mb-3">
          Configurações
        </p>
        <nav className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                  isActive
                    ? 'bg-beacon-primary/10 text-beacon-primary'
                    : 'text-white/60 hover:bg-white/6 hover:text-white',
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-beacon-primary' : 'text-white/40 group-hover:text-white')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">{item.label}</p>
                      <p className="text-[10px] mt-0.5 truncate opacity-70">{item.description}</p>
                    </div>
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 pt-6 pb-6 pr-6 overflow-y-auto">
        <Routes>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile"      element={<ProfilePage />} />
          <Route path="team"         element={<TeamPage />} />
          <Route path="ai"           element={<AiProvidersPage />} />
          <Route path="webhooks"     element={<WebhooksPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="central-ai"   element={<CentralAiPage />} />
          <Route path="database"     element={<DatabasePage />} />
        </Routes>
      </div>
    </div>
  )
}
