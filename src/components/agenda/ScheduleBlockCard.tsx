import { memo, useState } from 'react'
import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { Check, GripVertical, Sparkles, Trash2, Undo2 } from 'lucide-react'
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
  onResizeDuration?: (blockId: string, durationMinutes: number) => void
  untimed?: boolean
}

function ScheduleBlockCardComponent({
  block,
  area,
  onDelete,
  onOpen,
  onToggleComplete,
  onResizeDuration,
  untimed = false,
}: ScheduleBlockCardProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [previewDuration, setPreviewDuration] = useState<number | null>(null)

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { type: 'schedule-block', blockId: block.id, durationMinutes: block.planned_duration_minutes },
  })
  const muted = Boolean(area?.is_hidden)
  const startMinutes = block.start_time ? timeToMinutes(block.start_time) : 0
  const effectiveDuration = previewDuration ?? block.planned_duration_minutes
  const height = Math.max(MIN_BLOCK_PX, effectiveDuration * PX_PER_MINUTE)
  const style = {
    '--area-color': area?.color ?? '#8a909c',
    ...(untimed ? {} : { top: `${startMinutes}px`, height: `${height}px` }),
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.35 : block.is_completed ? 0.58 : undefined,
    zIndex: isDragging ? 30 : isResizing ? 40 : undefined,
  } as CSSProperties

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startY = e.clientY
    const initialDur = block.planned_duration_minutes
    const maxAllowed = 1440 - startMinutes
    setIsResizing(true)
    setPreviewDuration(initialDur)

    const handlePointerMove = (ev: PointerEvent) => {
      const deltaMinutes = ev.clientY - startY
      const raw = initialDur + deltaMinutes
      const snapped = Math.max(15, Math.min(maxAllowed, Math.round(raw / 15) * 15))
      setPreviewDuration(snapped)
    }

    const handlePointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      setIsResizing(false)
      const deltaMinutes = ev.clientY - startY
      const finalDur = Math.max(15, Math.min(maxAllowed, Math.round((initialDur + deltaMinutes) / 15) * 15))
      setPreviewDuration(null)
      if (finalDur !== initialDur && onResizeDuration) {
        onResizeDuration(block.id, finalDur)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      onClick={(event) => {
        if (isResizing) return
        const target = event.target as HTMLElement
        if (target.closest('button, [role="button"], [role="slider"], input, a')) return
        onOpen(block)
      }}
      aria-label={`${block.title}, ${formatDuration(block.planned_duration_minutes)}${block.start_time ? `, ${minutesToHM(startMinutes)}` : ', sin hora'}${muted ? `, ámbito oculto: ${area?.name}` : ''}`}
      className={clsx(
        'glass-block flex min-w-0 cursor-pointer items-center gap-1 overflow-hidden px-1.5 py-1 transition-all',
        untimed ? 'min-h-11 w-full' : 'absolute inset-x-0',
        muted && 'glass-muted',
        block.is_completed && 'opacity-60',
        isDragging && 'ring-3 ring-accent/70',
        isResizing && 'ring-2 ring-accent',
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
        {block.is_routine ? (
          <Sparkles aria-label="Rutina cotidiana" className="size-3 shrink-0 text-accent" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{block.title}</span>
        {(untimed || height >= 54) ? (
          <span className="shrink-0 text-[10px] tabular-nums text-ink-muted">
            {block.start_time ? minutesToHM(startMinutes) : formatDuration(effectiveDuration)}
          </span>
        ) : null}
        {height >= 82 ? (
          <span className="shrink-0 text-[10px] tabular-nums text-ink-muted">
            {formatDuration(effectiveDuration)}
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

      {/* Indicador numérico flotante durante el redimensionamiento */}
      {isResizing ? (
        <div className="absolute bottom-3 right-2 z-30 rounded-md border border-glass-border bg-canvas/95 px-1.5 py-0.5 text-[10px] font-bold text-accent shadow-md tabular-nums">
          {formatDuration(effectiveDuration)}
        </div>
      ) : null}

      {/* Asa inferior para redimensionar en pasos de 15 minutos */}
      {!untimed ? (
        <div
          role="slider"
          aria-label={`Ajustar duración de ${block.title}`}
          aria-valuenow={effectiveDuration}
          onPointerDown={handleResizeStart}
          className="absolute bottom-0 inset-x-0 h-3 cursor-ns-resize group/resize flex items-end justify-center pb-0.5 z-20 touch-none select-none"
          title="Arrastrar para extender o reducir duración (pasos de 15 min)"
        >
          <div className="h-1 w-8 rounded-full bg-white/30 transition-all group-hover/resize:h-1.5 group-hover/resize:bg-accent group-hover/resize:w-12 shadow-sm" />
        </div>
      ) : null}
    </article>
  )
}

export const ScheduleBlockCard = memo(ScheduleBlockCardComponent)
