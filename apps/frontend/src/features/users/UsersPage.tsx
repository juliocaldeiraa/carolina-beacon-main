/**
 * UsersPage — Gerenciamento de usuários e permissões
 * Acessível apenas para ADMIN
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Plus, Trash2, Edit2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import {
  useUsers, useCreateUser, useUpdateUserRole, useDeleteUser,
} from './hooks/useUsers'
import type { UserRole } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; variant: 'active' | 'default' | 'draft' | 'error' }> = {
  ADMIN:     { label: 'Admin',     variant: 'error' },
  EQUIPE:    { label: 'Equipe',    variant: 'active' },
  SUPORTE:   { label: 'Suporte',   variant: 'default' },
  COMERCIAL: { label: 'Comercial', variant: 'draft' },
}

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'EQUIPE', 'SUPORTE', 'COMERCIAL']

// ─── Create user form ──────────────────────────────────────────────────────────

const createSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role:     z.enum(['ADMIN', 'EQUIPE', 'SUPORTE', 'COMERCIAL']),
})
type CreateFormValues = z.infer<typeof createSchema>

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const { mutate: create, isPending } = useCreateUser()

  const { register, handleSubmit, formState: { errors } } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'EQUIPE' },
  })

  function onSubmit(values: CreateFormValues) {
    create(values, { onSuccess: onClose })
  }

  const labelClass = 'block text-xs font-medium text-beacon-black mb-1'
  const inputClass = cn(
    'w-full text-sm border border-beacon-gray rounded-lg px-3 py-2',
    'focus:outline-none focus:ring-2 focus:ring-beacon-primary-hover',
    'placeholder:text-[#bbb]',
  )
  const errorClass = 'text-xs text-red-500 mt-1'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="u-email" className={labelClass}>Email *</label>
        <input id="u-email" type="email" {...register('email')} className={inputClass} placeholder="usuario@empresa.com" />
        {errors.email && <p className={errorClass}>{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="u-password" className={labelClass}>Senha *</label>
        <input id="u-password" type="password" {...register('password')} className={inputClass} placeholder="Mínimo 6 caracteres" />
        {errors.password && <p className={errorClass}>{errors.password.message}</p>}
      </div>

      <div>
        <label htmlFor="u-role" className={labelClass}>Perfil de acesso *</label>
        <select id="u-role" {...register('role')} className={inputClass}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isPending}>
          Criar Usuário
        </Button>
      </div>
    </form>
  )
}

// ─── Edit role inline ──────────────────────────────────────────────────────────

function RoleSelector({ userId, current }: { userId: string; current: UserRole }) {
  const { mutate: updateRole, isPending } = useUpdateUserRole()
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={ROLE_CONFIG[current].variant}>
          {ROLE_CONFIG[current].label}
        </Badge>
        <button
          onClick={() => setEditing(true)}
          className="text-[#999] hover:text-beacon-black transition-colors"
          aria-label="Alterar perfil"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <select
      autoFocus
      defaultValue={current}
      disabled={isPending}
      className="text-sm border border-beacon-gray rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-beacon-primary-hover"
      onChange={(e) => {
        updateRole(
          { id: userId, role: e.target.value as UserRole },
          { onSuccess: () => setEditing(false), onError: () => setEditing(false) },
        )
      }}
      onBlur={() => setEditing(false)}
    >
      {ROLE_OPTIONS.map((r) => (
        <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
      ))}
    </select>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function UsersPage() {
  const { data: users, isLoading } = useUsers()
  const { mutate: deleteUser } = useDeleteUser()
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-beacon-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-beacon-black">
            {users?.length ?? 0} usuário{(users?.length ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Novo Usuário
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-card border border-beacon-gray shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-beacon-gray rounded animate-pulse" />
            ))}
          </div>
        ) : users?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-beacon-gray flex items-center justify-center">
              <Users className="w-7 h-7 text-[#999]" />
            </div>
            <p className="text-sm font-semibold text-beacon-black">Nenhum usuário cadastrado</p>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Criar Primeiro Usuário
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beacon-gray bg-beacon-gray/30">
                <th className="text-left px-4 py-3 font-semibold text-beacon-black">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-beacon-black">Perfil</th>
                <th className="text-left px-4 py-3 font-semibold text-beacon-black">Cadastrado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users!.map((u) => (
                <tr key={u.id} className="border-b border-beacon-gray/50 hover:bg-beacon-gray/20 transition-colors">
                  <td className="px-4 py-3 text-beacon-black font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <RoleSelector userId={u.id} current={u.role} />
                  </td>
                  <td className="px-4 py-3 text-[#666]">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmDelete === u.id ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(null)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          className="!bg-red-500 hover:!bg-red-600"
                          onClick={() => {
                            deleteUser(u.id)
                            setConfirmDelete(null)
                          }}
                        >
                          Confirmar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(u.id)}
                        className="text-red-500 hover:bg-red-50"
                        aria-label={`Remover ${u.email}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Novo Usuário"
        description="Crie um acesso para um membro da equipe"
        size="md"
      >
        <CreateUserForm onClose={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}
