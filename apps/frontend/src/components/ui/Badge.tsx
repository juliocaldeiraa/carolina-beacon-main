/**
 * Badge — Indicador de status/contagem (Dark UI)
 */

import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'notification' | 'active' | 'paused' | 'draft' | 'error'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default:      'bg-white/8 text-white/70 border border-white/10',
  notification: 'bg-beacon-primary/20 text-[#f06529] border border-beacon-primary/30',
  active:       'bg-green-500/15 text-green-400 border border-green-500/20',
  paused:       'bg-white/6 text-white/50 border border-white/10',
  draft:        'bg-[#00b4d8]/15 text-[#00b4d8] border border-[#00b4d8]/20',
  error:        'bg-red-500/15 text-red-400 border border-red-500/20',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
