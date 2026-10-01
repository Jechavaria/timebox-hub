import { useId, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import clsx from 'clsx'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.ts'
import { MIN_PASSWORD_LENGTH } from '../../lib/constants.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'

type AuthMode = 'login' | 'register'

const AUTH_MODES: readonly AuthMode[] = ['login', 'register']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MODE_COPY: Record<AuthMode, { tab: string; submit: string; description: string }> = {
  login: {
    tab: 'Iniciar sesión',
    submit: 'Entrar',
    description: 'Entra para ver tu matriz de tareas y tu agenda.',
  },
  register: {
    tab: 'Crear cuenta',
    submit: 'Crear cuenta',
    description: 'Crea tu cuenta: tus datos son privados y solo tú puedes verlos.',
  },
}

const ignoreClose = () => undefined

function validateCredentials(mode: AuthMode, email: string, password: string): string | null {
  if (email === '') return 'Ingresa tu correo.'
  if (!EMAIL_PATTERN.test(email)) return 'El correo no es válido.'
  if (password === '') return 'Ingresa tu contraseña.'
  if (mode === 'register' && password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  return null
}

export function AuthModal() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const uid = useId()
  const emailId = `${uid}-email`
  const passwordId = `${uid}-password`
  const errorId = `${uid}-error`
  const panelId = `${uid}-panel`

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setPassword('')
    setShowPassword(false)
    setError(null)
    setNotice(null)
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = AUTH_MODES.indexOf(mode)
    let next: AuthMode | null = null
    if (event.key === 'ArrowRight') next = AUTH_MODES[(index + 1) % AUTH_MODES.length]
    else if (event.key === 'ArrowLeft') {
      next = AUTH_MODES[(index - 1 + AUTH_MODES.length) % AUTH_MODES.length]
    } else if (event.key === 'Home') next = AUTH_MODES[0]
    else if (event.key === 'End') next = AUTH_MODES[AUTH_MODES.length - 1]

    if (next === null) return
    event.preventDefault()
    switchMode(next)
    document.getElementById(`${uid}-tab-${next}`)?.focus()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()
    const validationError = validateCredentials(mode, trimmedEmail, password)
    if (validationError) {
      setError(validationError)
      setNotice(null)
      return
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)

    const credentials = { email: trimmedEmail, password }
    const result = mode === 'login' ? await signIn(credentials) : await signUp(credentials)
    setSubmitting(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    // Con sesión iniciada, AuthGate desmonta este modal; solo queda el caso de correo por confirmar.
    if (result.needsEmailConfirmation) {
      setMode('login')
      setPassword('')
      setNotice(
        `Te enviamos un correo de confirmación a ${trimmedEmail}. Confírmalo y luego inicia sesión.`,
      )
    }
  }

  return (
    <Modal
      open
      onClose={ignoreClose}
      dismissible={false}
      title="Bienvenido a TimeBox Hub"
      description={MODE_COPY[mode].description}
    >
      <div
        role="tablist"
        aria-label="Acceso"
        onKeyDown={handleTabKeyDown}
        className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1"
      >
        {AUTH_MODES.map((tabMode) => (
          <button
            key={tabMode}
            id={`${uid}-tab-${tabMode}`}
            type="button"
            role="tab"
            aria-selected={mode === tabMode}
            aria-controls={panelId}
            tabIndex={mode === tabMode ? 0 : -1}
            onClick={() => switchMode(tabMode)}
            className={clsx(
              'min-h-10 rounded-xl px-3 text-sm font-medium transition-[background-color,color] duration-200',
              mode === tabMode ? 'bg-white/12 text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {MODE_COPY[tabMode].tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={`${uid}-tab-${mode}`}>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className="text-sm font-medium text-ink">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              />
              <input
                id={emailId}
                data-autofocus
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="tu@correo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={error ? errorId : undefined}
                className="glass-input pl-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={passwordId} className="text-sm font-medium text-ink">
              Contraseña
            </label>
            <div className="relative">
              <Lock
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              />
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'login' ? 'Tu contraseña' : `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={error ? errorId : undefined}
                className="glass-input pl-10 pr-12"
              />
              <IconButton
                label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                size="sm"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </IconButton>
            </div>
          </div>

          {notice ? (
            <p
              role="status"
              className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            >
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              id={errorId}
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
            {MODE_COPY[mode].submit}
          </Button>
        </form>
      </div>
    </Modal>
  )
}
