/**
 * Modal — Diálogo de confirmação e conteúdo (Dark UI)
 */

import { useEffect, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={cn(
        'w-full bg-beacon-surface rounded-xl border border-[rgba(255,255,255,0.08)]',
        'shadow-[0_16px_64px_rgba(0,0,0,0.7)]',
        sizeMap[size],
      )}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-white">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-white/50 mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors ml-4 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {children && (
          <div className="px-6 pb-6">{children}</div>
        )}
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger'
  loading?: boolean
}

export function ConfirmModal({
  open, onClose, onConfirm,
  title, description,
  confirmLabel = 'Confirmar',
  confirmVariant = 'primary',
  loading,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
