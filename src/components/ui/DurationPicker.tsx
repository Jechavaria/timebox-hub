import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { formatDuration } from '../../lib/time.ts'

export interface DurationPickerProps {
  id?: string
  value: number // in minutes
  onChange: (minutes: number) => void
  allowZero?: boolean
  label?: string
  className?: string
  presets?: number[]
}

export function DurationPicker({
  id,
  value,
  onChange,
  allowZero = false,
  label = 'Duración estimada',
  className,
  presets = [15, 30, 45, 60, 90, 120],
}: DurationPickerProps) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60

  const [hoursStr, setHoursStr] = useState(String(hours))
  const [minutesStr, setMinutesStr] = useState(String(minutes))

  useEffect(() => {
    setHoursStr(String(Math.floor(value / 60)))
    setMinutesStr(String(value % 60))
  }, [value])

  const commit = (h: number, m: number) => {
    const safeH = Math.max(0, Math.min(23, h))
    const safeM = Math.max(0, Math.min(59, m))
    let total = safeH * 60 + safeM
    if (!allowZero && total === 0) total = 15
    onChange(total)
  }

  const handleHoursChange = (raw: string) => {
    const cleaned = raw.replace(/^0+(?=\d)/, '')
    setHoursStr(cleaned)
    if (cleaned !== '') {
      const h = parseInt(cleaned, 10) || 0
      commit(h, parseInt(minutesStr, 10) || 0)
    }
  }

  const handleMinutesChange = (raw: string) => {
    const cleaned = raw.replace(/^0+(?=\d)/, '')
    setMinutesStr(cleaned)
    if (cleaned !== '') {
      const m = parseInt(cleaned, 10) || 0
      commit(parseInt(hoursStr, 10) || 0, m)
    }
  }

  const handleBlur = () => {
    const h = parseInt(hoursStr, 10) || 0
    const m = parseInt(minutesStr, 10) || 0
    commit(h, m)
    setHoursStr(String(Math.floor(value / 60)))
    setMinutesStr(String(value % 60))
  }

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-ink-muted">
          {label}
        </label>
        <span className="text-xs font-semibold tabular-nums text-accent">
          {value === 0 ? 'Sin estimar' : formatDuration(value)}
        </span>
      </div>

      {/* Preset pills */}
      <div className="flex flex-wrap gap-1.5">
        {allowZero && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className={clsx(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
              value === 0
                ? 'bg-accent text-canvas font-semibold shadow-sm'
                : 'border border-glass-border bg-glass text-ink-muted hover:border-white/30 hover:text-ink',
            )}
          >
            Sin tiempo
          </button>
        )}
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={clsx(
              'rounded-lg px-2.5 py-1 text-xs font-medium tabular-nums transition-all',
              value === preset
                ? 'bg-accent text-canvas font-semibold shadow-sm'
                : 'border border-glass-border bg-glass text-ink-muted hover:border-white/30 hover:text-ink',
            )}
          >
            {formatDuration(preset)}
          </button>
        ))}
      </div>

      {/* Custom Hours and Minutes inputs */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="relative">
          <input
            id={id}
            type="number"
            min={0}
            max={23}
            step={1}
            value={hoursStr}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handleHoursChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="0"
            className="glass-input pr-9 tabular-nums text-sm"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted">
            h
          </span>
        </div>
        <div className="relative">
          <input
            id={id ? `${id}-mins` : undefined}
            type="number"
            min={0}
            max={59}
            step={5}
            value={minutesStr}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handleMinutesChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="0"
            className="glass-input pr-12 tabular-nums text-sm"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted">
            min
          </span>
        </div>
      </div>
    </div>
  )
}
