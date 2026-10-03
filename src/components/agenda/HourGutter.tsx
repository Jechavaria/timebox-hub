import { PX_PER_MINUTE } from '../../lib/constants.ts'
import { formatHour12 } from '../../lib/time.ts'

const HOURS_PER_DAY = 24
const HOUR_HEIGHT_PX = 60 * PX_PER_MINUTE

export function HourGutter({ onHourClick }: { onHourClick?: (hour: number) => void }) {
  return (
    <div aria-hidden={!onHourClick} className="w-20 shrink-0 select-none border-r border-glass-border/70">
      {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
        <div
          key={hour}
          onClick={onHourClick ? () => onHourClick(hour) : undefined}
          className={`relative border-b border-glass-border/40 pr-2 text-right ${onHourClick ? 'cursor-pointer hover:bg-white/5 transition-colors group/hour' : ''}`}
          style={{ height: `${HOUR_HEIGHT_PX}px` }}
          title={onHourClick ? `Planificar a las ${formatHour12(hour)}` : undefined}
        >
          <span className="relative -top-2 rounded bg-canvas/80 px-1 text-[10px] tabular-nums text-ink-faint group-hover/hour:text-accent">
            {formatHour12(hour)}
          </span>
        </div>
      ))}
    </div>
  )
}
