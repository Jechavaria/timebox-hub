import { useState } from 'react'
import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { Check, GripVertical, Pencil, Trash2, Undo2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MIN_BLOCK_PX, PX_PER_MINUTE } from '../../lib/constants.ts'
import { formatDuration } from '../../lib/time.ts'
import type { Area, MasterTask, MasterTaskUpdate, MutationResult } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'
import { TaskModal } from '../task/TaskModal.tsx'

interface TaskBlockProps {
  task: MasterTask
  area: Area
  onUpdate: (id: string, changes: MasterTaskUpdate) => Promise<MutationResult<MasterTask>>
  onDelete: (id: string) => Promise<MutationResult<string>>
}

export function TaskBlock({ task, area, onUpdate, onDelete }: TaskBlockProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const height = Math.max(MIN_BLOCK_PX, task.estimated_duration_minutes * PX_PER_MINUTE)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task.id}`,
    data: {
      type: 'master-task',
      taskId: task.id,
      areaId: area.id,
      durationMinutes: task.estimated_duration_minutes,
    },
  })
  const style = {
    height: `${height}px`,
    '--area-color': area.color,
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : task.is_completed ? 0.65 : undefined,
    zIndex: isDragging ? 10 : undefined,
  } as CSSProperties

  const toggleCompleted = async () => {
    setBusy(true)
    setError(null)
    const result = await onUpdate(task.id, { is_completed: !task.is_completed })
    setBusy(false)
    if (!result.ok) setError(result.message)
  }

  const handleDelete = async () => {
    setBusy(true)
    const result = await onDelete(task.id)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      setConfirmDelete(false)
      return
    }
    setConfirmDelete(false)
  }

  return (
    <>
      <article
        ref={setNodeRef}
        style={style}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            const target = event.target as HTMLElement
            if (target.closest('button, [role="button"], input, a')) return
            event.preventDefault()
            setEditing(true)
          }
        }}
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('button, [role="button"], input, a')) return
          setEditing(true)
        }}
        aria-label={`${task.title}, ${formatDuration(task.estimated_duration_minutes)}${task.is_completed ? ', completada' : ''}`}
        className={clsx(
          'glass-block flex w-full shrink-0 cursor-pointer items-center gap-1 overflow-hidden px-1.5 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          isDragging && 'ring-3 ring-accent/60',
        )}
      >
        <IconButton
          ref={setActivatorNodeRef}
          label={`Arrastrar ${task.title} para cambiar su prioridad`}
          size="sm"
          className="size-9 cursor-grab touch-none active:cursor-grabbing select-none"
          style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </IconButton>
        <div
          className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink select-none">{task.title}</span>
          {height >= 72 ? (
            <span className="shrink-0 text-xs tabular-nums text-ink-muted select-none">
              {formatDuration(task.estimated_duration_minutes)}
            </span>
          ) : null}
        </div>
        <IconButton
          label={task.is_completed ? `Reabrir ${task.title}` : `Completar ${task.title}`}
          size="sm"
          disabled={busy}
          onClick={toggleCompleted}
          className={clsx('size-9', task.is_completed && 'text-success')}
        >
          {task.is_completed ? <Undo2 /> : <Check />}
        </IconButton>
        <IconButton
          label={`Editar ${task.title}`}
          size="sm"
          disabled={busy}
          onClick={() => setEditing(true)}
          className="size-9"
        >
          <Pencil />
        </IconButton>
        <IconButton
          label={`Eliminar ${task.title}`}
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className="size-9"
        >
          <Trash2 />
        </IconButton>
      </article>
      {error ? <p role="alert" className="px-2 text-xs text-danger">{error}</p> : null}

      <TaskModal task={editing ? task : null} onClose={() => setEditing(false)} onSave={onUpdate} />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar tarea"
        description={`Se eliminará “${task.title}” del backlog. Los bloques ya programados conservarán su título.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmDelete(false)} disabled={busy}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>
              <Trash2 aria-hidden="true" className="size-4" />
              Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-muted">Esta acción no se puede deshacer.</p>
      </Modal>
    </>
  )
}
