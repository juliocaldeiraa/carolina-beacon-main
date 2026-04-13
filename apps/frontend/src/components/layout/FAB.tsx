/**
 * FAB — Floating Action Button (Healthcare)
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
        'w-14 h-14 rounded-2xl',
        'bg-gradient-to-br from-[#0891B2] to-[#0E7490]',
        'text-white shadow-lg shadow-[#0891B2]/25',
        'flex items-center justify-center',
        'transition-all duration-200',
        'hover:shadow-xl hover:shadow-[#0891B2]/30 hover:scale-105',
        'active:scale-95',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0891B2]',
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Plus className="w-6 h-6" aria-hidden="true" />
    </button>
  )
}
