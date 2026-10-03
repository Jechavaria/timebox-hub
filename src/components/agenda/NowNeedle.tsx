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
      <span className="absolute -left-[3.3rem] -top-2 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-sm">
        {formatClockTime(now)}
      </span>
      <span className="h-0.5 w-full bg-danger shadow-[0_0_10px_rgb(255_123_123_/_0.45)]" />
      <span className="absolute -left-1 size-2 rounded-full border-2 border-[#0b0e16] bg-danger" />
    </div>
  )
}
