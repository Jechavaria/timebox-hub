import { createContext } from 'react'
import type { AuthResult, AuthStatus, Credentials, SignOutResult, User } from '../types/domain.ts'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  signIn: (credentials: Credentials) => Promise<AuthResult>
  signUp: (credentials: Credentials) => Promise<AuthResult>
  signOut: () => Promise<SignOutResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
