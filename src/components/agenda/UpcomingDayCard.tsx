import clsx from 'clsx'
import { CalendarPlus, Check, Clock, GripVertical, Maximize2, Pencil, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Area, LocalDateString, ScheduleBlock } from '../../types/domain.ts'
import {
  formatBlockTimeRange,
  formatDateShort,
  formatDuration,
  minutesToHM,
  parseLocalDate,
  timeToMinutes,
} from '../../lib/time.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { Button } from '../ui/Button.tsx'

interface UpcomingBlockRowProps {
  block: ScheduleBlock
  area?: Area
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
  onDelete: (blockId: string) => void
}

function UpcomingBlockRow({
  block,
  area,
  onOpen,
  onToggleComplete,
  onDelete,
}: UpcomingBlockRowProps) {
  const isContinuation = Boolean(block.is_overnight_continuation)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: isContinuation ? `block-cont:${block.id}` : `block:${block.id}`,
    disabled: isContinuation,
    data: {
      type: 'schedule-block',
      blockId: block.id,
      durationMinutes: block.planned_duration_minutes,
    },
  })

  const areaColor = area?.color ?? '#8a909c'
  const startMinutes = isContinuation ? 0 : (block.start_time ? timeToMinutes(block.start_time) : null)
  const duration = isContinuation ? (block.overnight_duration_minutes ?? block.planned_duration_minutes) : block.planned_duration_minutes
  const crossesMidnight = !isContinuation && startMinutes !== null && (startMinutes + duration > 1440)

  const style = {
    '--area-color': areaColor,
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    opacity: isDragging ? 0.35 : block.is_completed ? 0.6 : undefined,
    zIndex: isDragging ? 30 : undefined,
    willChange: isDragging ? 'transform' : undefined,
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const target = e.target as HTMLElement
          if (target.closest('button, [role="button"], input, a')) return
          e.preventDefault()
          onOpen(block)
        }
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('button, [role="button"], input, a')) return
        onOpen(block)
      }}
      className={clsx(
        'glass-block flex cursor-pointer items-center gap-1.5 px-2 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        block.is_completed && 'opacity-60',
        isDragging && 'ring-2 ring-accent/70',
      )}
    >
      {isContinuation ? (
        <div
          className="size-7 shrink-0 grid place-items-center select-none text-indigo-400"
          title="Continuación de ayer (bloque nocturno)"
        >
          <span className="text-xs">🌙</span>
        </div>
      ) : (
        <IconButton
          ref={setActivatorNodeRef}
          label={`Mover ${block.title}`}
          size="sm"
          className="size-7 shrink-0 cursor-grab touch-none active:cursor-grabbing select-none text-ink-muted hover:text-ink"
          style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </IconButton>
      )}

      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: areaColor }}
      />

      <div
        className="flex min-w-0 flex-1 flex-col justify-center text-left select-none"
        title={block.title}
      >
        <span
          className={clsx(
            'truncate text-xs font-semibold text-ink',
            block.is_completed && 'line-through text-ink-muted',
          )}
        >
          {block.title}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] tabular-nums text-ink-muted">
          <span>
            {isContinuation
              ? `12:00 AM – ${minutesToHM(duration)}`
              : crossesMidnight && startMinutes !== null
                ? formatBlockTimeRange(startMinutes, duration).label
                : startMinutes !== null
                  ? `${minutesToHM(startMinutes)} · `
                  : ''}
            {isContinuation ? ` (${formatDuration(duration)})` : !crossesMidnight ? formatDuration(duration) : `(${formatDuration(duration)})`}
          </span>
          {crossesMidnight ? (
            <span className="shrink-0 rounded bg-indigo-500/20 px-1 py-0.2 text-[9px] font-bold text-indigo-300">
              🌙 Pasa a mañana
            </span>
          ) : null}
          {isContinuation ? (
            <span className="shrink-0 rounded bg-indigo-500/20 px-1 py-0.2 text-[9px] font-bold text-indigo-300">
              🌙 Viene de ayer
            </span>
          ) : null}
        </div>
      </div>

      <IconButton
        label={block.is_completed ? `Reabrir ${block.title}` : `Completar ${block.title}`}
        size="sm"
        className="size-7 shrink-0 text-ink-muted hover:text-accent"
        onClick={() => onToggleComplete(block)}
      >
        {block.is_completed ? <Undo2 className="size-3.5" /> : <Check className="size-3.5" />}
      </IconButton>
      <IconButton
        label={`Editar ${block.title}`}
        size="sm"
        className="size-7 shrink-0 text-ink-muted hover:text-ink"
        onClick={() => onOpen(block)}
      >
        <Pencil className="size-3.5" />
      </IconButton>
      <IconButton
        label={`Eliminar ${block.title}`}
        size="sm"
        variant="danger"
        className="size-7 shrink-0 text-ink-muted hover:text-danger"
        onClick={() => onDelete(block.id)}
      >
        <Trash2 className="size-3.5" />
      </IconButton>
    </div>
  )
}

interface UpcomingDayCardProps {
  date: LocalDateString
  blocks: ScheduleBlock[]
  areasById: ReadonlyMap<string, Area>
  onAddRoutine: (date: LocalDateString) => void
  onDelete: (blockId: string) => void
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
  onMaximize: (date: LocalDateString) => void
  onSlotClick?: (date: LocalDateString, minutes: number | null) => void
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
  onSlotClick,
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
          className="group flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
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
          {onSlotClick ? (
            <IconButton
              label={`Planificar tarea en ${dateLabel}`}
              size="sm"
              variant="glass"
              onClick={() => onSlotClick(date, null)}
            >
              <CalendarPlus className="size-4 text-accent" />
            </IconButton>
          ) : null}
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
          sortedBlocks.map((block) => (
            <UpcomingBlockRow
              key={block.id}
              block={block}
              area={block.area_id ? areasById.get(block.area_id) : undefined}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
            />
          ))
        ) : (
          <button
            type="button"
            onClick={onSlotClick ? () => onSlotClick(date, null) : undefined}
            className="grid min-h-36 flex-1 place-items-center rounded-2xl border border-dashed border-glass-border/60 p-4 text-center hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            <p className="text-xs text-ink-muted">
              {isOver ? 'Suelta aquí para planificar' : '+ Añadir o arrastrar una tarea aquí'}
            </p>
          </button>
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
