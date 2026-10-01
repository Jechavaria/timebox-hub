import { useContext } from 'react'
import { ToastContext } from '../context/toast-context.ts'
import type { ToastContextValue } from '../context/toast-context.ts'

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>')
  }
  return context
}
