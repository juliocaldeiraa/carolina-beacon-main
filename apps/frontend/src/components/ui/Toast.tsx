/**
 * Toast — Healthcare design system
 */

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationsStore } from '@/store/useNotificationsStore'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextValue {
  toast: (opts: Omit<ToastMessage, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const typeConfig = {
  success: {
    icon: CheckCircle,
    border: 'border-l-emerald-500',
    iconColor: 'text-emerald-500',
    bg: 'bg-emerald-50',
  },
  error: {
    icon: XCircle,
    border: 'border-l-red-500',
    iconColor: 'text-red-500',
    bg: 'bg-red-50',
  },
  info: {
    icon: Info,
    border: 'border-l-[#10B981]',
    iconColor: 'text-[#10B981]',
    bg: 'bg-sky-50',
  },
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const config = typeConfig[toast.type]
  const Icon = config.icon

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 bg-white rounded-xl shadow-lg p-4',
        'border border-gray-100 border-l-4 min-w-[300px] max-w-[400px]',
        config.border,
      )}
    >
      <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#064E3B]">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-500 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...opts, id }])
    useNotificationsStore.getState().add(opts)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
