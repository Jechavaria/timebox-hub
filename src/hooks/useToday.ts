import { useEffect, useState } from 'react'
import { toLocalDateString } from '../lib/time.ts'
import type { LocalDateString } from '../types/domain.ts'

const MIDNIGHT_REFRESH_MARGIN_MS = 50

function millisecondsUntilNextLocalDay(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1, nextMidnight.getTime() - now.getTime() + MIDNIGHT_REFRESH_MARGIN_MS)
}

/** Fecha local actual, con recálculo a medianoche y al volver desde segundo plano. */
export function useToday(): LocalDateString {
  const [today, setToday] = useState<LocalDateString>(() => toLocalDateString(new Date()))

  useEffect(() => {
    let timerId = 0

    const scheduleMidnight = (now: Date) => {
      window.clearTimeout(timerId)
      timerId = window.setTimeout(refresh, millisecondsUntilNextLocalDay(now))
    }

    const refresh = () => {
      const now = new Date()
      setToday(toLocalDateString(now))
      scheduleMidnight(now)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    scheduleMidnight(new Date())
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearTimeout(timerId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}
