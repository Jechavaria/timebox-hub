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
  const options = useMemo(() => getRecurrenceOptionsForDate(baseDate), [baseDate])
  const baseDayOfWeek = useMemo(() => getDayOfWeek(baseDate), [baseDate])

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
    if (value.frequency === 'daily') return [7, 14, 30]
    if (value.frequency === 'weekly') return [4, 8, 12]
    if (value.frequency === 'weekdays') return [10, 20, 40]
    return [4, 8, 12]
  }, [value.frequency])

  const countPillLabels: Record<string, string> = {
    '7': '1 semana (7 d)',
    '14': '2 semanas (14 d)',
    '30': '1 mes (30 d)',
    '4': '4 semanas',
    '8': '8 semanas (~2 meses)',
    '12': '12 semanas (~3 meses)',
    '10': '2 sem laborales (10 d)',
    '20': '4 sem laborales (20 d)',
    '40': '8 sem laborales (40 d)',
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass/60 p-3 transition-colors">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Repeat className="size-3.5 text-blue-400" />
          <span>Repetir (estilo Google Calendar)</span>
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
                    {countPillLabels[String(count)] || `${count} veces`}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Banner de resumen explicativo */}
          <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 p-2 text-[11px] text-blue-300">
            <CalendarSync className="size-4 shrink-0 text-blue-400 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold text-blue-200">
                {describeRecurrenceRule(value, baseDate)}
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
