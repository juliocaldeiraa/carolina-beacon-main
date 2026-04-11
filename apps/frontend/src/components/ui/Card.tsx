/**
 * Card — Componente container base (Dark UI)
 */

import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  glow?: boolean
}

const paddingClasses = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
}

export function Card({ hoverable, glow, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.07)] shadow-surface',
        'bg-gradient-to-br from-beacon-surface to-beacon-surface-2/40',
        hoverable && [
          'transition-all duration-300 cursor-pointer',
          'hover:border-[rgba(240,101,41,0.35)] hover:shadow-glow-sm',
          'hover:translate-y-[-1px]',
        ],
        glow && 'animate-glow',
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-white', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  )
}
