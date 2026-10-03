import { useMemo, useState } from 'react'
import { Calendar, RotateCw, Trash2 } from 'lucide-react'
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
import { DayDrawer } from './DayDrawer.tsx'

export function Agenda() {
  const { areas, tasks, schedule } = usePlanner()
  const toast = useToast()
  const now = useNow({ intervalMs: 15_000 })
  const today = toLocalDateString(now)
  const [blockToEdit, setBlockToEdit] = useState<ScheduleBlock | null>(null)
  const [blockToComplete, setBlockToComplete] = useState<ScheduleBlock | null>(null)
  const [blockToDelete, setBlockToDelete] = useState<ScheduleBlock | null>(null)
  const [savingDelete, setSavingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const days = useMemo(() => getWeekDates(today, AGENDA_WINDOW_DAYS), [today])
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
              Hoy, mañana y los siguientes días organizados en orden cronológico
            </p>
          </div>
        </div>
        {schedule.error ? (
          <IconButton label="Reintentar carga de agenda" size="sm" onClick={() => { void schedule.refresh() }}>
            <RotateCw />
          </IconButton>
        ) : null}
      </header>

      {schedule.error ? (
        <p role="alert" className="mx-4 mt-2 text-sm text-danger">{schedule.error}</p>
      ) : null}

      {schedule.isLoading ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <Spinner label="Cargando agenda" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain p-3 sm:gap-6 sm:p-6">
          {days.map(renderDay)}
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
