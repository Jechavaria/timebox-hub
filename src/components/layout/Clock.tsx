import { useNow } from '../../hooks/useNow.ts'
import { formatClockTime, formatDateShort, toLocalDateString } from '../../lib/time.ts'

export function Clock() {
  const now = useNow({ alignToMinute: true })
  const time = formatClockTime(now)

  return (
    <time
      dateTime={`${toLocalDateString(now)}T${time}`}
      className="flex flex-col items-end leading-none"
    >
      <span className="text-xl font-semibold tabular-nums tracking-tight text-ink sm:text-2xl">
        {time}
      </span>
      <span className="mt-1 hidden text-xs capitalize text-ink-muted sm:block">
        {formatDateShort(now)}
      </span>
    </time>
  )
}
