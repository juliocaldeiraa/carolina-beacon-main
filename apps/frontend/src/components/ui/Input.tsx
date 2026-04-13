/**
 * Input — Healthcare design system
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
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3.5 py-2.5 text-sm text-[#134E4A] bg-white rounded-xl',
            'border border-gray-200',
            'transition-all duration-200',
            'placeholder:text-gray-300',
            'focus:outline-none focus:border-[#0891B2] focus:ring-2 focus:ring-[#0891B2]/10',
            error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
            props.disabled && 'opacity-40 cursor-not-allowed bg-gray-50',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-gray-400">{hint}</p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
