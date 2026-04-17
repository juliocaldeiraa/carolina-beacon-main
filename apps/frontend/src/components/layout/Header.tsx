/**
 * Header — Top bar with workspace selector
 */

import { useState } from 'react'
import { LogOut, Settings, ChevronDown, Plus, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { NotificationsPanel } from './NotificationsPanel'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, activeTenant, setToken, setActiveTenant, logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showTenants, setShowTenants] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.get('/auth/tenants').then((r) => r.data),
    enabled: user?.role === 'ADMIN',
  })

  const switchTenant = useMutation({
    mutationFn: (tenantId: string) => api.post('/auth/switch-tenant', { tenantId }).then((r) => r.data),
    onSuccess: (data: any) => {
      setToken(data.accessToken)
      setActiveTenant(data.tenant)
      setShowTenants(false)
      qc.invalidateQueries()
    },
  })

  const createTenant = useMutation({
    mutationFn: () => api.post('/auth/tenants', { name: newName, slug: newSlug || newName.toLowerCase().replace(/\s+/g, '-') }).then((r) => r.data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      setNewName('')
      setNewSlug('')
      setShowCreate(false)
      switchTenant.mutate(data.id)
    },
  })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-[260px] right-0 h-16 bg-white border-b border-gray-100 z-30 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Workspace selector */}
        {user?.role === 'ADMIN' && (
          <div className="relative">
            <button
              onClick={() => setShowTenants(!showTenants)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <Building2 className="w-4 h-4 text-[#0891B2]" />
              <span className="text-sm font-medium text-[#134E4A]">{activeTenant?.name ?? 'Workspace'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {showTenants && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTenants(false)} />
                <div className="absolute left-0 top-10 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[220px]">
                  {(tenants as any[]).map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => switchTenant.mutate(t.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors',
                        activeTenant?.id === t.id ? 'bg-[#0891B2]/10 text-[#0891B2] font-medium' : 'text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      {t.name}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => { setShowCreate(true); setShowTenants(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#0891B2] hover:bg-gray-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Novo workspace
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <h1 className="text-lg font-heading font-bold text-[#134E4A] leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsPanel />

        <button onClick={() => navigate('/settings')}
          className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-[#0891B2] transition-colors">
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

        <button onClick={handleLogout}
          className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Create tenant modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[#134E4A]">Novo Workspace</h2>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do workspace"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0891B2]" />
            <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="Slug (ex: clinica-carolina)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0891B2]" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              <button onClick={() => createTenant.mutate()} disabled={!newName.trim() || createTenant.isPending}
                className="px-4 py-2 text-sm bg-[#0891B2] text-white rounded-lg hover:bg-[#0E7490] disabled:opacity-40">
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
