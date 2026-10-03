import { useState } from 'react'
import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { Eye, EyeOff, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Area, MasterTask } from '../../types/domain.ts'
import type { UseAreasResult } from '../../hooks/useAreas.ts'
import type { UseTasksResult } from '../../hooks/useTasks.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Button } from '../ui/Button.tsx'
import { AreaFormModal } from './AreaFormModal.tsx'
import { NewTaskInline } from './NewTaskInline.tsx'
import { TaskBlock } from './TaskBlock.tsx'

interface AreaColumnProps {
  area: Area
  tasks: MasterTask[]
  areaActions: Pick<UseAreasResult, 'updateArea' | 'deleteArea'>
  taskActions: Pick<UseTasksResult, 'createTask' | 'updateTask' | 'deleteTask' | 'reorderTasks'>
}

export function AreaColumn({ area, tasks, areaActions, taskActions }: AreaColumnProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingId = `area-${area.id}-heading`
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `area:${area.id}`,
    data: { type: 'area', areaId: area.id },
  })
  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    zIndex: isDragging ? 10 : undefined,
  }

  const toggleHidden = async () => {
    setBusy(true)
    const result = await areaActions.updateArea(area.id, { is_hidden: !area.is_hidden })
    setBusy(false)
    setShowMenu(false)
    if (!result.ok) setError(result.message)
  }

  const handleDelete = async () => {
    setBusy(true)
    const result = await areaActions.deleteArea(area.id)
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
      <section
        ref={setNodeRef}
        style={sortableStyle}
        aria-labelledby={headingId}
        className={clsx(
          'glass-panel flex h-full max-h-full min-h-0 w-[min(86vw,21rem)] shrink-0 snap-start flex-col overflow-hidden sm:w-[min(42vw,22rem)] lg:w-[22rem]',
          isDragging && 'ring-3 ring-accent/60',
        )}
      >
        <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-glass-border px-3 py-2.5">
          <IconButton
            ref={setActivatorNodeRef}
            label={`Reordenar ámbito ${area.name}`}
            size="sm"
            className="size-9 cursor-grab touch-manipulation active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical />
          </IconButton>
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full ring-2 ring-white/20"
            style={{ backgroundColor: area.color }}
          />
          <div className="min-w-0 flex-1">
            <h3 id={headingId} className="truncate text-sm font-semibold text-ink">{area.name}</h3>
            <p className="text-xs text-ink-muted">
              {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
            </p>
          </div>
          <IconButton
            label={`Acciones para ${area.name}`}
            size="sm"
            aria-expanded={showMenu}
            onClick={() => setShowMenu((open) => !open)}
            className="size-9"
          >
            <MoreHorizontal />
          </IconButton>
        </header>

        {showMenu ? (
          <div className="z-10 flex shrink-0 items-center gap-1 border-b border-glass-border bg-black/15 px-2 py-1">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setShowMenu(false) }}>
              <Pencil aria-hidden="true" className="size-4" />
              Editar
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={toggleHidden}>
              {area.is_hidden ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
              {area.is_hidden ? 'Mostrar' : 'Ocultar'}
            </Button>
            <IconButton
              label={`Eliminar ámbito ${area.name}`}
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => { setConfirmDelete(true); setShowMenu(false) }}
            >
              <Trash2 />
            </IconButton>
          </div>
        ) : null}

        {error ? <p role="alert" className="shrink-0 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <NewTaskInline areaId={area.id} onCreate={taskActions.createTask} />
        <SortableContext items={tasks.map((task) => `task:${task.id}`)} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2.5">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskBlock
                  key={task.id}
                  task={task}
                  area={area}
                  onUpdate={taskActions.updateTask}
                  onDelete={taskActions.deleteTask}
                />
              ))
            ) : (
              <div className="grid min-h-28 flex-1 place-items-center rounded-2xl border border-dashed border-glass-border p-4 text-center">
                <p className="text-sm text-ink-faint">Añade tareas a este ámbito para empezar.</p>
              </div>
            )}
          </div>
        </SortableContext>
      </section>

      <AreaFormModal
        open={editing}
        area={area}
        onClose={() => setEditing(false)}
        onSave={(input) => areaActions.updateArea(area.id, input)}
      />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar ámbito"
        description={`Se eliminará “${area.name}” y ${tasks.length === 1 ? 'su tarea pendiente' : `sus ${tasks.length} tareas pendientes`}.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmDelete(false)} disabled={busy}>Cancelar</Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>
              <Trash2 aria-hidden="true" className="size-4" />
              Eliminar ámbito
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-muted">Las tareas también se eliminarán. Los bloques que ya estén en tu agenda no se borrarán.</p>
      </Modal>
    </>
  )
}
