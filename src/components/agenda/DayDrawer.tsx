import clsx from 'clsx'
import { Clock3, Sparkles } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import type { Area, LocalDateString, ScheduleBlock } from '../../types/domain.ts'
import { addDays, formatDateShort, parseLocalDate, toLocalDateString } from '../../lib/time.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { TimelineBoard } from './TimelineBoard.tsx'
import { UntimedTray } from './UntimedTray.tsx'

interface DayDrawerProps {
  date: LocalDateString
  blocks: ScheduleBlock[]
  areasById: ReadonlyMap<string, Area>
  now: Date
  isToday: boolean
  onAddRoutine: (date: LocalDateString) => void
  onDelete: (blockId: string) => void
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
}

export function DayDrawer({
  date,
  blocks,
  areasById,
  now,
  isToday,
  onAddRoutine,
  onDelete,
  onOpen,
  onToggleComplete,
}: DayDrawerProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day:${date}`,
    data: { type: 'day-timeline', date },
  })

  const jumpToNow = () => {
    document.querySelector<HTMLElement>(`[data-now-needle="${date}"]`)?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  const timedCount = blocks.filter((block) => block.start_time !== null).length
  const untimedBlocks = blocks.filter((block) => block.start_time === null)
  const dateLabel = formatDateShort(parseLocalDate(date))
  const dayTitle = isToday ? 'HOY' : date === addDays(toLocalDateString(now), 1) ? 'MAÑANA' : dateLabel

  return (
    <section
      aria-label={`${isToday ? 'Hoy' : dateLabel}, ${blocks.length} bloques`}
      className={clsx(
        'glass-panel flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        isOver && 'ring-2 ring-accent/50',
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-glass-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{dayTitle}</h3>
            {isToday ? <span className="size-2 rounded-full bg-success shadow-[0_0_8px_rgb(95_217_160_/_0.6)]" /> : null}
          </div>
          <p className="truncate text-xs capitalize text-ink-muted">{dateLabel} · {timedCount} con hora</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={`Agregar rutina a ${dayTitle}`}
            size="sm"
            variant="glass"
            onClick={() => onAddRoutine(date)}
          >
            <Sparkles className="size-4 text-accent" />
          </IconButton>
          {isToday ? (
            <IconButton label="Saltar a la hora actual" size="sm" variant="glass" onClick={jumpToNow}>
              <Clock3 />
            </IconButton>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <TimelineBoard
          date={date}
          blocks={blocks}
          areasById={areasById}
          now={now}
          isToday={isToday}
          boardRef={setNodeRef}
          onDelete={onDelete}
          onOpen={onOpen}
          onToggleComplete={onToggleComplete}
        />
      </div>
      <UntimedTray
        date={date}
        blocks={untimedBlocks}
        areasById={areasById}
        onDelete={onDelete}
        onOpen={onOpen}
        onToggleComplete={onToggleComplete}
      />
    </section>
  )
}
