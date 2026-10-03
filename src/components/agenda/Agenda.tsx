import { useMemo, useState } from 'react'
import { Calendar, CalendarDays, RotateCw, Trash2 } from 'lucide-react'
import { AGENDA_WINDOW_DAYS } from '../../lib/constants.ts'
import { getWeekDates, toLocalDateString } from '../../lib/time.ts'
import { useNow } from '../../hooks/useNow.ts'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useToast } from '../../hooks/useToast.ts'
import type { MutationResult, ScheduleBlock } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { GlassPanel } from '../ui/GlassPanel.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Spinner } from '../ui/Spinner.tsx'
import { BlockModal } from '../task/BlockModal.tsx'
import { CompleteBlockDialog } from '../task/CompleteBlockDialog.tsx'
import { RoutineModal } from '../task/RoutineModal.tsx'
import { DayDrawer } from './DayDrawer.tsx'
import { UpcomingDayCard } from './UpcomingDayCard.tsx'
import { DayMaximizedModal } from './DayMaximizedModal.tsx'

export function Agenda() {
  const { areas, tasks, schedule } = usePlanner()
  const toast = useToast()
  const now = useNow({ intervalMs: 15_000 })
  const today = toLocalDateString(now)

  const [routineDate, setRoutineDate] = useState<string | null>(null)
  const [maximizedDate, setMaximizedDate] = useState<string | null>(null)
  const [blockToEdit, setBlockToEdit] = useState<ScheduleBlock | null>(null)
  const [blockToComplete, setBlockToComplete] = useState<ScheduleBlock | null>(null)
  const [blockToDelete, setBlockToDelete] = useState<ScheduleBlock | null>(null)
  const [savingDelete, setSavingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const days = useMemo(() => getWeekDates(today, AGENDA_WINDOW_DAYS), [today])
  const tomorrow = days[1]
  const upcomingDays = useMemo(() => days.slice(2), [days])
  const areasById = useMemo(() => new Map(areas.areas.map((area) => [area.id, area])), [areas.areas])

  const blocksByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleBlock[]>()
    for (const block of schedule.blocks) {
      const list = grouped.get(block.scheduled_date) ?? []
      list.push(block)
      grouped.set(block.scheduled_date, list)
    }
    return grouped
  }, [schedule.blocks])

  const confirmDelete = async () => {
    if (!blockToDelete) return
    setSavingDelete(true)
    const result = await schedule.deleteBlock(blockToDelete.id)
    setSavingDelete(false)
    if (!result.ok) {
      setDeleteError(result.message)
      return
    }
    toast.success('El bloque se quitó de la planificación diaria. La tarea maestra permanece en la Vista General de Tareas.')
    setBlockToDelete(null)
    setDeleteError(null)
  }

  const handleToggleComplete = async (block: ScheduleBlock) => {
    if (block.is_completed) {
      const result = await schedule.updateBlock(block.id, {
        is_completed: false,
        actual_duration_minutes: null,
      })
      if (!result.ok) toast.error(result.message, 'No se pudo reabrir el bloque')
      return
    }
    setBlockToComplete(block)
  }

  const handleComplete = async (
    blockId: string,
    actualDurationMinutes: number,
    closeMasterTask: boolean,
  ): Promise<MutationResult<void>> => {
    const block = schedule.blocks.find((candidate) => candidate.id === blockId)
    if (!block) return { ok: false, message: 'El bloque ya no está disponible.' }

    const blockResult = await schedule.updateBlock(blockId, {
      is_completed: true,
      actual_duration_minutes: actualDurationMinutes,
    })
    if (!blockResult.ok) return { ok: false, message: blockResult.message }

    if (closeMasterTask && block.master_task_id) {
      const taskResult = await tasks.updateTask(block.master_task_id, { is_completed: true })
      if (!taskResult.ok) {
        const rollback = await schedule.updateBlock(blockId, {
          is_completed: false,
          actual_duration_minutes: null,
        })
        return {
          ok: false,
          message: rollback.ok
            ? `No se cerró la tarea maestra: ${taskResult.message}`
            : `El bloque quedó completado, pero no se pudo cerrar la tarea maestra ni revertir el bloque. ${taskResult.message}`,
        }
      }
    }

    toast.success('Bloque completado; tiempo real guardado.')
    return { ok: true, data: undefined }
  }

  return (
    <GlassPanel
      as="section"
      aria-labelledby="agenda-heading"
      className="flex flex-col"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Calendar className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="agenda-heading" className="truncate text-sm font-semibold tracking-tight text-ink sm:text-base">
              Planificación Diaria
            </h2>
            <p className="truncate text-xs text-ink-muted">
              Hoy, Mañana y lista de pendientes para los próximos días
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {schedule.error ? (
            <IconButton label="Reintentar carga de planificación diaria" size="sm" onClick={() => { void schedule.refresh() }}>
              <RotateCw />
            </IconButton>
          ) : null}
        </div>
      </header>

      {schedule.error ? (
        <p role="alert" className="mx-4 mt-2 text-sm text-danger">{schedule.error}</p>
      ) : null}

      {schedule.isLoading ? (
        <div className="grid min-h-[300px] place-items-center p-8">
          <Spinner label="Cargando planificación diaria" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          {/* 1. HOY: Todo el ancho, vista alargada y detallada de horas */}
          <div className="flex w-full flex-col gap-2">
            <DayDrawer
              date={today}
              isToday={true}
              now={now}
              areasById={areasById}
              blocks={blocksByDate.get(today) ?? []}
              onAddRoutine={setRoutineDate}
              onDelete={(blockId) => {
                const block = schedule.blocks.find((candidate) => candidate.id === blockId)
                if (block) {
                  setBlockToDelete(block)
                  setDeleteError(null)
                }
              }}
              onOpen={setBlockToEdit}
              onToggleComplete={(block) => { void handleToggleComplete(block) }}
              onMaximize={setMaximizedDate}
            />
          </div>

          {/* 2. MAÑANA: Debajo de Hoy, todo el ancho, vista alargada con su propio separador */}
          <div className="flex w-full flex-col gap-2">
            <DayDrawer
              date={tomorrow}
              isToday={false}
              now={now}
              areasById={areasById}
              blocks={blocksByDate.get(tomorrow) ?? []}
              onAddRoutine={setRoutineDate}
              onDelete={(blockId) => {
                const block = schedule.blocks.find((candidate) => candidate.id === blockId)
                if (block) {
                  setBlockToDelete(block)
                  setDeleteError(null)
                }
              }}
              onOpen={setBlockToEdit}
              onToggleComplete={(block) => { void handleToggleComplete(block) }}
              onMaximize={setMaximizedDate}
            />
          </div>

          {/* 3. DÍAS SIGUIENTES: En orden horizontal debajo de Mañana, con lista de pendientes y click para maximizar */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-accent" aria-hidden="true" />
                <h3 className="text-sm font-semibold tracking-tight text-ink">
                  Próximos días
                </h3>
              </div>
              <p className="text-xs text-ink-muted">
                Haz clic en cualquier día para maximizarlo y organizar sus horas
              </p>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-pl-1 sm:scroll-pl-2 snap-x snap-proximity overscroll-x-contain">
              {upcomingDays.map((date) => (
                <UpcomingDayCard
                  key={date}
                  date={date}
                  blocks={blocksByDate.get(date) ?? []}
                  areasById={areasById}
                  onAddRoutine={setRoutineDate}
                  onDelete={(blockId) => {
                    const block = schedule.blocks.find((candidate) => candidate.id === blockId)
                    if (block) {
                      setBlockToDelete(block)
                      setDeleteError(null)
                    }
                  }}
                  onOpen={setBlockToEdit}
                  onToggleComplete={(block) => { void handleToggleComplete(block) }}
                  onMaximize={setMaximizedDate}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de día maximizado para organizar horarios con máxima precisión */}
      <DayMaximizedModal
        open={maximizedDate !== null}
        date={maximizedDate}
        now={now}
        blocks={maximizedDate ? blocksByDate.get(maximizedDate) ?? [] : []}
        areasById={areasById}
        onClose={() => setMaximizedDate(null)}
        onNavigateDate={setMaximizedDate}
        onAddRoutine={setRoutineDate}
        onDelete={(blockId) => {
          const block = schedule.blocks.find((candidate) => candidate.id === blockId)
          if (block) {
            setBlockToDelete(block)
            setDeleteError(null)
          }
        }}
        onOpen={setBlockToEdit}
        onToggleComplete={(block) => { void handleToggleComplete(block) }}
      />

      <BlockModal
        block={blockToEdit}
        onClose={() => setBlockToEdit(null)}
        onSave={schedule.updateBlock}
      />
      <CompleteBlockDialog
        block={blockToComplete}
        onClose={() => setBlockToComplete(null)}
        onComplete={handleComplete}
      />
      <RoutineModal
        date={routineDate}
        onClose={() => setRoutineDate(null)}
        onSave={async (input) => {
          const result = await schedule.createRoutineBlock(input)
          if (result.ok) {
            toast.success(`Rutina “${result.data.title}” agregada a la planificación diaria.`)
          }
          return result
        }}
      />
      <Modal
        open={blockToDelete !== null}
        onClose={() => { if (!savingDelete) setBlockToDelete(null) }}
        title="Quitar bloque de la planificación diaria"
        description={blockToDelete ? `“${blockToDelete.title}” se quitará de este día. La tarea maestra permanecerá en la Vista General de Tareas.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setBlockToDelete(null)} disabled={savingDelete}>Cancelar</Button>
            <Button variant="danger" loading={savingDelete} onClick={() => { void confirmDelete() }}>
              <Trash2 aria-hidden="true" className="size-4" />
              Quitar bloque
            </Button>
          </div>
        }
      >
        {deleteError ? <p role="alert" className="mb-2 text-sm text-danger">{deleteError}</p> : null}
        <p className="text-sm text-ink-muted">Esto no elimina ni completa la tarea original.</p>
      </Modal>
    </GlassPanel>
  )
}
