import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.ts'
import { supabase } from '../lib/supabase.ts'
import type { LocalDateString, ScheduleBlock } from '../types/domain.ts'

const REQUEST_ERROR = 'No fue posible cargar las métricas de este período. Comprueba tu conexión y vuelve a intentarlo.'

export interface UseAnalyticsRangeResult {
  blocks: ScheduleBlock[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

interface RangeResult {
  key: string
  blocks: ScheduleBlock[]
  error: string | null
}

/**
 * Carga desde Supabase los bloques del usuario entre `start` y `end` (fechas locales, inclusivas).
 * Solo consulta mientras `enabled` es true y cancela las peticiones obsoletas al cambiar de rango.
 */
export function useAnalyticsRange(
  start: LocalDateString,
  end: LocalDateString,
  enabled: boolean,
): UseAnalyticsRangeResult {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [reloadToken, setReloadToken] = useState(0)
  const [result, setResult] = useState<RangeResult | null>(null)
  const key = userId ? `${userId}|${start}|${end}|${reloadToken}` : null

  useEffect(() => {
    if (!enabled || !userId || !key) return
    let active = true
    const controller = new AbortController()

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('schedule_blocks')
          .select('*')
          .eq('user_id', userId)
          .gte('scheduled_date', start)
          .lte('scheduled_date', end)
          .order('scheduled_date', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: false })
          .abortSignal(controller.signal)
        if (!active) return
        setResult(
          error
            ? { key, blocks: [], error: REQUEST_ERROR }
            : { key, blocks: (data ?? []) as ScheduleBlock[], error: null },
        )
      } catch {
        if (active) setResult({ key, blocks: [], error: REQUEST_ERROR })
      }
    }

    void load()

    return () => {
      active = false
      controller.abort()
    }
  }, [enabled, end, key, start, userId])

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  const isCurrent = key !== null && result?.key === key
  return {
    blocks: isCurrent ? result.blocks : [],
    isLoading: enabled && key !== null && !isCurrent,
    error: isCurrent ? result.error : null,
    refresh,
  }
}
