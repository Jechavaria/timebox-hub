import { createContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastOptions {
  message: string
  title?: string
  variant?: ToastVariant
  /** 0 mantiene la notificación hasta que el usuario la cierre. */
  durationMs?: number
}

export interface ToastContextValue {
  notify: (options: ToastOptions) => string
  info: (message: string, title?: string) => string
  success: (message: string, title?: string) => string
  warning: (message: string, title?: string) => string
  error: (message: string, title?: string) => string
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
