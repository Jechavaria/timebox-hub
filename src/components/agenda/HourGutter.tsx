import { PX_PER_MINUTE } from '../../lib/constants.ts'
import { formatHour12 } from '../../lib/time.ts'

const HOURS_PER_DAY = 24
const HOUR_HEIGHT_PX = 60 * PX_PER_MINUTE

export function HourGutter() {
  return (
    <div aria-hidden="true" className="w-20 shrink-0 select-none border-r border-glass-border/70">
      {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
        <div
          key={hour}
          className="relative border-b border-glass-border/40 pr-2 text-right"
          style={{ height: `${HOUR_HEIGHT_PX}px` }}
        >
          <span className="relative -top-2 rounded bg-canvas/80 px-1 text-[10px] tabular-nums text-ink-faint">
            {formatHour12(hour)}
          </span>
        </div>
      ))}
    </div>
  )
}
