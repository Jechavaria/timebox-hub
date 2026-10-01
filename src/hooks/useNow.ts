import { useEffect, useState } from 'react'
import { msUntilNextMinute } from '../lib/time.ts'

interface UseNowOptions {
  /** Periodo de refresco en ms cuando no se alinea al minuto. */
  intervalMs?: number
  /** Refresca justo en cada cambio de minuto del reloj (para relojes HH:MM). */
  alignToMinute?: boolean
}

const DEFAULT_INTERVAL_MS = 30_000
const MINUTE_ALIGNMENT_MARGIN_MS = 25

/** Devuelve la hora actual y se actualiza sola; se resincroniza al volver a la pestaña. */
export function useNow({
  intervalMs = DEFAULT_INTERVAL_MS,
  alignToMinute = false,
}: UseNowOptions = {}): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timerId: number | undefined

    const schedule = () => {
      window.clearTimeout(timerId)
      const delay = alignToMinute ? msUntilNextMinute() + MINUTE_ALIGNMENT_MARGIN_MS : intervalMs
      timerId = window.setTimeout(() => {
        setNow(new Date())
        schedule()
      }, delay)
    }

    const refresh = () => {
      setNow(new Date())
      schedule()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    schedule()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearTimeout(timerId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [alignToMinute, intervalMs])

  return now
}
