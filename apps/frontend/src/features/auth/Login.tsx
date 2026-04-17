/**
 * Login — Healthcare-themed authentication page
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Heart, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { authService } from '@/services/auth'
import { api } from '@/services/api'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const { setAuth, setActiveTenant } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    try {
      const response = await authService.login(data)
      setAuth({
        token:        response.accessToken,
        refreshToken: response.refreshToken,
        user:         response.user,
      })
      // Buscar tenant info e setar como ativo
      try {
        const tenants = await api.get('/auth/tenants').then((r) => r.data)
        if (tenants.length > 0) {
          const userTenant = tenants.find((t: any) => t.id === response.user.tenantId) ?? tenants[0]
          setActiveTenant({ id: userTenant.id, name: userTenant.name, slug: userTenant.slug })
        }
      } catch {}
      navigate('/agents')
    } catch {
      setError('root', { message: 'E-mail ou senha incorretos.' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDFA] via-white to-[#CFFAFE] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0891B2] to-[#0E7490] rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-[#0891B2]/20">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#134E4A]">Carolina Beacon</h1>
          <p className="text-sm text-gray-500 mt-1.5">Plataforma de IA para Saúde</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100/50 p-8">
          <h2 className="text-lg font-heading font-semibold text-[#134E4A] mb-1">Bem-vindo de volta</h2>
          <p className="text-sm text-gray-400 mb-6">Entre com suas credenciais para acessar a plataforma.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                {...register('email')}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#134E4A]
                           placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0891B2] focus:border-transparent
                           transition-all duration-200"
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Senha</label>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#134E4A]
                           placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0891B2] focus:border-transparent
                           transition-all duration-200"
              />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {errors.root && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold
                         bg-gradient-to-r from-[#0891B2] to-[#0E7490] text-white
                         hover:from-[#0E7490] hover:to-[#155E75] transition-all duration-200
                         shadow-md shadow-[#0891B2]/20 hover:shadow-lg hover:shadow-[#0891B2]/30
                         disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? 'Entrando...' : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8 flex items-center justify-center gap-1.5">
          <Heart className="w-3 h-3 text-[#0891B2]" />
          Powered by Carolina Beacon AI
        </p>
      </div>
    </div>
  )
}
