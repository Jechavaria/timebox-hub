import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.ts'
import { EnvConfigError } from './envConfigError.ts'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function readJwtRole(token: string): string | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const claims: unknown = JSON.parse(json)
    if (typeof claims === 'object' && claims !== null && 'role' in claims) {
      return typeof claims.role === 'string' ? claims.role : null
    }
    return null
  } catch {
    return null
  }
}

function collectEnvIssues(url: string | undefined, key: string | undefined): string[] {
  const issues: string[] = []

  if (!url) {
    issues.push('Falta VITE_SUPABASE_URL.')
  } else if (!isHttpUrl(url)) {
    issues.push('VITE_SUPABASE_URL no es una URL http(s) válida.')
  }

  if (!key) {
    issues.push('Falta VITE_SUPABASE_PUBLISHABLE_KEY (o VITE_SUPABASE_ANON_KEY).')
  } else if (key.startsWith('sb_secret_') || readJwtRole(key) === 'service_role') {
    issues.push(
      'La clave configurada es secreta (secret/service_role) y se publicaría en el navegador. Usa la publishable key.',
    )
  }

  return issues
}

const envIssues = collectEnvIssues(supabaseUrl, supabaseKey)

if (envIssues.length > 0 || !supabaseUrl || !supabaseKey) {
  throw new EnvConfigError(envIssues)
}

/** Cliente único de Supabase para toda la aplicación. */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
