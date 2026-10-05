import { createContext } from 'react'
import type { AuthResult, AuthStatus, Credentials, SignOutResult, User } from '../types/domain.ts'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  isRecoveringPassword: boolean
  signIn: (credentials: Credentials) => Promise<AuthResult>
  signUp: (credentials: Credentials) => Promise<AuthResult>
  signOut: () => Promise<SignOutResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  verifyRecoveryCode: (email: string, code: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  cancelPasswordRecovery: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
