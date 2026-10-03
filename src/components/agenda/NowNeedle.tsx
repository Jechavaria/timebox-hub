import type { CSSProperties } from 'react'
import { minutesSinceMidnight, formatClockTime } from '../../lib/time.ts'

interface NowNeedleProps {
  date: string
  now: Date
  visible: boolean
}

export function NowNeedle({ date, now, visible }: NowNeedleProps) {
  if (!visible) return null
  const style = { top: `${minutesSinceMidnight(now)}px` } satisfies CSSProperties

  return (
    <div
      data-now-needle={date}
      role="status"
      aria-label={`Hora actual ${formatClockTime(now)}`}
      style={style}
      className="pointer-events-none absolute inset-x-0 z-20 flex h-0 items-center"
    >
      <span className="absolute right-full top-1/2 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-white shadow-[0_0_10px_color-mix(in_oklab,var(--color-danger)_45%,transparent)]">
        {formatClockTime(now)}
      </span>
      <span className="h-0.5 w-full bg-danger shadow-[0_0_10px_color-mix(in_oklab,var(--color-danger)_45%,transparent)]" />
      <span className="absolute -left-1 size-2 rounded-full border-2 border-canvas bg-danger" />
    </div>
  )
}
