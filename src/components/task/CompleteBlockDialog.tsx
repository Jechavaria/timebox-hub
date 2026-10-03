import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Check, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { formatDuration } from '../../lib/time.ts'
import {
  formatBlockNotesWithMeta,
  parseBlockStatus,
  type CompletionStatus,
} from '../../lib/routineHabits.ts'
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
    completionStatus: CompletionStatus,
    updatedNotes: string,
  ) => Promise<MutationResult<void>>
}

export function CompleteBlockDialog({ block, onClose, onComplete }: CompleteBlockDialogProps) {
  const [status, setStatus] = useState<CompletionStatus>('completed')
  const [actualDuration, setActualDuration] = useState(30)
  const [startTimeInput, setStartTimeInput] = useState('')
  const [endTimeInput, setEndTimeInput] = useState('')
  const [metricProgress, setMetricProgress] = useState('')
  const [closeMasterTask, setCloseMasterTask] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const uid = useId()

  useEffect(() => {
    if (!block) return
    const parsed = parseBlockStatus(block)
    const initialDuration = block.actual_duration_minutes ?? block.planned_duration_minutes
    setActualDuration(initialDuration)
    const blockStart = block.start_time ? block.start_time.slice(0, 5) : ''
    setStartTimeInput(blockStart)
    setEndTimeInput('')
    setCloseMasterTask(false)
    setStatus(parsed.status === 'active' ? 'completed' : parsed.status)
    setMetricProgress(parsed.metricProgress || parsed.targetMetric || '')
    setError(null)
  }, [block?.id, block?.planned_duration_minutes, block?.actual_duration_minutes, block?.start_time, block?.notes])

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

    // Si fue completamente fallida / abandonada, permitimos duración 0
    const minDur = status === 'failed_abandoned' ? 0 : 1
    if (!Number.isInteger(actualDuration) || actualDuration < minDur || actualDuration > 1440) {
      setError(`El tiempo real debe estar entre ${minDur} y 1440 minutos.`)
      return
    }

    const parsed = parseBlockStatus(block)
    const updatedNotes = formatBlockNotesWithMeta({
      cleanNotes: parsed.cleanNotes,
      status,
      metricProgress: metricProgress.trim() || undefined,
      targetMetric: parsed.targetMetric,
      initialPlan: parsed.initialPlan,
    })

    setSaving(true)
    setError(null)
    const result = await onComplete(
      block.id,
      actualDuration,
      closeMasterTask && block.master_task_id !== null,
      status,
      updatedNotes,
    )
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
      title="Resultado del bloque"
      description={block ? `Registrar cumplimiento y tiempo de “${block.title}”.` : undefined}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            type="submit"
            form={`${uid}-form`}
            variant={status === 'failed_abandoned' ? 'danger' : status === 'failed_time' ? 'secondary' : 'primary'}
            loading={saving}
          >
            {status === 'failed_abandoned' ? (
              <XCircle aria-hidden="true" className="size-4" />
            ) : status === 'failed_time' ? (
              <AlertTriangle aria-hidden="true" className="size-4" />
            ) : (
              <Check aria-hidden="true" className="size-4" />
            )}
            Guardar resultado
          </Button>
        </div>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Selector de Estado / Resultado: Éxito vs Fallida en tiempo vs No realizada */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Estado de cumplimiento
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus('completed')}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-all cursor-pointer',
                status === 'completed'
                  ? 'border-success bg-success/15 ring-2 ring-success/30 text-ink'
                  : 'border-glass-border bg-glass hover:bg-glass-strong text-ink-muted',
              )}
            >
              <CheckCircle2 className="size-5 text-success" />
              <span className="text-xs font-semibold">Completada</span>
              <span className="text-[10px] text-ink-faint">A tiempo y realizada</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('failed_time')}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-all cursor-pointer',
                status === 'failed_time'
                  ? 'border-warning bg-warning/15 ring-2 ring-warning/30 text-ink'
                  : 'border-glass-border bg-glass hover:bg-glass-strong text-ink-muted',
              )}
            >
              <AlertTriangle className="size-5 text-warning" />
              <span className="text-xs font-semibold">Fallida en tiempo</span>
              <span className="text-[10px] text-ink-faint">Tomó más de lo previsto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus('failed_abandoned')
                setActualDuration(0)
              }}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-all cursor-pointer',
                status === 'failed_abandoned'
                  ? 'border-danger bg-danger/15 ring-2 ring-danger/30 text-ink'
                  : 'border-glass-border bg-glass hover:bg-glass-strong text-ink-muted',
              )}
            >
              <XCircle className="size-5 text-danger" />
              <span className="text-xs font-semibold">No realizada</span>
              <span className="text-[10px] text-ink-faint">Abandonada o cancelada</span>
            </button>
          </div>
        </div>

        {/* Avance o métrica de hábitos (ej. Duolingo, páginas leídas) */}
        <div className="rounded-2xl border border-glass-border bg-glass p-3">
          <label htmlFor={`${uid}-metric`} className="flex items-center justify-between text-xs font-medium text-ink">
            <span>Métrica o avance logrado (opcional)</span>
            <span className="text-[10px] text-ink-faint">Ej. 5 páginas leídas, 1 lección</span>
          </label>
          <input
            id={`${uid}-metric`}
            type="text"
            value={metricProgress}
            onChange={(e) => setMetricProgress(e.target.value)}
            placeholder="Ej. 5 páginas, 1 lección, 10 km..."
            className="glass-input mt-1.5 w-full text-xs"
          />
        </div>

        {/* Comparativa de Duración */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-glass-border bg-glass p-3">
          <div>
            <p className="text-xs text-ink-faint">Planeado</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {formatDuration(block?.planned_duration_minutes ?? 0)}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={`${uid}-actual`} className="text-xs text-ink-faint">
                Tiempo real invertido
              </label>
              {status === 'failed_abandoned' ? (
                <button
                  type="button"
                  onClick={() => setActualDuration(0)}
                  className="text-[10px] text-accent hover:underline"
                >
                  Poner 0 min
                </button>
              ) : null}
            </div>
            <div className="relative mt-1">
              <input
                id={`${uid}-actual`}
                data-autofocus
                type="number"
                min={0}
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

        {/* Horarios de inicio y fin para cálculo automático */}
        <div className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Clock className="size-3.5 text-accent" />
              Calcular por hora real (opcional)
            </span>
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
                Hora en que empecé
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
                Hora en que terminé
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

        {/* Discrepancia calculada */}
        <div
          role="status"
          aria-live="polite"
          className={clsx(
            'rounded-xl border px-3 py-2 text-sm font-medium tabular-nums',
            status === 'failed_abandoned'
              ? 'border-danger/30 bg-danger/10 text-danger'
              : discrepancy === 0
                ? 'border-success/30 bg-success/10 text-success'
                : discrepancy > 0
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-accent/30 bg-accent-soft text-accent',
          )}
        >
          {status === 'failed_abandoned'
            ? 'Tarea marcada como No realizada / Fallida'
            : discrepancyLabel}
        </div>

        {block?.master_task_id ? (
          <label className="flex min-h-11 touch-manipulation items-center gap-3 rounded-xl border border-glass-border bg-glass px-3 cursor-pointer">
            <input
              type="checkbox"
              checked={closeMasterTask}
              onChange={(event) => setCloseMasterTask(event.target.checked)}
              className="size-4 accent-accent"
            />
            <span className="text-sm text-ink">Cerrar también la tarea en el backlog</span>
          </label>
        ) : null}

        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}
