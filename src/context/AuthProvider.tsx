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

const RECOVERY_STORAGE_KEY = 'tbh_password_recovery'

function getInitialRecoveryState(): boolean {
  try {
    return typeof window !== 'undefined' && sessionStorage.getItem(RECOVERY_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function setRecoveryStorageState(active: boolean) {
  try {
    if (typeof window !== 'undefined') {
      if (active) {
        sessionStorage.setItem(RECOVERY_STORAGE_KEY, 'true')
      } else {
        sessionStorage.removeItem(RECOVERY_STORAGE_KEY)
      }
    }
  } catch {
    // Ignorar fallos de almacenamiento en entornos restringidos
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [isRecoveringPassword, setIsRecoveringPassword] = useState<boolean>(getInitialRecoveryState)

  useEffect(() => {
    // SIGNED_IN se emite también al reenfocar la pestaña y TOKEN_REFRESHED es periódico:
    // se conserva la misma referencia de `user` mientras no cambie la identidad.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ? toAppUser(session.user) : null
      setUser((current) => (isSameUser(current, next) ? current : next))
      setStatus(next ? 'authenticated' : 'unauthenticated')

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true)
        setRecoveryStorageState(true)
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveringPassword(false)
        setRecoveryStorageState(false)
      }
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
      setIsRecoveringPassword(false)
      setRecoveryStorageState(false)
      // El alcance por defecto es global y cerraría la sesión en todos los dispositivos del usuario.
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) return { ok: false, message: getAuthErrorMessage(error) }
      return { ok: true }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    }
  }, [])

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      const redirectTo =
        typeof window !== 'undefined' &&
        window.location.origin &&
        !window.location.origin.startsWith('file:') &&
        window.location.origin !== 'null'
          ? window.location.origin
          : undefined

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      if (error) return { ok: false, message: getAuthErrorMessage(error) }
      return { ok: true }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    }
  }, [])

  const verifyRecoveryCode = useCallback(async (email: string, code: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      })
      if (error) return { ok: false, message: getAuthErrorMessage(error) }
      if (data.session) {
        setIsRecoveringPassword(true)
        setRecoveryStorageState(true)
      }
      return { ok: true }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    }
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return { ok: false, message: getAuthErrorMessage(error) }
      setIsRecoveringPassword(false)
      setRecoveryStorageState(false)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    }
  }, [])

  const cancelPasswordRecovery = useCallback(async (): Promise<void> => {
    setIsRecoveringPassword(false)
    setRecoveryStorageState(false)
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Ignorar fallos de cierre de sesión
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isRecoveringPassword,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      verifyRecoveryCode,
      updatePassword,
      cancelPasswordRecovery,
    }),
    [
      user,
      status,
      isRecoveringPassword,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      verifyRecoveryCode,
      updatePassword,
      cancelPasswordRecovery,
    ],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
