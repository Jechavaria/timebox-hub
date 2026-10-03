import { useMemo, useState } from 'react'
import { LayoutGrid, Plus, RotateCw } from 'lucide-react'
import type { Area } from '../../types/domain.ts'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useToast } from '../../hooks/useToast.ts'
import { AreaColumn } from './AreaColumn.tsx'
import { AreaFilterBar } from './AreaFilterBar.tsx'
import { AreaFormModal } from './AreaFormModal.tsx'
import { Button } from '../ui/Button.tsx'
import { GlassPanel } from '../ui/GlassPanel.tsx'
import { Spinner } from '../ui/Spinner.tsx'

export function Matrix() {
  const { areas: areaState, tasks: taskState } = usePlanner()
  const toast = useToast()
  const [showAreaForm, setShowAreaForm] = useState(false)

  const visibleAreas = useMemo(() => areaState.areas.filter((area) => !area.is_hidden), [areaState.areas])
  const tasksByArea = useMemo(() => {
    const grouped = new Map<string, typeof taskState.tasks>()
    for (const task of taskState.tasks) {
      const list = grouped.get(task.area_id) ?? []
      list.push(task)
      grouped.set(task.area_id, list)
    }
    return grouped
  }, [taskState.tasks])

  const handleAreaCreated = async (input: { name: string; color?: string }) => {
    const result = await areaState.createArea(input)
    if (result.ok) toast.success(`Se creó el ámbito “${result.data.name}”.`)
    return result
  }

  const toggleAreaVisibility = async (area: Area) => {
    const result = await areaState.updateArea(area.id, { is_hidden: !area.is_hidden })
    if (!result.ok) toast.error(result.message, 'No se pudo cambiar la visibilidad')
  }

  const isLoading = areaState.isLoading || taskState.isLoading
  const loadError = areaState.error ?? taskState.error

  return (
    <GlassPanel
      as="section"
      aria-labelledby="matrix-heading"
      className="flex flex-col"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <LayoutGrid className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="matrix-heading" className="truncate text-sm font-semibold tracking-tight text-ink sm:text-base">
              Vista General de Tareas
            </h2>
            <p className="hidden truncate text-xs text-ink-muted sm:block">
              Backlog y pendientes organizados por ámbitos
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {loadError ? (
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RotateCw aria-hidden="true" className="size-4" />}
              onClick={() => { void areaState.refresh(); void taskState.refresh() }}
            >
              <span className="hidden sm:inline">Reintentar</span>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => setShowAreaForm(true)}
            aria-label="Crear ámbito"
          >
            <span className="hidden sm:inline">Ámbito</span>
          </Button>
        </div>
      </header>

      <AreaFilterBar areas={areaState.areas} onToggle={(area) => { void toggleAreaVisibility(area) }} />

      {loadError ? (
        <div role="alert" className="mx-4 my-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger sm:mx-6">
          {loadError} Si las tablas aún no existen, aplica la migración SQL 0001 en Supabase.
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <Spinner label="Cargando ámbitos y tareas" />
        </div>
      ) : areaState.areas.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
          <div className="max-w-sm pb-4">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <LayoutGrid className="size-6" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-ink">Empieza creando tu primer ámbito</h3>
            <p className="mt-1 text-sm text-ink-muted">Agrupa tus tareas por las áreas importantes de tu vida.</p>
            <Button variant="primary" className="mt-5" onClick={() => setShowAreaForm(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Crear ámbito
            </Button>
          </div>
        </div>
      ) : visibleAreas.length === 0 ? (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
          <p className="max-w-sm text-sm text-ink-muted">Todos los ámbitos están ocultos. Activa uno arriba para volver a mostrarlo.</p>
        </div>
      ) : (
        <SortableContext items={visibleAreas.map((area) => `area:${area.id}`)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto overscroll-x-contain p-4 sm:p-5 scroll-pl-4 sm:scroll-pl-5 scroll-pr-4 sm:scroll-pr-5 snap-x snap-proximity">
            {visibleAreas.map((area) => (
              <AreaColumn
                key={area.id}
                area={area}
                tasks={tasksByArea.get(area.id) ?? []}
                areaActions={{ updateArea: areaState.updateArea, deleteArea: areaState.deleteArea }}
                taskActions={{
                  createTask: taskState.createTask,
                  updateTask: taskState.updateTask,
                  deleteTask: taskState.deleteTask,
                  reorderTasks: taskState.reorderTasks,
                }}
              />
            ))}
          </div>
        </SortableContext>
      )}

      <AreaFormModal open={showAreaForm} onClose={() => setShowAreaForm(false)} onSave={handleAreaCreated} />
    </GlassPanel>
  )
}