import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Sparkles, X } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import type { Area, LocalDateString, ScheduleBlock } from '../../types/domain.ts'
import { addDays, formatDateShort, parseLocalDate, toLocalDateString } from '../../lib/time.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { TimelineBoard } from './TimelineBoard.tsx'
import { UntimedTray } from './UntimedTray.tsx'

interface DayMaximizedModalProps {
  open: boolean
  date: LocalDateString | null
  now: Date
  blocks: ScheduleBlock[]
  areasById: ReadonlyMap<string, Area>
  onClose: () => void
  onNavigateDate: (nextDate: LocalDateString) => void
  onAddRoutine: (date: LocalDateString) => void
  onDelete: (blockId: string) => void
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
}

export function DayMaximizedModal({
  open,
  date,
  now,
  blocks,
  areasById,
  onClose,
  onNavigateDate,
  onAddRoutine,
  onDelete,
  onOpen,
  onToggleComplete,
}: DayMaximizedModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const isToday = date !== null && date === toLocalDateString(now)
  const isTomorrow = date !== null && date === addDays(toLocalDateString(now), 1)

  const { setNodeRef } = useDroppable({
    id: `maximized:${date ?? ''}`,
    data: { type: 'day-timeline', date: date ?? '' },
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open || !date) return
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onNavigateDate(addDays(date, -1))
      if (event.key === 'ArrowRight') onNavigateDate(addDays(date, 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, date, onClose, onNavigateDate])

  if (!open || !date) return null

  const dateObj = parseLocalDate(date)
  const dateLabel = formatDateShort(dateObj)
  const dayTitle = isToday ? 'HOY' : isTomorrow ? 'MAÑANA' : dateLabel

  const jumpToNow = () => {
    document.querySelector<HTMLElement>(`[data-now-needle="${date}"]`)?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
  }

  const handlePrevDay = () => onNavigateDate(addDays(date, -1))
  const handleNextDay = () => onNavigateDate(addDays(date, 1))

  const timedBlocks = blocks.filter((b) => b.start_time !== null)
  const untimedBlocks = blocks.filter((b) => b.start_time === null)

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[min(94vw,64rem)] rounded-3xl border border-glass-border bg-popover p-0 text-ink shadow-2xl backdrop-blur-2xl backdrop:bg-black/65 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[92vh] flex-col overflow-hidden">
        {/* Encabezado del día maximizado */}
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-glass-border bg-glass/60 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <IconButton label="Día anterior" size="sm" variant="glass" onClick={handlePrevDay}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton label="Día siguiente" size="sm" variant="glass" onClick={handleNextDay}>
              <ChevronRight className="size-4" />
            </IconButton>
            <div className="ml-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-ink sm:text-lg">
                  {dayTitle}
                </h2>
                {isToday ? (
                  <span className="size-2.5 rounded-full bg-success shadow-[0_0_10px_rgb(95_217_160_/_0.7)]" />
                ) : null}
              </div>
              <p className="text-xs capitalize text-ink-muted">
                {dateLabel} · {timedBlocks.length} con hora asignada · {untimedBlocks.length} sin hora
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isToday ? (
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<Clock3 className="size-4 text-accent" />}
                onClick={jumpToNow}
              >
                <span className="hidden sm:inline">Hora actual</span>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Sparkles className="size-4 text-accent" />}
              onClick={() => onAddRoutine(date)}
            >
              <span className="hidden sm:inline">Añadir rutina</span>
            </Button>
            <IconButton label="Cerrar vista maximizada" size="sm" variant="glass" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
        </header>

        {/* Tablero temporal completo de 24 horas */}
        <div className="h-[64vh] overflow-y-auto overscroll-contain">
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

        {/* Bloques sin hora */}
        <UntimedTray
          date={date}
          blocks={untimedBlocks}
          areasById={areasById}
          onDelete={onDelete}
          onOpen={onOpen}
          onToggleComplete={onToggleComplete}
        />
      </div>
    </dialog>
  )
}
