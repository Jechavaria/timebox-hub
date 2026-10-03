import { useContext } from 'react'
import { AppearanceContext } from '../context/appearance-context.ts'
import type { AppearanceContextValue } from '../context/appearance-context.ts'

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance debe usarse dentro de <AppearanceProvider>')
  return context
}
