/**
 * Badge — Healthcare design system
 */

import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'notification' | 'active' | 'paused' | 'draft' | 'error'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default:      'bg-gray-100 text-gray-600 border border-gray-200',
  notification: 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20',
  active:       'bg-emerald-50 text-emerald-700 border border-emerald-200',
  paused:       'bg-amber-50 text-amber-700 border border-amber-200',
  draft:        'bg-sky-50 text-sky-700 border border-sky-200',
  error:        'bg-red-50 text-red-600 border border-red-200',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
