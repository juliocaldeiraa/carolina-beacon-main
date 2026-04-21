/**
 * Header — Top bar with workspace selector
 */

import { useState } from 'react'
import { LogOut, Settings, ChevronDown, Plus, Building2, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore, type NicheKey } from '@/store/useAuthStore'
import { NotificationsPanel } from './NotificationsPanel'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

const NICHE_OPTIONS: { key: NicheKey; label: string; description: string }[] = [
  { key: 'healthcare', label: 'Saúde / Clínicas',       description: 'Funil com agendamento, confirmação e comparecimento' },
  { key: 'launch',     label: 'Lançamento / Infoproduto', description: 'Interesse, aquecimento, check-in, compra' },
  { key: 'services',   label: 'Serviços / Consultoria', description: 'Lead, qualificação, proposta, negociação, fechado' },
  { key: 'generic',    label: 'Genérico',               description: 'Funil simples pra qualquer negócio' },
]

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
  const [newNiche, setNewNiche] = useState<NicheKey>('healthcare')

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
    mutationFn: () => api.post('/auth/tenants', {
      name: newName,
      slug: newSlug || newName.toLowerCase().replace(/\s+/g, '-'),
      niche: newNiche,
    }).then((r) => r.data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      setNewName('')
      setNewSlug('')
      setNewNiche('healthcare')
      setShowCreate(false)
      switchTenant.mutate(data.id)
    },
  })

  const deleteTenant = useMutation({
    mutationFn: (tenantId: string) => api.delete(`/auth/tenants/${tenantId}`).then((r) => r.data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      if (data.accessToken && data.tenant) {
        setToken(data.accessToken)
        setActiveTenant(data.tenant)
      }
      qc.invalidateQueries()
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message ?? 'Erro ao excluir workspace')
    },
  })

  function handleDelete(tenantId: string, tenantName: string, e: React.MouseEvent) {
    e.stopPropagation()
    const confirmed = window.confirm(
      `Excluir o workspace "${tenantName}"?\n\nOs dados permanecem no banco, mas o workspace deixa de ficar visível. Esta ação não pode ser desfeita pela interface.`,
    )
    if (confirmed) deleteTenant.mutate(tenantId)
  }

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
                    <div
                      key={t.id}
                      className={cn(
                        'group w-full flex items-center gap-2 pl-4 pr-2 py-2.5 text-sm transition-colors',
                        activeTenant?.id === t.id ? 'bg-[#0891B2]/10 text-[#0891B2] font-medium' : 'text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      <button
                        onClick={() => switchTenant.mutate(t.id)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t.name}</span>
                      </button>
                      {(tenants as any[]).length > 1 && (
                        <button
                          onClick={(e) => handleDelete(t.id, t.name, e)}
                          disabled={deleteTenant.isPending}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                          title="Excluir workspace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[#134E4A]">Novo Workspace</h2>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do workspace"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0891B2]" />
            <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="Slug (ex: clinica-carolina)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0891B2]" />

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nicho</label>
              <p className="text-xs text-gray-400">Define o funil do CRM e agentes recomendados. Não muda depois.</p>
              <div className="space-y-2">
                {NICHE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setNewNiche(option.key)}
                    className={cn(
                      'w-full text-left border rounded-xl p-3 transition-all',
                      newNiche === option.key
                        ? 'border-[#0891B2] bg-[#0891B2]/5'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        newNiche === option.key ? 'border-[#0891B2]' : 'border-gray-300',
                      )}>
                        {newNiche === option.key && <div className="w-2 h-2 rounded-full bg-[#0891B2]" />}
                      </div>
                      <span className="text-sm font-medium text-[#134E4A]">{option.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-6">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

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
