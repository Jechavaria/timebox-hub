import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Check } from 'lucide-react'
import { minutesToTime, timeToMinutes } from '../../lib/time.ts'
import type { MutationResult, ScheduleBlock, ScheduleBlockUpdate } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'

interface BlockModalProps {
  block: ScheduleBlock | null
  onClose: () => void
  onSave: (blockId: string, changes: ScheduleBlockUpdate) => Promise<MutationResult<ScheduleBlock>>
}

export function BlockModal({ block, onClose, onSave }: BlockModalProps) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState(30)
  const [startTime, setStartTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const uid = useId()

  useEffect(() => {
    if (!block) return
    setTitle(block.title)
    setNotes(block.notes)
    setDuration(block.planned_duration_minutes)
    setStartTime(block.start_time ? block.start_time.slice(0, 5) : '')
    setError(null)
  }, [block?.id, block?.title, block?.notes, block?.planned_duration_minutes, block?.start_time])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!block) return
    const cleanTitle = title.trim()
    if (!cleanTitle || cleanTitle.length > 120) {
      setError('El título debe tener entre 1 y 120 caracteres.')
      return
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      setError('La duración debe estar entre 1 y 1440 minutos.')
      return
    }

    let normalizedTime: string | null = null
    if (startTime) {
      try {
        normalizedTime = minutesToTime(timeToMinutes(startTime))
      } catch {
        setError('Ingresa una hora válida entre 00:00 y 23:59.')
        return
      }
    }

    setSaving(true)
    setError(null)
    const result = await onSave(block.id, {
      title: cleanTitle,
      notes,
      planned_duration_minutes: duration,
      start_time: normalizedTime,
    })
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
      title="Propiedades del bloque"
      description="Ajusta el contenido y el horario de esta instancia."
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" loading={saving}>
            <Check aria-hidden="true" className="size-4" />
            Guardar cambios
          </Button>
        </div>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-title`} className="text-sm font-medium text-ink">Título</label>
          <input
            id={`${uid}-title`}
            data-autofocus
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="glass-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-notes`} className="text-sm font-medium text-ink">Notas</label>
          <textarea
            id={`${uid}-notes`}
            rows={4}
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="glass-input resize-y py-3"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-duration`} className="text-sm font-medium text-ink">Duración planeada</label>
            <div className="relative">
              <input
                id={`${uid}-duration`}
                type="number"
                min={1}
                max={1440}
                step={5}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="glass-input pr-12 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">min</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-time`} className="text-sm font-medium text-ink">Hora de inicio</label>
            <input
              id={`${uid}-time`}
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="glass-input"
            />
          </div>
        </div>
        <p className="text-xs text-ink-faint">Deja la hora vacía para mover el bloque a «Sin hora».</p>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}
