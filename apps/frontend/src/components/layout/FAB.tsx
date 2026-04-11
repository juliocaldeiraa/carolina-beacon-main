/**
 * FAB — Floating Action Button
 *
 * Spec: /Brand/Playbook de Layout e UX - Plataforma Beacon.md §3.3
 * - position: fixed, bottom 24px, right 24px
 * - bg: #f06529
 * - hover: bg #e34c26
 * - icon: #ffffff
 * - size: 56px, border-radius: 50%
 * - shadow: 0 4px 12px rgba(240,101,41,0.4)
 */

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FABProps {
  onClick: () => void
  label?: string
  className?: string
}

export function FAB({ onClick, label = 'Criar novo', className }: FABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'w-14 h-14 rounded-full',
        'bg-beacon-primary hover:bg-beacon-primary-hover active:bg-beacon-primary-hover',
        'text-white shadow-fab shadow-glow animate-glow',
        'flex items-center justify-center',
        'transition-all duration-300',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beacon-primary-hover',
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Plus className="w-6 h-6" aria-hidden="true" />
    </button>
  )
}
