/**
 * Input — Campo de formulário (Dark UI)
 */

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-white/70">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 text-sm text-white/85 bg-beacon-surface rounded-lg',
            'border border-[rgba(255,255,255,0.08)]',
            'transition-all duration-200',
            'placeholder:text-white/25',
            'focus:outline-none focus:border-[#00b4d8]/60 focus:shadow-[0_0_0_3px_rgba(0,180,216,0.10)]',
            error && 'border-red-500/60 focus:border-red-500/80 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.10)]',
            props.disabled && 'opacity-40 cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-white/40">{hint}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
