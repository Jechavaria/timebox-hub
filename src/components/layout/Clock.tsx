import clsx from 'clsx'
import { useNow } from '../../hooks/useNow.ts'
import { formatClockTime, formatDateShort, toLocalDateString } from '../../lib/time.ts'

interface ClockProps {
  className?: string
  compact?: boolean
}

export function Clock({ className, compact = false }: ClockProps) {
  const now = useNow({ alignToMinute: true })
  const time = formatClockTime(now)

  return (
    <time
      dateTime={`${toLocalDateString(now)}T${time}`}
      className={clsx('flex flex-col leading-none', compact ? 'items-start' : 'items-end', className)}
    >
      <span
        className={clsx(
          'tabular-nums tracking-tight text-ink font-bold',
          compact ? 'text-base font-semibold' : 'text-xl sm:text-2xl font-semibold',
        )}
      >
        {time}
      </span>
      {!compact && (
        <span className="mt-1 hidden text-xs capitalize text-ink-muted sm:block">
          {formatDateShort(now)}
        </span>
      )}
    </time>
  )
}
