import { useEffect, useId, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import clsx from 'clsx'
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, RefreshCw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.ts'
import { MIN_PASSWORD_LENGTH } from '../../lib/constants.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'

type AuthMode = 'login' | 'register' | 'forgot_request' | 'forgot_verify' | 'forgot_new_password'

const AUTH_TABS: readonly ('login' | 'register')[] = ['login', 'register']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MODE_COPY: Record<
  AuthMode,
  { title: string; tab?: string; submit: string; description: string }
> = {
  login: {
    title: 'Bienvenido a TimeBox Hub',
    tab: 'Iniciar sesión',
    submit: 'Entrar',
    description: 'Entra para ver tu vista general de tareas y tu planificación diaria.',
  },
  register: {
    title: 'Bienvenido a TimeBox Hub',
    tab: 'Crear cuenta',
    submit: 'Crear cuenta',
    description: 'Crea tu cuenta: tus datos son privados y solo tú puedes verlos.',
  },
  forgot_request: {
    title: 'Recuperar contraseña',
    submit: 'Enviar código de verificación',
    description: 'Ingresa tu correo para recibir un código de seguridad de 6 dígitos.',
  },
  forgot_verify: {
    title: 'Verificar código',
    submit: 'Verificar y continuar',
    description: 'Ingresa el código numérico de 6 dígitos que enviamos a tu correo.',
  },
  forgot_new_password: {
    title: 'Nueva contraseña',
    submit: 'Actualizar contraseña e ingresar',
    description: 'Establece tu nueva contraseña para volver a acceder a tu cuenta.',
  },
}

const ignoreClose = () => undefined

function validateCredentials(mode: 'login' | 'register', email: string, password: string): string | null {
  if (email === '') return 'Ingresa tu correo.'
  if (!EMAIL_PATTERN.test(email)) return 'El correo no es válido.'
  if (password === '') return 'Ingresa tu contraseña.'
  if (mode === 'register' && password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  return null
}

export function AuthModal() {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    verifyRecoveryCode,
    updatePassword,
    cancelPasswordRecovery,
    isRecoveringPassword,
  } = useAuth()

  const [internalMode, setInternalMode] = useState<AuthMode>('login')
  const mode: AuthMode = isRecoveringPassword ? 'forgot_new_password' : internalMode

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const uid = useId()
  const emailId = `${uid}-email`
  const passwordId = `${uid}-password`
  const confirmPasswordId = `${uid}-confirm-password`
  const codeId = `${uid}-code`
  const errorId = `${uid}-error`
  const panelId = `${uid}-panel`

  // Temporizador para reenvío de código de 6 dígitos
  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  const switchMode = (next: AuthMode) => {
    setInternalMode(next)
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setError(null)
    setNotice(null)
    if (next === 'login' || next === 'register') {
      setRecoveryCode('')
    }
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (mode !== 'login' && mode !== 'register') return
    const index = AUTH_TABS.indexOf(mode)
    let next: 'login' | 'register' | null = null
    if (event.key === 'ArrowRight') next = AUTH_TABS[(index + 1) % AUTH_TABS.length]
    else if (event.key === 'ArrowLeft') {
      next = AUTH_TABS[(index - 1 + AUTH_TABS.length) % AUTH_TABS.length]
    } else if (event.key === 'Home') next = AUTH_TABS[0]
    else if (event.key === 'End') next = AUTH_TABS[AUTH_TABS.length - 1]

    if (next === null) return
    event.preventDefault()
    switchMode(next)
    document.getElementById(`${uid}-tab-${next}`)?.focus()
  }

  const handleResendCode = async () => {
    if (resendCountdown > 0 || resending) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    setResending(true)
    setError(null)
    setNotice(null)

    const result = await requestPasswordReset(trimmedEmail)
    setResending(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setResendCountdown(60)
    setNotice(`Enviamos un nuevo código de 6 dígitos a ${trimmedEmail}.`)
  }

  const handleCancelRecovery = async () => {
    await cancelPasswordRecovery()
    switchMode('login')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()

    // 1. FLUJO LOGIN / REGISTRO
    if (mode === 'login' || mode === 'register') {
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

      if (result.needsEmailConfirmation) {
        setInternalMode('login')
        setPassword('')
        setNotice(
          `Te enviamos un correo de confirmación a ${trimmedEmail}. Confírmalo y luego inicia sesión.`,
        )
      }
      return
    }

    // 2. RECUPERACIÓN: PASO 1 - SOLICITAR CÓDIGO
    if (mode === 'forgot_request') {
      if (!trimmedEmail) {
        setError('Ingresa tu correo electrónico.')
        setNotice(null)
        return
      }
      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        setError('El correo ingresado no es válido.')
        setNotice(null)
        return
      }

      setSubmitting(true)
      setError(null)
      setNotice(null)

      const result = await requestPasswordReset(trimmedEmail)
      setSubmitting(false)

      if (!result.ok) {
        setError(result.message)
        return
      }

      setResendCountdown(60)
      setRecoveryCode('')
      setInternalMode('forgot_verify')
      setNotice(`Enviamos un código de 6 dígitos a ${trimmedEmail}. Revisa tu bandeja de entrada o spam.`)
      return
    }

    // 3. RECUPERACIÓN: PASO 2 - VERIFICAR CÓDIGO DE 6 DÍGITOS
    if (mode === 'forgot_verify') {
      const cleanCode = recoveryCode.trim()
      if (cleanCode.length !== 6) {
        setError('Ingresa el código completo de 6 dígitos.')
        setNotice(null)
        return
      }

      setSubmitting(true)
      setError(null)
      setNotice(null)

      const result = await verifyRecoveryCode(trimmedEmail, cleanCode)
      setSubmitting(false)

      if (!result.ok) {
        setError(result.message)
        return
      }

      setInternalMode('forgot_new_password')
      setPassword('')
      setConfirmPassword('')
      setNotice('Código verificado con éxito. Ingresa tu nueva contraseña.')
      return
    }

    // 4. RECUPERACIÓN: PASO 3 - DEFINIR NUEVA CONTRASEÑA
    if (mode === 'forgot_new_password') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
        setNotice(null)
        return
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden. Verifícalas e inténtalo de nuevo.')
        setNotice(null)
        return
      }

      setSubmitting(true)
      setError(null)
      setNotice(null)

      const result = await updatePassword(password)
      setSubmitting(false)

      if (!result.ok) {
        setError(result.message)
      }
      // Al actualizar exitosamente, AuthGate desmontará este modal y mostrará el dashboard
    }
  }

  const isRecoveryFlow =
    mode === 'forgot_request' || mode === 'forgot_verify' || mode === 'forgot_new_password'

  return (
    <Modal
      open
      onClose={ignoreClose}
      dismissible={false}
      title={MODE_COPY[mode].title}
      description={MODE_COPY[mode].description}
    >
      {/* Pestañas de acceso estándar */}
      {!isRecoveryFlow ? (
        <div
          role="tablist"
          aria-label="Acceso"
          onKeyDown={handleTabKeyDown}
          className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-glass p-1"
        >
          {AUTH_TABS.map((tabMode) => (
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
                mode === tabMode ? 'bg-glass-strong text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {MODE_COPY[tabMode].tab}
            </button>
          ))}
        </div>
      ) : (
        /* Indicador de pasos del flujo de recuperación */
        <div className="mb-5 flex items-center justify-between gap-1.5 rounded-2xl bg-glass p-1.5">
          <div
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-colors',
              mode === 'forgot_request' ? 'bg-glass-strong text-ink shadow-sm' : 'text-ink-muted',
            )}
          >
            <span
              className={clsx(
                'flex size-4 items-center justify-center rounded-full text-[10px] font-bold',
                mode === 'forgot_request' ? 'bg-accent text-white' : 'bg-glass-border text-ink-muted',
              )}
            >
              1
            </span>
            <span>Correo</span>
          </div>
          <span className="text-xs text-ink-faint">›</span>
          <div
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-colors',
              mode === 'forgot_verify' ? 'bg-glass-strong text-ink shadow-sm' : 'text-ink-muted',
            )}
          >
            <span
              className={clsx(
                'flex size-4 items-center justify-center rounded-full text-[10px] font-bold',
                mode === 'forgot_verify' ? 'bg-accent text-white' : 'bg-glass-border text-ink-muted',
              )}
            >
              2
            </span>
            <span>Código</span>
          </div>
          <span className="text-xs text-ink-faint">›</span>
          <div
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-colors',
              mode === 'forgot_new_password' ? 'bg-glass-strong text-ink shadow-sm' : 'text-ink-muted',
            )}
          >
            <span
              className={clsx(
                'flex size-4 items-center justify-center rounded-full text-[10px] font-bold',
                mode === 'forgot_new_password' ? 'bg-accent text-white' : 'bg-glass-border text-ink-muted',
              )}
            >
              3
            </span>
            <span>Clave</span>
          </div>
        </div>
      )}

      <div role="tabpanel" id={panelId} aria-labelledby={!isRecoveryFlow ? `${uid}-tab-${mode}` : undefined}>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Campo Correo electrónico: presente en login, register y forgot_request */}
          {mode !== 'forgot_verify' && mode !== 'forgot_new_password' ? (
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
              {mode === 'forgot_request' ? (
                <p className="pt-1 text-xs text-ink-muted leading-relaxed">
                  Te enviaremos un código de seguridad para verificar tu identidad y permitirte definir una nueva contraseña.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Campo Contraseña para login y registro */}
          {mode === 'login' || mode === 'register' ? (
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

              {mode === 'login' ? (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_request')}
                    className="rounded text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Paso 2: Campo Código de verificación de 6 dígitos */}
          {mode === 'forgot_verify' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-xl bg-glass px-3.5 py-2.5 text-xs text-ink-muted">
                <span>
                  Código enviado a: <strong className="font-medium text-ink">{email}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => switchMode('forgot_request')}
                  className="font-medium text-accent hover:underline focus-visible:outline-none"
                >
                  Cambiar
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={codeId} className="text-sm font-medium text-ink">
                  Código de 6 dígitos
                </label>
                <div className="relative">
                  <KeyRound
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    id={codeId}
                    data-autofocus
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={recoveryCode}
                    onChange={(event) => {
                      const val = event.target.value.replace(/\D/g, '').slice(0, 6)
                      setRecoveryCode(val)
                    }}
                    aria-describedby={error ? errorId : undefined}
                    className="glass-input pl-10 pr-4 text-center font-mono text-xl font-bold tracking-[0.35em]"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-ink-muted">
                  <span>¿No recibiste el código?</span>
                  {resendCountdown > 0 ? (
                    <span className="text-ink-faint">Reenviar en {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      disabled={resending}
                      onClick={handleResendCode}
                      className="inline-flex items-center gap-1 font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      <RefreshCw className={clsx('size-3', resending && 'animate-spin')} />
                      <span>{resending ? 'Reenviando...' : 'Reenviar código'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Paso 3: Campos Nueva contraseña y Confirmación */}
          {mode === 'forgot_new_password' ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={passwordId} className="text-sm font-medium text-ink">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    id={passwordId}
                    data-autofocus
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor={confirmPasswordId} className="text-sm font-medium text-ink">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    id={confirmPasswordId}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repite tu nueva contraseña"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    aria-describedby={error ? errorId : undefined}
                    className="glass-input pl-10 pr-12"
                  />
                  <IconButton
                    label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    size="sm"
                    aria-pressed={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </IconButton>
                </div>
              </div>
            </div>
          ) : null}

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

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={mode === 'forgot_verify' && recoveryCode.trim().length !== 6}
          >
            {MODE_COPY[mode].submit}
          </Button>

          {/* Enlaces de regreso y cancelación */}
          {mode === 'forgot_request' || mode === 'forgot_verify' ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="inline-flex items-center justify-center gap-1.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
            >
              <ArrowLeft className="size-3.5" />
              <span>Volver a iniciar sesión</span>
            </button>
          ) : null}

          {mode === 'forgot_new_password' ? (
            <button
              type="button"
              onClick={handleCancelRecovery}
              className="inline-flex items-center justify-center gap-1.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
            >
              <span>Cancelar y volver a iniciar sesión</span>
            </button>
          ) : null}
        </form>
      </div>
    </Modal>
  )
}
