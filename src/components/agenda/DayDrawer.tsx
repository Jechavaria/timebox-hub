import clsx from 'clsx'
import { CalendarPlus, Clock3, Maximize2, Sparkles } from 'lucide-react'
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
  onResizeDuration?: (blockId: string, durationMinutes: number) => void
  onMaximize?: (date: LocalDateString) => void
  onSlotClick?: (date: LocalDateString, minutes: number | null) => void
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
  onResizeDuration,
  onMaximize,
  onSlotClick,
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
        'glass-panel flex w-full flex-col overflow-hidden transition-all duration-200',
        isOver && 'ring-2 ring-accent/60',
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-glass-border px-4 py-2.5">
        <button
          type="button"
          onClick={() => onMaximize?.(date)}
          className="group flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          title={`Maximizar ${dayTitle} con detalle de horas`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-ink transition-colors group-hover:text-accent sm:text-base">
                {dayTitle}
              </h3>
              {isToday ? <span className="size-2.5 rounded-full bg-success shadow-[0_0_10px_rgb(95_217_160_/_0.7)]" /> : null}
              <Maximize2 className="size-4 shrink-0 text-ink-faint opacity-50 transition-all group-hover:opacity-100 group-hover:text-accent" />
            </div>
            <p className="truncate text-xs capitalize text-ink-muted">
              {dateLabel} · {blocks.length} {blocks.length === 1 ? 'bloque' : 'bloques'} ({timedCount} con hora)
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {onMaximize ? (
            <IconButton
              label={`Maximizar ${dayTitle} con detalle de horas`}
              size="sm"
              variant="glass"
              onClick={() => onMaximize(date)}
            >
              <Maximize2 className="size-4" />
            </IconButton>
          ) : null}
          {onSlotClick ? (
            <IconButton
              label={`Planificar tarea en ${dayTitle}`}
              size="sm"
              variant="glass"
              onClick={() => onSlotClick(date, null)}
            >
              <CalendarPlus className="size-4 text-accent" />
            </IconButton>
          ) : null}
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

      {/* Vista de horas alargada y clara para planificación detallada */}
      <div className="h-[460px] overflow-y-auto overscroll-contain sm:h-[520px]">
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
          onResizeDuration={onResizeDuration}
          onSlotClick={onSlotClick}
        />
      </div>
      <UntimedTray
        date={date}
        blocks={untimedBlocks}
        areasById={areasById}
        onDelete={onDelete}
        onOpen={onOpen}
        onToggleComplete={onToggleComplete}
        onSlotClick={onSlotClick}
      />
    </section>
  )
}
