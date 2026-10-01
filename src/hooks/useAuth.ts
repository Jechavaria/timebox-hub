import { useContext } from 'react'
import { AuthContext } from '../context/auth-context.ts'
import type { AuthContextValue } from '../context/auth-context.ts'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return context
}
