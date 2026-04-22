/**
 * MainLayout — Estrutura principal da aplicação
 *
 * Spec: /Brand/Playbook de Layout e UX - Plataforma Beacon.md §3
 * Layout: Sidebar fixa (esq) + Header (topo) + Conteúdo principal
 * WCAG 2.1 AA: skip-to-content link, landmarks, aria-labels
 *
 * ┌─────────────────────────────────────────────────┐
 * │  HEADER                                         │
 * ├──────────┬──────────────────────────────────────┤
 * │  SIDEBAR │  MAIN CONTENT                        │
 * │  (dark)  │                            [FAB ●]  │
 * └──────────┴──────────────────────────────────────┘
 */

import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Sidebar }                from './Sidebar'
import { Header }                 from './Header'
import { ToastProvider }          from '@/components/ui/Toast'
import { AgentList }              from '@/features/agents/AgentList'
import { AgentDetail }            from '@/features/agents/AgentDetail'
import { AgentBuilder }           from '@/features/agents/AgentBuilder'
import { ObservabilityDashboard } from '@/features/observability/ObservabilityDashboard'
import { InsightsPage }           from '@/features/insights/InsightsPage'
import { Playground }             from '@/features/playground/Playground'
import { ChannelManager }         from '@/features/channels/ChannelManager'
// BroadcastManager removido — redirecionado para Campanhas
import { CampaignsPage }         from '@/features/campaigns/CampaignsPage'
import { CampaignCreatePage }    from '@/features/campaigns/CampaignCreatePage'
import { CampaignDetailPage }    from '@/features/campaigns/CampaignDetailPage'
import { CampaignFunnelPage }   from '@/features/campaigns/funnel/CampaignFunnelPage'
import { CrmPage }              from '@/features/crm/CrmPage'
import { WhatsAppCrmPage }      from '@/features/crm/WhatsAppCrmPage'
import { ConversationsPage }      from '@/features/conversations/ConversationsPage'
import { ContactsPage }          from '@/features/contacts/ContactsPage'
import { ContactDetail }         from '@/features/contacts/ContactDetail'
import { SettingsShell }          from '@/features/settings/SettingsShell'
import { AutomationDetail }       from '@/features/automations/AutomationDetail'
import { ChatIaPage }             from '@/features/chat-ia/ChatIaPage'
import { VendedorPage }           from '@/features/vendedor/VendedorPage'

// Mapa de meta por rota base (para o Header)
function usePageMeta(pathname: string) {
  if (pathname.startsWith('/agents/new'))   return { title: 'Novo Agente',            subtitle: 'Configure e publique um novo agente de IA' }
  if (pathname.match(/\/agents\/.+\/edit/)) return { title: 'Editar Agente',           subtitle: 'Atualize as configurações do agente' }
  if (pathname.match(/\/agents\/.+/))       return { title: 'Detalhes do Agente',      subtitle: 'Visualize e gerencie o agente' }
  if (pathname.startsWith('/agents'))       return { title: 'Gestão de Agentes',       subtitle: 'Crie, configure e monitore seus agentes de IA' }
  if (pathname.startsWith('/insights'))      return { title: 'Insights',               subtitle: 'Campanhas, Chat IA e saúde do sistema em tempo real' }
  if (pathname.startsWith('/observability'))return { title: 'Observabilidade',         subtitle: 'Performance, custos e qualidade em tempo real' }
  if (pathname.startsWith('/playground'))   return { title: 'Playground',              subtitle: 'Teste seus agentes em um ambiente seguro' }
  if (pathname.startsWith('/chat-ia'))      return { title: 'Chat IA',                 subtitle: 'Vincule canais a agentes e modelos LLM para IA conversacional' }
  if (pathname.startsWith('/channels'))     return { title: 'Canais',                  subtitle: 'Gerencie seus canais de mensagem e status de conexão' }
  if (pathname.startsWith('/conversations'))return { title: 'Conversas',               subtitle: 'Todas as conversas dos canais conectados em tempo real' }
  if (pathname.match(/\/contacts\/.+/))          return { title: 'Detalhe do Contato',      subtitle: 'Informações e histórico de conversas do contato' }
  if (pathname.startsWith('/contacts'))          return { title: 'Contatos',                subtitle: 'Banco de dados de todos os contatos abordados' }
  if (pathname.startsWith('/broadcast'))         return { title: 'Broadcast',               subtitle: 'Envio rápido de mensagens em massa' }
  if (pathname.startsWith('/campaigns/funnel'))   return { title: 'Funil de Conversão',       subtitle: 'Visualize a performance das suas campanhas' }
  if (pathname.match(/\/campaigns\/new/))        return { title: 'Nova Campanha',            subtitle: 'Crie uma campanha de disparo avançada' }
  if (pathname.match(/\/campaigns\/.+/))         return { title: 'Detalhes da Campanha',     subtitle: 'Leads, progresso, follow-ups e configurações' }
  if (pathname.startsWith('/campaigns'))         return { title: 'Campanhas',                subtitle: 'Gerencie campanhas de disparo com spintext, follow-ups e anti-ban' }
  if (pathname === '/crm/whatsapp')              return { title: 'CRM WhatsApp',              subtitle: 'Acompanhe leads do atendimento via WhatsApp' }
  if (pathname.startsWith('/crm'))              return { title: 'CRM',                      subtitle: 'Acompanhe a jornada dos leads no kanban de conversão' }
  if (pathname.match(/\/vendedor\/campanhas\/.+/)) return { title: 'Detalhe da Campanha',  subtitle: 'Configurações, métricas e logs de execução' }
  if (pathname.startsWith('/vendedor'))          return { title: 'Vendedor',                subtitle: 'Agente ativo de vendas: disparos, leads e CRM em um só lugar' }
  if (pathname.match(/\/automations\/.+/))       return { title: 'Detalhe da Campanha',    subtitle: 'Configurações, métricas e logs de execução' }
  if (pathname.startsWith('/settings'))          return { title: 'Configurações',           subtitle: 'Perfil, equipe, provedores de IA, webhooks e integrações' }
  return { title: 'VoxAI', subtitle: '' }
}

