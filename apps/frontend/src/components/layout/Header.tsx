/**
 * Header — Barra superior
 *
 * Spec: /Brand/Playbook de Layout e UX - Plataforma Beacon.md §3.1
 * - Logo no canto superior esquerdo
 * - Informações do usuário no canto superior direito
 */

import { LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { NotificationsPanel } from './NotificationsPanel'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-60 right-0 h-16 bg-beacon-surface border-b border-[rgba(255,255,255,0.06)] z-30 flex items-center justify-between px-6">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-bold text-white leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* User actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationsPanel />

        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg text-white/50 hover:bg-white/8 hover:text-white transition-colors"
          aria-label="Configurações"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 rounded-full bg-beacon-primary flex items-center justify-center text-white text-sm font-semibold">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-sm font-medium text-white/70 hidden md:block">
            {user?.email ?? 'user@beacon.ai'}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          aria-label="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
