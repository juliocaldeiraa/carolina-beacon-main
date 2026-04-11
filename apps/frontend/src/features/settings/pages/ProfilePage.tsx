/**
 * ProfilePage — Perfil pessoal do usuário logado
 * Permite editar o nome e alterar a senha
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { User, Lock, Save, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useProfile, useUpdateProfile, useChangePassword } from '../hooks/useSettings'

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { mutate, isPending } = useChangePassword()
  const { toast } = useToast()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<{
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }>()

  const onSubmit = handleSubmit((data) => {
    if (data.newPassword !== data.confirmPassword) return
    mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword }, {
      onSuccess: () => {
        toast({ type: 'success', title: 'Senha alterada com sucesso' })
        reset()
        onClose()
      },
      onError: (err: any) => {
        toast({ type: 'error', title: err?.response?.data?.message ?? 'Erro ao alterar senha' })
      },
    })
  })

  const newPwd = watch('newPassword', '')

  return (
    <Modal open title="Alterar Senha" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 w-80">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Senha atual</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              {...register('currentPassword', { required: true })}
              className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Nova senha</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              {...register('newPassword', { required: true, minLength: 6 })}
              className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.newPassword && <p className="text-xs text-red-500 mt-1">Mínimo 6 caracteres</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-1">Confirmar nova senha</label>
          <input
            type="password"
            {...register('confirmPassword', {
              required: true,
              validate: (v) => v === newPwd || 'As senhas não coincidem',
            })}
            className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
          />
          {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={isPending}>Alterar</Button>
        </div>
      </form>
    </Modal>
  )
}

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile()
  const { mutate: updateProfile, isPending } = useUpdateProfile()
  const { toast } = useToast()
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const { register, handleSubmit, reset } = useForm<{ name: string }>()

  const onSubmit = handleSubmit((data) => {
    updateProfile({ name: data.name }, {
      onSuccess: () => toast({ type: 'success', title: 'Perfil atualizado' }),
      onError: () => toast({ type: 'error', title: 'Erro ao atualizar perfil' }),
    })
  })

  if (isLoading) return <div className="h-40 bg-white/8 animate-pulse rounded-xl" />

  return (
    <div className="max-w-lg space-y-6">
      {/* Identidade */}
      <div className="bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-beacon-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-beacon-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Informações pessoais</h3>
            <p className="text-xs text-white/50">Gerencie seu nome de exibição</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">E-mail</label>
            <input
              type="text"
              value={profile?.email ?? ''}
              disabled
              className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm bg-white/8 text-white/50 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Nome</label>
            <input
              type="text"
              defaultValue={profile?.name ?? ''}
              {...register('name')}
              placeholder="Seu nome"
              className="w-full border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)] placeholder:text-white/25 bg-beacon-surface text-white/85"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={isPending} size="sm">
              <Save className="w-3.5 h-3.5" />
              Salvar
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => reset()}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>

      {/* Segurança */}
      <div className="bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center">
              <Lock className="w-5 h-5 text-white/50" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Senha</h3>
              <p className="text-xs text-white/50">Altere sua senha de acesso</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowPasswordModal(true)}>
            Alterar senha
          </Button>
        </div>
      </div>

      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  )
}
