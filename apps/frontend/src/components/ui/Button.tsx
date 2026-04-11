/**
 * Button — Componente primário de ação (Dark UI)
 */

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-beacon-primary text-white hover:bg-beacon-primary-hover active:bg-beacon-primary-hover shadow-glow-sm hover:shadow-glow focus-visible:outline-beacon-primary-hover',
  secondary:
    'bg-beacon-surface-2 text-white/80 border border-[rgba(255,255,255,0.1)] hover:border-beacon-primary/40 hover:text-white focus-visible:outline-beacon-primary-hover',
  ghost:
    'bg-transparent text-white/60 hover:text-white hover:bg-white/5 active:bg-white/10 focus-visible:outline-beacon-primary-hover',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-[0_0_12px_rgba(239,68,68,0.3)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] focus-visible:outline-red-600',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          isDisabled && 'opacity-40 cursor-not-allowed pointer-events-none shadow-none',
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
