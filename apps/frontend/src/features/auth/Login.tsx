/**
 * Login — Página de autenticação
 *
 * Brand compliance:
 * - Fundo: #ffffff
 * - Botão primário: #f06529
 * - Focus: #e34c26
 * - Texto: #000000
 * - Tipografia: Inter
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Bot, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/useAuthStore'
import { authService } from '@/services/auth'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

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
      navigate('/agents')
    } catch {
      setError('root', { message: 'E-mail ou senha incorretos.' })
    }
  }

  return (
    <div className="min-h-screen bg-beacon-gray/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-beacon-black rounded-2xl flex items-center justify-center mb-4 shadow-card-hover">
            <Bot className="w-9 h-9 text-beacon-primary" />
          </div>
          <h1 className="text-2xl font-bold text-beacon-black">Beacon Platform</h1>
          <p className="text-sm text-[#666] mt-1">Plataforma de IA Conversacional</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-card border border-beacon-gray shadow-card p-8">
          <h2 className="text-lg font-semibold text-beacon-black mb-6">Entrar na plataforma</h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            {errors.root && (
              <div
                role="alert"
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {errors.root.message}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full mt-2"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#999] mt-6 flex items-center justify-center gap-1">
          <Zap className="w-3 h-3 text-beacon-primary" aria-hidden="true" />
          Powered by Beacon AI Platform
        </p>
      </div>
    </div>
  )
}
