import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Clock3, Sparkles, X } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import type { Area, LocalDateString, ScheduleBlock } from '../../types/domain.ts'
import { addDays, formatDateShort, minutesSinceMidnight, parseLocalDate, toLocalDateString } from '../../lib/time.ts'
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
  onResizeDuration?: (blockId: string, durationMinutes: number) => void
  onSlotClick?: (date: LocalDateString, minutes: number | null) => void
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
  onResizeDuration,
  onSlotClick,
}: DayMaximizedModalProps) {
  const timelineScrollRef = useRef<HTMLDivElement>(null)

  const isToday = date !== null && date === toLocalDateString(now)
  const isTomorrow = date !== null && date === addDays(toLocalDateString(now), 1)

  const { setNodeRef } = useDroppable({
    id: `maximized:${date ?? ''}`,
    data: { type: 'day-timeline', date: date ?? '' },
  })

  // Atajo de teclado: Escape para cerrar, flechas para navegar días
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

  const jumpToNow = () => {
    const container = timelineScrollRef.current
    if (!container || !date) return
    // Buscar la aguja horaria específicamente dentro de este contenedor maximizado
    const needle = container.querySelector<HTMLElement>(`[data-now-needle="${date}"]`)
    if (needle) {
      needle.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    } else {
      const targetTop = Math.max(0, minutesSinceMidnight(now) - 200)
      container.scrollTo({ top: targetTop, behavior: 'smooth' })
    }
  }

  // Centrar automáticamente en la hora actual al abrir "HOY" maximizado
  useEffect(() => {
    if (open && isToday) {
      const timer = window.setTimeout(() => jumpToNow(), 120)
      return () => window.clearTimeout(timer)
    }
  }, [open, isToday, date])

  if (!open || !date) return null

  const dateObj = parseLocalDate(date)
  const dateLabel = formatDateShort(dateObj)
  const dayTitle = isToday ? 'HOY' : isTomorrow ? 'MAÑANA' : dateLabel

  const handlePrevDay = () => onNavigateDate(addDays(date, -1))
  const handleNextDay = () => onNavigateDate(addDays(date, 1))

  const timedBlocks = blocks.filter((b) => b.start_time !== null)
  const untimedBlocks = blocks.filter((b) => b.start_time === null)

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 md:p-6">
      {/* Fondo difuminado interactivo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-black/65 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Ventana flotante de día maximizado */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Día maximizado: ${dayTitle}`}
        className="glass-popover relative flex max-h-[94vh] w-[min(96vw,66rem)] animate-pop-in flex-col overflow-hidden rounded-3xl border border-glass-border shadow-2xl"
      >
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

        {/* Tablero temporal completo de 24 horas con scroll focalizado */}
        <div ref={timelineScrollRef} className="h-[64vh] overflow-y-auto overscroll-contain">
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

        {/* Bloques sin hora */}
        <UntimedTray
          date={date}
          blocks={untimedBlocks}
          areasById={areasById}
          onDelete={onDelete}
          onOpen={onOpen}
          onToggleComplete={onToggleComplete}
          onSlotClick={onSlotClick}
        />
      </div>
    </div>,
    document.body,
  )
}
