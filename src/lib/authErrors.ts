import { MIN_PASSWORD_LENGTH } from './constants.ts'

const GENERIC_MESSAGE = 'No se pudo completar la operación. Inténtalo de nuevo.'
const NETWORK_MESSAGE = 'No se pudo conectar con el servidor. Revisa tu conexión a internet.'
const INVALID_SESSION_MESSAGE = 'Tu sesión ya no es válida. Inicia sesión de nuevo.'
const EMAIL_TAKEN_MESSAGE = 'Ya existe una cuenta con ese correo. Inicia sesión.'

const MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
  user_already_exists: EMAIL_TAKEN_MESSAGE,
  email_exists: EMAIL_TAKEN_MESSAGE,
  user_not_found: 'No existe ninguna cuenta registrada con este correo.',
  weak_password: `La contraseña es demasiado débil. Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos antes de reintentar.',
  otp_expired: 'El código de verificación ha expirado o ya fue utilizado. Solicita uno nuevo.',
  token_expired: 'El código de verificación ha expirado. Solicita uno nuevo.',
  invalid_grant: 'El código ingresado es incorrecto o ha expirado.',
  bad_jwt: 'El código de verificación no es válido.',
  otp_disabled: 'La verificación por código no está disponible.',
  signup_disabled: 'El registro de cuentas nuevas está deshabilitado.',
  email_provider_disabled: 'El acceso con correo y contraseña está deshabilitado.',
  email_address_invalid: 'El correo ingresado no es válido.',
  validation_failed: 'Los datos ingresados no son válidos.',
  user_banned: 'Esta cuenta está suspendida.',
  captcha_failed: 'No se pudo verificar el captcha. Inténtalo de nuevo.',
  session_expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
  session_not_found: INVALID_SESSION_MESSAGE,
  refresh_token_not_found: INVALID_SESSION_MESSAGE,
}

function readField(error: unknown, key: string): unknown {
  if (typeof error === 'object' && error !== null && key in error) {
    return (error as Record<string, unknown>)[key]
  }
  return undefined
}

/** Traduce errores de Supabase Auth (o fallos de red) a un mensaje en español para el usuario. */
export function getAuthErrorMessage(error: unknown): string {
  const code = readField(error, 'code')
  if (typeof code === 'string' && Object.hasOwn(MESSAGES_BY_CODE, code)) {
    return MESSAGES_BY_CODE[code]
  }

  const message = readField(error, 'message')
  if (typeof message === 'string') {
    const lower = message.toLowerCase()
    if (lower.includes('expired')) {
      return 'El código ha expirado. Solicita un nuevo código de verificación.'
    }
    if (lower.includes('invalid') || lower.includes('token') || lower.includes('otp')) {
      return 'El código ingresado es incorrecto o no es válido.'
    }
    if (lower.includes('rate limit')) {
      return 'Demasiados intentos. Espera un momento antes de volver a intentar.'
    }
    if (lower.includes('network') || lower.includes('fetch')) {
      return NETWORK_MESSAGE
    }
  }

  const isNetworkFailure =
    readField(error, 'name') === 'AuthRetryableFetchError' ||
    readField(error, 'status') === 0 ||
    error instanceof TypeError
  return isNetworkFailure ? NETWORK_MESSAGE : GENERIC_MESSAGE
}
