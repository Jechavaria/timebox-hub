import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Calendar, CalendarDays, Columns2, RotateCw, Trash2 } from 'lucide-react'
import { AGENDA_WINDOW_DAYS } from '../../lib/constants.ts'
import { getWeekDates, toLocalDateString } from '../../lib/time.ts'
import { useNow } from '../../hooks/useNow.ts'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useToast } from '../../hooks/useToast.ts'
import type { AgendaView, MutationResult, ScheduleBlock } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { GlassPanel } from '../ui/GlassPanel.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Spinner } from '../ui/Spinner.tsx'
import { BlockModal } from '../task/BlockModal.tsx'
import { CompleteBlockDialog } from '../task/CompleteBlockDialog.tsx'
import { RoutineModal } from '../task/RoutineModal.tsx'
import { DayDrawer } from './DayDrawer.tsx'

const AGENDA_VIEW_STORAGE_KEY = 'timebox_agenda_view'

export function Agenda() {
  const { areas, tasks, schedule } = usePlanner()
  const toast = useToast()
  const now = useNow({ intervalMs: 15_000 })
  const today = toLocalDateString(now)
  const [view, setView] = useState<AgendaView>(() => {
    const saved = localStorage.getItem(AGENDA_VIEW_STORAGE_KEY)
    return saved === 'week' ? 'week' : 'today-tomorrow'
  })
  const [routineDate, setRoutineDate] = useState<string | null>(null)
  const [blockToEdit, setBlockToEdit] = useState<ScheduleBlock | null>(null)
  const [blockToComplete, setBlockToComplete] = useState<ScheduleBlock | null>(null)
  const [blockToDelete, setBlockToDelete] = useState<ScheduleBlock | null>(null)
  const [savingDelete, setSavingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleViewChange = (nextView: AgendaView) => {
    setView(nextView)
    localStorage.setItem(AGENDA_VIEW_STORAGE_KEY, nextView)
  }

  const days = useMemo(() => getWeekDates(today, AGENDA_WINDOW_DAYS), [today])
  const visibleDays = useMemo(() => (view === 'today-tomorrow' ? days.slice(0, 2) : days), [days, view])
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
    toast.success('El bloque se quitó de la agenda. La tarea maestra permanece en El Ábaco.')
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

  const renderDay = (date: string, index: number) => (
    <DayDrawer
      key={date}
      date={date}
      isToday={index === 0}
      now={now}
      areasById={areasById}
      blocks={blocksByDate.get(date) ?? []}
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
  )

  return (
    <GlassPanel
      as="section"
      aria-labelledby="agenda-heading"
      className="flex min-h-0 flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Calendar className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="agenda-heading" className="truncate text-sm font-semibold tracking-tight text-ink sm:text-base">
              Agenda
            </h2>
            <p className="truncate text-xs text-ink-muted">
              {view === 'today-tomorrow' ? 'Enfoque inmediato: Hoy y Mañana' : 'Vista proyectada de 7 días'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            role="tablist"
            aria-label="Modo de vista de agenda"
            className="flex shrink-0 items-center rounded-xl border border-glass-border bg-glass p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'today-tomorrow'}
              onClick={() => handleViewChange('today-tomorrow')}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150',
                view === 'today-tomorrow'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink hover:bg-white/5',
              )}
            >
              <Columns2 className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Hoy y Mañana</span>
              <span className="sm:hidden">2 Días</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'week'}
              onClick={() => handleViewChange('week')}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150',
                view === 'week'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink hover:bg-white/5',
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Semana (7 días)</span>
              <span className="sm:hidden">7 Días</span>
            </button>
          </div>

          {schedule.error ? (
            <IconButton label="Reintentar carga de agenda" size="sm" onClick={() => { void schedule.refresh() }}>
              <RotateCw />
            </IconButton>
          ) : null}
        </div>
      </header>

      {schedule.error ? (
        <p role="alert" className="mx-4 mt-2 text-sm text-danger">{schedule.error}</p>
      ) : null}

      {schedule.isLoading ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <Spinner label="Cargando agenda" />
        </div>
      ) : view === 'today-tomorrow' ? (
        <div className="flex md:grid md:grid-cols-2 h-full min-h-0 flex-1 gap-3 sm:gap-4 overflow-x-auto md:overflow-hidden snap-x snap-mandatory p-3 sm:p-4">
          {visibleDays.map((date, index) => (
            <div key={date} className="w-[88vw] sm:w-[360px] md:w-auto shrink-0 md:shrink snap-start h-full min-h-0">
              {renderDay(date, index)}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-1 gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory p-3 sm:p-4">
          {visibleDays.map((date, index) => (
            <div key={date} className="w-[85vw] max-w-[340px] sm:w-[320px] md:w-[350px] shrink-0 snap-start h-full min-h-0">
              {renderDay(date, index)}
            </div>
          ))}
        </div>
      )}

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
            toast.success(`Rutina “${result.data.title}” agregada a la agenda.`)
          }
          return result
        }}
      />
      <Modal
        open={blockToDelete !== null}
        onClose={() => { if (!savingDelete) setBlockToDelete(null) }}
        title="Quitar bloque de la agenda"
        description={blockToDelete ? `“${blockToDelete.title}” se quitará de este día. La tarea maestra permanecerá en El Ábaco.` : undefined}
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
