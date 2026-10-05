import { useMemo } from 'react'
import { CalendarSync, Repeat } from 'lucide-react'
import {
  DEFAULT_RECURRENCE_COUNTS,
  ES_WEEKDAY_NAMES_CAPITALIZED,
  describeRecurrenceRule,
  getDayOfWeek,
  getRecurrenceOptionsForDate,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from '../../lib/recurrence.ts'
import { isValidLocalDateString, toLocalDateString } from '../../lib/time.ts'
import type { LocalDateString } from '../../types/domain.ts'

interface RecurrenceSelectorProps {
  baseDate: LocalDateString
  value: RecurrenceRule
  onChange: (rule: RecurrenceRule) => void
  disabled?: boolean
}

export function RecurrenceSelector({
  baseDate,
  value,
  onChange,
  disabled = false,
}: RecurrenceSelectorProps) {
  const safeBaseDate = useMemo(() => {
    return isValidLocalDateString(baseDate) ? baseDate : toLocalDateString(new Date())
  }, [baseDate])

  const options = useMemo(() => getRecurrenceOptionsForDate(safeBaseDate), [safeBaseDate])
  const baseDayOfWeek = useMemo(() => getDayOfWeek(safeBaseDate), [safeBaseDate])

  const handleFrequencyChange = (freq: RecurrenceFrequency) => {
    if (freq === 'none') {
      onChange({ frequency: 'none' })
      return
    }

    const defaultCount = DEFAULT_RECURRENCE_COUNTS[freq]
    const updatedRule: RecurrenceRule = {
      frequency: freq,
      count: defaultCount,
      interval: 1,
      weekdays: freq === 'custom' ? [baseDayOfWeek] : undefined,
    }
    onChange(updatedRule)
  }

  const handleCountChange = (count: number) => {
    onChange({
      ...value,
      count,
    })
  }

  const toggleCustomWeekday = (dayIndex: number) => {
    const current = new Set(value.weekdays ?? [baseDayOfWeek])
    if (current.has(dayIndex)) {
      if (current.size > 1) {
        current.delete(dayIndex)
      }
    } else {
      current.add(dayIndex)
    }
    onChange({
      ...value,
      weekdays: Array.from(current).sort((a, b) => a - b),
    })
  }

  const isRepeating = value.frequency !== 'none'
  const countPills = useMemo(() => {
    if (value.frequency === 'daily') return [7, 14, 21, 30, 60, 90]
    if (value.frequency === 'weekly') return [4, 8, 12, 24, 52]
    if (value.frequency === 'weekdays') return [10, 20, 40, 60]
    return [4, 8, 12, 24]
  }, [value.frequency])

  const getPillLabel = (count: number): string => {
    if (value.frequency === 'weekdays') {
      if (count === 10) return '2 sem lab. (10 d)'
      if (count === 20) return '4 sem lab. (20 d)'
      if (count === 40) return '8 sem lab. (40 d)'
      if (count === 60) return '12 sem lab. (60 d)'
      return `${count} sesiones`
    }
    if (value.frequency === 'weekly') {
      if (count === 4) return '4 semanas'
      if (count === 8) return '8 sem (~2 meses)'
      if (count === 12) return '12 sem (~3 meses)'
      if (count === 24) return '6 meses (24 sem)'
      if (count === 52) return '1 año (52 sem)'
      return `${count} semanas`
    }
    if (value.frequency === 'daily') {
      if (count === 7) return '1 sem (7 d)'
      if (count === 14) return '2 sem (14 d)'
      if (count === 21) return 'Reto 21 días 🔥'
      if (count === 30) return '1 mes (30 d)'
      if (count === 60) return '2 meses (60 d)'
      if (count === 90) return '3 meses (90 d)'
      return `${count} días`
    }
    return `${count} veces`
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass/60 p-3 transition-colors">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Repeat className="size-3.5 text-blue-400" />
          <span>Repetir tarea o hábito</span>
        </label>
        {isRepeating ? (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-400">
            Repetitiva
          </span>
        ) : null}
      </div>

      {/* Selector principal de frecuencia */}
      <select
        value={value.frequency}
        disabled={disabled}
        onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceFrequency)}
        className="glass-input text-xs"
      >
        {options.map((opt) => (
          <option key={opt.frequency} value={opt.frequency}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Opciones cuando está activa la repetición */}
      {isRepeating ? (
        <div className="flex flex-col gap-2.5 pt-1 border-t border-glass-border/40 mt-1">
          {/* Si es personalizado: selector de días de la semana */}
          {value.frequency === 'custom' ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-ink-muted">Repetir los días:</span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                  const isSelected = (value.weekdays ?? [baseDayOfWeek]).includes(dayIdx)
                  const label = ES_WEEKDAY_NAMES_CAPITALIZED[dayIdx].slice(0, 1)
                  const fullName = ES_WEEKDAY_NAMES_CAPITALIZED[dayIdx]
                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      title={fullName}
                      disabled={disabled}
                      onClick={() => toggleCustomWeekday(dayIdx)}
                      className={`size-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-500/30'
                          : 'border border-glass-border bg-glass text-ink-muted hover:border-blue-400 hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Duración o número de repeticiones */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-ink-muted">Duración de la repetición:</span>
            <div className="flex flex-wrap gap-1.5">
              {countPills.map((count) => {
                const isSelected = (value.count ?? countPills[1]) === count
                return (
                  <button
                    key={count}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleCountChange(count)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border border-blue-400 bg-blue-500/20 text-blue-300 font-semibold'
                        : 'border border-glass-border/60 bg-glass/40 text-ink-muted hover:text-ink hover:border-glass-border'
                    }`}
                  >
                    {getPillLabel(count)}
                  </button>
                )
              })}
            </div>

            {/* Entrada personalizada para cualquier número de días o repeticiones */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-ink-muted">O ingresa un número exacto:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={365}
                  disabled={disabled}
                  value={value.count ?? ''}
                  placeholder="Ej. 21"
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    if (!Number.isNaN(parsed) && parsed > 0) {
                      handleCountChange(Math.min(365, parsed))
                    } else if (e.target.value === '') {
                      handleCountChange(1)
                    }
                  }}
                  className="glass-input h-7 w-20 px-2 py-0 text-center text-xs font-semibold tabular-nums"
                />
                <span className="text-[11px] text-ink-faint">
                  {value.frequency === 'weekly' ? 'semanas' : value.frequency === 'daily' ? 'días' : 'repeticiones'} (máx. 365)
                </span>
              </div>
            </div>
          </div>

          {/* Banner de resumen explicativo */}
          <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 p-2 text-[11px] text-blue-300">
            <CalendarSync className="size-4 shrink-0 text-blue-400 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold text-blue-200">
                {describeRecurrenceRule(value, safeBaseDate)}
              </span>
              <p className="text-[10px] text-blue-300/80 mt-0.5">
                Se crearán los bloques automáticamente en tu calendario a la hora establecida.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
