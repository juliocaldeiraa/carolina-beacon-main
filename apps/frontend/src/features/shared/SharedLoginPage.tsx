/**
 * SharedLoginPage — Login de acesso externo ao CRM (/shared)
 *
 * Consome POST /auth/shared-login com as credenciais geradas em
 * CRM → Acessos Compartilhados. Guarda o token (role SHARED) no
 * localStorage e segue para /shared/crm. Não usa o store de auth
 * principal — é uma sessão isolada, escopada a UMA campanha.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { api } from '@/services/api'

export function SharedLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/shared-login', { username, password })
      localStorage.setItem('sharedToken', res.data.accessToken)
      localStorage.setItem('sharedCampaignId', res.data.campaignId)
      localStorage.setItem('sharedLabel', res.data.label ?? '')
      navigate('/shared/crm')
    } catch {
      setError('Usuário ou senha inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#10B981] rounded-xl shadow-lg mx-auto">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[#064E3B]">Acesso ao Atendimento</h1>
          <p className="text-sm text-gray-500">Entre com as credenciais fornecidas</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]"
              placeholder="acesso-xxxxxx"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#10B981] hover:bg-[#059669] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