export function MainLayout() {
  const { pathname } = useLocation()
  const meta = usePageMeta(pathname)

  return (
    <ToastProvider>
      {/*
       * Skip-to-content link — WCAG 2.1 SC 2.4.1 (Bypass Blocks)
       * Visível apenas ao receber foco (teclado). Permite pular a navegação lateral.
       */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]
                   focus:bg-beacon-primary focus:text-white focus:px-4 focus:py-2
                   focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Ir para o conteúdo principal
      </a>

      <div className="min-h-screen bg-[#F5FAFA]">
        <Sidebar />
        <Header title={meta.title} subtitle={meta.subtitle} />

        <main
          className="ml-[260px] pt-16 min-h-screen"
          id="main-content"
          aria-label={meta.title}
        >
          <div className="p-6">
            <Routes>
              {/* Agentes */}
              <Route path="/agents"           element={<AgentList />} />
              <Route path="/agents/new"       element={<AgentBuilder mode="create" />} />
              <Route path="/agents/:id"       element={<AgentDetail />} />
              <Route path="/agents/:id/edit"  element={<AgentBuilder mode="edit" />} />

              {/* Insights */}
              <Route path="/insights"         element={<InsightsPage />} />
              <Route path="/observability"    element={<ObservabilityDashboard />} />

              {/* Playground */}
              <Route path="/playground"       element={<Playground />} />

              {/* Chat IA */}
              <Route path="/chat-ia"          element={<ChatIaPage />} />

              {/* Canais */}
              <Route path="/channels"         element={<ChannelManager />} />

              {/* Conversas */}
              <Route path="/conversations"    element={<ConversationsPage />} />

              {/* Contatos */}
              <Route path="/contacts"         element={<ContactsPage />} />
              <Route path="/contacts/:id"     element={<ContactDetail />} />

              {/* Broadcast redireciona para Campanhas */}
              <Route path="/broadcast"        element={<Navigate to="/campaigns" replace />} />

              {/* Campanhas (disparo avançado) */}
              <Route path="/campaigns"        element={<CampaignsPage />} />
              <Route path="/campaigns/new"    element={<CampaignCreatePage />} />
              <Route path="/campaigns/funnel" element={<CampaignFunnelPage />} />
              <Route path="/campaigns/:id"    element={<CampaignDetailPage />} />

              {/* Vendedor (substitui Automações + CRM standalone) */}
              <Route path="/vendedor"                    element={<VendedorPage />} />
              <Route path="/vendedor/campanhas/:id"      element={<AutomationDetail />} />

              {/* Redirects de backward compat */}
              <Route path="/automations"      element={<Navigate to="/vendedor" replace />} />
              <Route path="/automations/:id"  element={<Navigate to="/vendedor" replace />} />
              {/* CRM Kanban */}
              <Route path="/crm"              element={<CrmPage />} />
              <Route path="/crm/whatsapp"     element={<WhatsAppCrmPage />} />

              {/* Configurações — SettingsShell com sub-nav interno */}
              <Route path="/settings/*"       element={<SettingsShell />} />

              {/* Default */}
              <Route path="/"                 element={<Navigate to="/agents" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
