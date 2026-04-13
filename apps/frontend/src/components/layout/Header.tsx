/**
 * Header — Top bar (healthcare clean design)
 */

import { LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { NotificationsPanel } from './NotificationsPanel'

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
    <header className="fixed top-0 left-[260px] right-0 h-16 bg-white border-b border-gray-100 z-30 flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-heading font-bold text-[#134E4A] leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationsPanel />

        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-[#0891B2] transition-colors"
          aria-label="Configurações"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 rounded-full bg-[#0891B2]/10 flex items-center justify-center text-[#0891B2] text-sm font-semibold">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-sm font-medium text-gray-600 hidden md:block">
            {user?.email ?? 'user@beacon.ai'}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
