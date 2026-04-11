/**
 * VendedorPage — Agente ativo de vendas
 *
 * 3 tabs: Campanhas | Leads | CRM
 * - Campanhas: motor de disparo (AutomationsPage)
 * - Leads: tabela paginada de lead_many_insta (read-only)
 * - CRM: Kanban board (CrmPage)
 */

import { useState } from 'react'
import { Zap, Users, LayoutGrid } from 'lucide-react'
import { AutomationsPage } from '@/features/automations/AutomationsPage'
import { CrmPage }         from '@/features/crm/CrmPage'
import { LeadsTab }        from './LeadsTab'
import { cn }              from '@/lib/utils'

type Tab = 'campanhas' | 'leads' | 'crm'

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'campanhas', label: 'Campanhas', Icon: Zap },
  { id: 'leads',     label: 'Leads',     Icon: Users },
  { id: 'crm',       label: 'CRM',       Icon: LayoutGrid },
]

export function VendedorPage() {
  const [tab, setTab] = useState<Tab>('campanhas')

  return (
    <div className="flex flex-col gap-6">
      {/* Tab nav */}
      <div className="flex gap-1 bg-white/6 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === id
                ? 'bg-beacon-surface-2 text-white shadow-sm'
                : 'text-white/50 hover:text-white',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'campanhas' && <AutomationsPage />}
      {tab === 'leads'     && <LeadsTab />}
      {tab === 'crm'       && <CrmPage />}
    </div>
  )
}
