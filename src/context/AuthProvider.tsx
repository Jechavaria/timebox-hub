import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { AuthContext } from './auth-context.ts'
import type { AuthContextValue } from './auth-context.ts'
import { getAuthErrorMessage } from '../lib/authErrors.ts'
import { supabase } from '../lib/supabase.ts'
import type { AuthResult, AuthStatus, Credentials, SignOutResult, User } from '../types/domain.ts'

function toAppUser(user: SupabaseUser): User {
  return { id: user.id, email: user.email ?? null }
}

function isSameUser(a: User | null, b: User | null): boolean {
  if (a === null || b === null) return a === b
  return a.id === b.id && a.email === b.email
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    // SIGNED_IN se emite también al reenfocar la pestaña y TOKEN_REFRESHED es periódico:
    // se conserva la misma referencia de `user` mientras no cambie la identidad.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ? toAppUser(session.user) : null
      setUser((current) => (isSameUser(current, next) ? current : next))
      setStatus(next ? 'authenticated' : 'unauthenticated')
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async ({ email, password }: Credentials): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { ok: false, message: getAuthErrorMessage(error) }
      return { ok: true, needsEmailConfirmation: false }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    }
  }, [])

  const signUp = useCallback(async ({ email, password }: Credentials): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { ok: false, message: getAuthErrorMessage(error) }
      return { ok: true, needsEmailConfirmation: data.session === null }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    }
  }, [])

  const signOut = useCallback(async (): Promise<SignOutResult> => {
    try {
      // El alcance por defecto es global y cerraría la sesión en todos los dispositivos del usuario.
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) return { ok: false, message: getAuthErrorMessage(error) }
      return { ok: true }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, signIn, signUp, signOut }),
    [user, status, signIn, signUp, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
