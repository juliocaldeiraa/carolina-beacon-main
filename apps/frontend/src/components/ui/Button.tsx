/**
 * Button — Healthcare design system
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
    'bg-[#10B981] text-white hover:bg-[#059669] active:bg-[#155E75] shadow-sm hover:shadow-md',
  secondary:
    'bg-white text-[#334155] border border-gray-200 hover:border-[#10B981]/30 hover:text-[#10B981] hover:bg-[#F0FDFA]',
  ghost:
    'bg-transparent text-[#64748B] hover:text-[#10B981] hover:bg-gray-50 active:bg-gray-100',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981]',
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
