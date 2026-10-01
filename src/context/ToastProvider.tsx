import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ToastContext } from './toast-context.ts'
import type { ToastContextValue, ToastOptions, ToastVariant } from './toast-context.ts'
import { IconButton } from '../components/ui/IconButton.tsx'

interface ToastItem {
  id: string
  variant: ToastVariant
  title?: string
  message: string
}

const MAX_VISIBLE_TOASTS = 4

const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  info: 4500,
  success: 4500,
  warning: 6500,
  error: 8000,
}

const VARIANT_VISUALS: Record<ToastVariant, { icon: LucideIcon; iconClass: string }> = {
  info: { icon: Info, iconClass: 'text-accent' },
  success: { icon: CircleCheck, iconClass: 'text-success' },
  warning: { icon: TriangleAlert, iconClass: 'text-warning' },
  error: { icon: CircleAlert, iconClass: 'text-danger' },
}

// Contador simple: crypto.randomUUID no existe en contextos no seguros (HTTP en la red local).
let nextToastId = 0

interface ToastCardProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const { icon: Icon, iconClass } = VARIANT_VISUALS[toast.variant]

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className="glass-popover pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 p-3 pl-4"
    >
      <Icon className={clsx('mt-1.5 size-5 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1 py-1.5">
        {toast.title ? <p className="text-sm font-semibold text-ink">{toast.title}</p> : null}
        <p className="text-sm text-ink-muted">{toast.message}</p>
      </div>
      <IconButton label="Cerrar notificación" size="sm" onClick={() => onDismiss(toast.id)}>
        <X />
      </IconButton>
    </div>
  )
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      activeTimers.forEach((timerId) => window.clearTimeout(timerId))
      activeTimers.clear()
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    const timerId = timers.current.get(id)
    if (timerId !== undefined) {
      window.clearTimeout(timerId)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (options: ToastOptions): string => {
      nextToastId += 1
      const id = `toast-${nextToastId}`
      const variant = options.variant ?? 'info'
      const durationMs = options.durationMs ?? DEFAULT_DURATION_MS[variant]

      setToasts((current) =>
        [...current, { id, variant, title: options.title, message: options.message }].slice(
          -MAX_VISIBLE_TOASTS,
        ),
      )

      if (durationMs > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), durationMs),
        )
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      dismiss,
      info: (message, title) => notify({ variant: 'info', message, title }),
      success: (message, title) => notify({ variant: 'success', message, title }),
      warning: (message, title) => notify({ variant: 'warning', message, title }),
      error: (message, title) => notify({ variant: 'error', message, title }),
    }),
    [notify, dismiss],
  )

  return (
    <ToastContext value={value}>
      {children}
      {createPortal(
        <div
          role="region"
          aria-label="Notificaciones"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:p-6"
        >
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext>
  )
}
