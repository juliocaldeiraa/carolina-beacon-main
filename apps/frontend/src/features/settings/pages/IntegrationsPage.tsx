/**
 * IntegrationsPage — Grid visual de integrações disponíveis
 * Fase atual: somente cards informativos (sem backend)
 */

import { ExternalLink, ArrowRight, Smartphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

interface IntegrationCard {
  name: string
  description: string
  category: string
  status: 'connected' | 'available' | 'coming_soon'
  action?: 'link' | 'external'
  actionTo?: string
  icon: string
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    name: 'WhatsApp (Evolution API)',
    description: 'Conecte números de WhatsApp via Evolution API para receber e enviar mensagens automaticamente.',
    category: 'Mensageria',
    status: 'available',
    action: 'link',
    actionTo: '/channels',
    icon: '💬',
  },
  {
    name: 'WhatsApp (Z-API)',
    description: 'Integração com Z-API para WhatsApp Business.',
    category: 'Mensageria',
    status: 'available',
    action: 'link',
    actionTo: '/channels',
    icon: '💬',
  },
  {
    name: 'Telegram',
    description: 'Conecte bots do Telegram para atendimento e automação.',
    category: 'Mensageria',
    status: 'available',
    action: 'link',
    actionTo: '/channels',
    icon: '✈️',
  },
  {
    name: 'Instagram',
    description: 'Responda mensagens diretas do Instagram com IA.',
    category: 'Mensageria',
    status: 'available',
    action: 'link',
    actionTo: '/channels',
    icon: '📸',
  },
  {
    name: 'Pipedrive',
    description: 'Sincronize leads e negócios com seu pipeline do Pipedrive.',
    category: 'CRM',
    status: 'coming_soon',
    icon: '🔗',
  },
  {
    name: 'HubSpot',
    description: 'Integre contatos, deals e automações com o HubSpot.',
    category: 'CRM',
    status: 'coming_soon',
    icon: '🟠',
  },
  {
    name: 'Calendly',
    description: 'Permita que a IA agende reuniões diretamente no Calendly.',
    category: 'Produtividade',
    status: 'coming_soon',
    icon: '📅',
  },
  {
    name: 'Google Sheets',
    description: 'Exporte dados de conversas e métricas para planilhas Google.',
    category: 'Produtividade',
    status: 'coming_soon',
    icon: '📊',
  },
]

const STATUS_CONFIG = {
  connected:    { label: 'Conectado',    className: 'bg-green-100 text-green-700' },
  available:    { label: 'Disponível',   className: 'bg-blue-100 text-blue-700' },
  coming_soon:  { label: 'Em breve',     className: 'bg-white/8 text-white/50' },
}

const categories = [...new Set(INTEGRATIONS.map((i) => i.category))]

export function IntegrationsPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <p className="text-xs text-white/50">
        Conecte o VoxAI com suas ferramentas favoritas. Canais de mensagem são configurados em{' '}
        <button onClick={() => navigate('/channels')} className="text-beacon-primary hover:underline font-medium">
          Canais
        </button>.
      </p>

      {categories.map((category) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INTEGRATIONS.filter((i) => i.category === category).map((integration) => {
              const status = STATUS_CONFIG[integration.status]
              const isComingSoon = integration.status === 'coming_soon'

              return (
                <div
                  key={integration.name}
                  className="bg-beacon-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-4 flex gap-4"
                >
                  <div className="text-2xl shrink-0">{integration.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{integration.name}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mb-3 leading-relaxed">{integration.description}</p>
                    {!isComingSoon && integration.action === 'link' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(integration.actionTo!)}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        Configurar canal
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {!isComingSoon && integration.action === 'external' && (
                      <Button size="sm" variant="secondary">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Conectar
                      </Button>
                    )}
                    {isComingSoon && (
                      <span className="text-[10px] text-white/40">Disponível em breve</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
