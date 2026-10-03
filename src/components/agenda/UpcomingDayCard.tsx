import clsx from 'clsx'
import { Check, Clock, Maximize2, Pencil, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import type { Area, LocalDateString, ScheduleBlock } from '../../types/domain.ts'
import { formatDateShort, formatDuration, minutesToHM, parseLocalDate, timeToMinutes } from '../../lib/time.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { Button } from '../ui/Button.tsx'

interface UpcomingDayCardProps {
  date: LocalDateString
  blocks: ScheduleBlock[]
  areasById: ReadonlyMap<string, Area>
  onAddRoutine: (date: LocalDateString) => void
  onDelete: (blockId: string) => void
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
  onMaximize: (date: LocalDateString) => void
}

export function UpcomingDayCard({
  date,
  blocks,
  areasById,
  onAddRoutine,
  onDelete,
  onOpen,
  onToggleComplete,
  onMaximize,
}: UpcomingDayCardProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `upcoming:${date}`,
    data: { type: 'day-untimed', date },
  })

  const dateObj = parseLocalDate(date)
  const dateLabel = formatDateShort(dateObj)

  // Ordenar: primero bloques con hora fija en orden cronológico, luego bloques sin hora
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time)
    if (a.start_time) return -1
    if (b.start_time) return 1
    return 0
  })

  return (
    <article
      ref={setNodeRef}
      aria-label={`${dateLabel}, ${blocks.length} pendientes`}
      className={clsx(
        'glass-panel flex min-h-[360px] w-[280px] shrink-0 snap-start flex-col sm:w-[320px] transition-all duration-200',
        isOver && 'ring-2 ring-accent/60 bg-accent-soft/20',
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-glass-border px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => onMaximize(date)}
          className="group flex min-w-0 flex-1 items-center gap-2 text-left"
          title={`Maximizar ${dateLabel} para organizar horas en detalle`}
        >
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold capitalize text-ink transition-colors group-hover:text-accent">
              {dateLabel}
            </h3>
            <p className="text-xs text-ink-muted">
              {blocks.length} {blocks.length === 1 ? 'pendiente' : 'pendientes'}
            </p>
          </div>
          <Maximize2 className="size-4 shrink-0 text-ink-faint opacity-60 transition-all group-hover:opacity-100 group-hover:text-accent" />
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={`Agregar rutina a ${dateLabel}`}
            size="sm"
            variant="glass"
            onClick={() => onAddRoutine(date)}
          >
            <Sparkles className="size-4 text-accent" />
          </IconButton>
          <IconButton
            label={`Maximizar ${dateLabel} con detalle de horas`}
            size="sm"
            variant="glass"
            onClick={() => onMaximize(date)}
          >
            <Maximize2 className="size-4" />
          </IconButton>
        </div>
      </header>

      {/* Lista de objetos (pendientes) de seguido */}
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {sortedBlocks.length > 0 ? (
          sortedBlocks.map((block) => {
            const area = block.area_id ? areasById.get(block.area_id) : undefined
            const areaColor = area?.color ?? '#8a909c'
            const startMinutes = block.start_time ? timeToMinutes(block.start_time) : null

            return (
              <div
                key={block.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (target.closest('button, [role="button"], input, a')) return
                  onOpen(block)
                }}
                className={clsx(
                  'glass-block flex cursor-pointer items-center gap-1.5 px-2 py-1.5 transition-all',
                  block.is_completed && 'opacity-60',
                )}
                style={{ '--area-color': areaColor } as React.CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: areaColor }}
                />
                <button
                  type="button"
                  onClick={() => onOpen(block)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={block.title}
                >
                  <span className={clsx('min-w-0 flex-1 truncate text-xs font-medium text-ink', block.is_completed && 'line-through text-ink-muted')}>
                    {block.title}
                  </span>
                  <span className="shrink-0 rounded-md bg-canvas/40 px-1.5 py-0.5 text-[10px] tabular-nums text-ink-muted border border-glass-border">
                    {startMinutes !== null ? minutesToHM(startMinutes) : formatDuration(block.planned_duration_minutes)}
                  </span>
                </button>

                <IconButton
                  label={block.is_completed ? `Reabrir ${block.title}` : `Completar ${block.title}`}
                  size="sm"
                  className="size-7 shrink-0"
                  onClick={() => onToggleComplete(block)}
                >
                  {block.is_completed ? <Undo2 className="size-3.5" /> : <Check className="size-3.5" />}
                </IconButton>
                <IconButton
                  label={`Editar ${block.title}`}
                  size="sm"
                  className="size-7 shrink-0"
                  onClick={() => onOpen(block)}
                >
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  label={`Eliminar ${block.title}`}
                  size="sm"
                  variant="danger"
                  className="size-7 shrink-0"
                  onClick={() => onDelete(block.id)}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            )
          })
        ) : (
          <div className="grid min-h-36 flex-1 place-items-center rounded-2xl border border-dashed border-glass-border/60 p-4 text-center">
            <p className="text-xs text-ink-muted">
              {isOver ? 'Suelta aquí para planificar' : 'Sin pendientes asignados. Arrastra una tarea aquí.'}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-glass-border/60 p-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-center text-xs text-ink-muted hover:text-accent"
          leadingIcon={<Clock className="size-3.5" />}
          onClick={() => onMaximize(date)}
        >
          Organizar horarios
        </Button>
      </div>
    </article>
  )
}
