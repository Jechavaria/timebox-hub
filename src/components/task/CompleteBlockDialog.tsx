import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { formatDuration } from '../../lib/time.ts'
import type { MutationResult, ScheduleBlock } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'

interface CompleteBlockDialogProps {
  block: ScheduleBlock | null
  onClose: () => void
  onComplete: (
    blockId: string,
    actualDurationMinutes: number,
    closeMasterTask: boolean,
  ) => Promise<MutationResult<void>>
}

export function CompleteBlockDialog({ block, onClose, onComplete }: CompleteBlockDialogProps) {
  const [actualDuration, setActualDuration] = useState(30)
  const [startTimeInput, setStartTimeInput] = useState('')
  const [endTimeInput, setEndTimeInput] = useState('')
  const [closeMasterTask, setCloseMasterTask] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const uid = useId()

  useEffect(() => {
    if (!block) return
    const initialDuration = block.actual_duration_minutes ?? block.planned_duration_minutes
    setActualDuration(initialDuration)
    const blockStart = block.start_time ? block.start_time.slice(0, 5) : ''
    setStartTimeInput(blockStart)
    setEndTimeInput('')
    setCloseMasterTask(false)
    setError(null)
  }, [block?.id, block?.planned_duration_minutes, block?.actual_duration_minutes, block?.start_time])

  const calculateFromTimes = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return
    try {
      const s = Number(startStr.slice(0, 2)) * 60 + Number(startStr.slice(3, 5))
      const e = Number(endStr.slice(0, 2)) * 60 + Number(endStr.slice(3, 5))
      let diff = e - s
      if (diff <= 0) diff += 1440
      if (diff > 0 && diff <= 1440) {
        setActualDuration(diff)
      }
    } catch {
      // Ignorar formato incompleto
    }
  }

  const handleStartTimeChange = (val: string) => {
    setStartTimeInput(val)
    calculateFromTimes(val, endTimeInput)
  }

  const handleEndTimeChange = (val: string) => {
    setEndTimeInput(val)
    calculateFromTimes(startTimeInput, val)
  }

  const setEndTimeNow = () => {
    const d = new Date()
    const nowStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setEndTimeInput(nowStr)
    calculateFromTimes(startTimeInput, nowStr)
  }

  const discrepancy = actualDuration - (block?.planned_duration_minutes ?? 0)
  const discrepancyLabel = discrepancy === 0
    ? 'Justo en el tiempo planeado'
    : discrepancy > 0
      ? `${formatDuration(discrepancy)} más de lo planeado`
      : `${formatDuration(Math.abs(discrepancy))} menos de lo planeado`

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!block) return
    if (!Number.isInteger(actualDuration) || actualDuration < 1 || actualDuration > 1440) {
      setError('El tiempo real debe estar entre 1 y 1440 minutos.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await onComplete(block.id, actualDuration, closeMasterTask && block.master_task_id !== null)
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onClose()
  }

  return (
    <Modal
      open={block !== null}
      onClose={onClose}
      title="Completar bloque"
      description={block ? `¿Cuánto tiempo tomó “${block.title}”?` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" loading={saving}>
            <Check aria-hidden="true" className="size-4" />
            Completar
          </Button>
        </div>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-glass-border bg-glass p-3">
          <div>
            <p className="text-xs text-ink-faint">Planeado</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {formatDuration(block?.planned_duration_minutes ?? 0)}
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-actual`} className="text-xs text-ink-faint">Tiempo real</label>
            <div className="relative mt-1">
              <input
                id={`${uid}-actual`}
                data-autofocus
                type="number"
                min={1}
                max={1440}
                step={1}
                value={actualDuration}
                onChange={(event) => setActualDuration(Number(event.target.value))}
                className="glass-input pr-12 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">min</span>
            </div>
          </div>
        </div>

        {/* Horarios opcionales de inicio y fin para calcular el tiempo automáticamente */}
        <div className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">Calcular por horario (opcional)</span>
            <button
              type="button"
              onClick={setEndTimeNow}
              className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
            >
              Terminé ahora
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={`${uid}-start-time`} className="text-[11px] text-ink-faint">
                Hora que empecé
              </label>
              <input
                id={`${uid}-start-time`}
                type="time"
                value={startTimeInput}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="glass-input mt-1 text-sm tabular-nums"
              />
            </div>
            <div>
              <label htmlFor={`${uid}-end-time`} className="text-[11px] text-ink-faint">
                Hora que terminé
              </label>
              <input
                id={`${uid}-end-time`}
                type="time"
                value={endTimeInput}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="glass-input mt-1 text-sm tabular-nums"
              />
            </div>
          </div>
          {startTimeInput && endTimeInput ? (
            <p className="text-[11px] text-accent font-medium">
              Calculado automáticamente: {formatDuration(actualDuration)}
            </p>
          ) : null}
        </div>

        <div
          role="status"
          aria-live="polite"
          className={clsx(
            'rounded-xl border px-3 py-2 text-sm font-medium tabular-nums',
            discrepancy === 0
              ? 'border-success/30 bg-success/10 text-success'
              : discrepancy > 0
                ? 'border-warning/30 bg-warning/10 text-warning'
                : 'border-accent/30 bg-accent-soft text-accent',
          )}
        >
          {discrepancyLabel}
        </div>

        {block?.master_task_id ? (
          <label className="flex min-h-11 touch-manipulation items-center gap-3 rounded-xl border border-glass-border bg-glass px-3">
            <input
              type="checkbox"
              checked={closeMasterTask}
              onChange={(event) => setCloseMasterTask(event.target.checked)}
              className="size-4 accent-accent"
            />
            <span className="text-sm text-ink">Cerrar también la tarea maestra</span>
          </label>
        ) : null}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}
