import { memo } from 'react'
import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { Check, GripVertical, Trash2, Undo2 } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { MIN_BLOCK_PX, PX_PER_MINUTE } from '../../lib/constants.ts'
import { formatDuration, minutesToHM, timeToMinutes } from '../../lib/time.ts'
import type { Area, ScheduleBlock } from '../../types/domain.ts'
import { IconButton } from '../ui/IconButton.tsx'

interface ScheduleBlockCardProps {
  block: ScheduleBlock
  area?: Area
  onDelete: (blockId: string) => void
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
  untimed?: boolean
}

function ScheduleBlockCardComponent({ block, area, onDelete, onOpen, onToggleComplete, untimed = false }: ScheduleBlockCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { type: 'schedule-block', blockId: block.id, durationMinutes: block.planned_duration_minutes },
  })
  const muted = Boolean(area?.is_hidden)
  const startMinutes = block.start_time ? timeToMinutes(block.start_time) : 0
  const height = Math.max(MIN_BLOCK_PX, block.planned_duration_minutes * PX_PER_MINUTE)
  const style = {
    '--area-color': area?.color ?? '#8a909c',
    ...(untimed ? {} : { top: `${startMinutes}px`, height: `${height}px` }),
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.35 : block.is_completed ? 0.58 : undefined,
    zIndex: isDragging ? 30 : undefined,
  } as CSSProperties

  return (
    <article
      ref={setNodeRef}
      style={style}
      aria-label={`${block.title}, ${formatDuration(block.planned_duration_minutes)}${block.start_time ? `, ${minutesToHM(startMinutes)}` : ', sin hora'}${muted ? `, ámbito oculto: ${area?.name}` : ''}`}
      className={clsx(
        'glass-block flex min-w-0 items-center gap-1 overflow-hidden px-1.5 py-1',
        untimed ? 'min-h-11 w-full' : 'absolute inset-x-0',
        muted && 'glass-muted',
        block.is_completed && 'opacity-60',
        isDragging && 'ring-3 ring-accent/70',
      )}
      title={`${block.title} · ${formatDuration(block.planned_duration_minutes)}${muted ? ` · ámbito oculto: ${area?.name}` : ''}`}
    >
      <IconButton
        ref={setActivatorNodeRef}
        label={`Mover ${block.title}`}
        size="sm"
        className="size-8 shrink-0 cursor-grab touch-manipulation active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </IconButton>
      <button
        type="button"
        onClick={() => onOpen(block)}
        aria-label={`Editar bloque ${block.title}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{block.title}</span>
        {(untimed || height >= 54) ? (
          <span className="shrink-0 text-[10px] tabular-nums text-ink-muted">
            {block.start_time ? minutesToHM(startMinutes) : formatDuration(block.planned_duration_minutes)}
          </span>
        ) : null}
        {height >= 82 ? (
          <span className="shrink-0 text-[10px] tabular-nums text-ink-muted">
            {formatDuration(block.planned_duration_minutes)}
          </span>
        ) : null}
      </button>
      <IconButton
        label={block.is_completed ? `Reabrir ${block.title}` : `Completar ${block.title}`}
        size="sm"
        className="size-8 shrink-0"
        onClick={() => onToggleComplete(block)}
      >
        {block.is_completed ? <Undo2 /> : <Check />}
      </IconButton>
      <IconButton
        label={`Eliminar bloque ${block.title}`}
        size="sm"
        variant="danger"
        className="size-8 shrink-0"
        onClick={() => onDelete(block.id)}
      >
        <Trash2 />
      </IconButton>
    </article>
  )
}

export const ScheduleBlockCard = memo(ScheduleBlockCardComponent)
