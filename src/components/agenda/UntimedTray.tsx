import clsx from 'clsx'
import { Inbox } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import type { Area, LocalDateString, ScheduleBlock } from '../../types/domain.ts'
import { ScheduleBlockCard } from './ScheduleBlockCard.tsx'

interface UntimedTrayProps {
  date: LocalDateString
  blocks: ScheduleBlock[]
  areasById: ReadonlyMap<string, Area>
  onDelete: (blockId: string) => void
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
}

export function UntimedTray({ date, blocks, areasById, onDelete, onOpen, onToggleComplete }: UntimedTrayProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `untimed:${date}`,
    data: { type: 'day-untimed', date },
  })

  return (
    <div
      ref={setNodeRef}
      aria-label={`Bloques sin hora para ${date}`}
      className={clsx(
        'flex min-h-16 shrink-0 flex-col gap-2 border-t border-glass-border px-3 py-2.5 transition-colors',
        isOver ? 'bg-accent-soft' : 'bg-black/10',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <Inbox aria-hidden="true" className="size-4" />
        <span>Sin hora</span>
        <span className="ml-auto tabular-nums text-ink-faint">{blocks.length}</span>
      </div>
      {blocks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {blocks.map((block) => (
            <ScheduleBlockCard
              key={block.id}
              block={block}
              area={block.area_id ? areasById.get(block.area_id) : undefined}
              onDelete={onDelete}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
              untimed
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-faint">Suelta aquí una tarea o un bloque sin horario.</p>
      )}
    </div>
  )
}
