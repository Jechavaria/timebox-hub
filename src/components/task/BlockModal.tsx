import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Check } from 'lucide-react'
import { minutesToTime, timeToMinutes } from '../../lib/time.ts'
import type { MutationResult, ScheduleBlock, ScheduleBlockUpdate } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'
import { DurationPicker } from '../ui/DurationPicker.tsx'

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
        setError('Ingresa una hora válida entre 12:00 AM y 11:59 PM.')
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
        <DurationPicker
          id={`${uid}-duration`}
          value={duration}
          onChange={setDuration}
          label="Duración planeada (Horas y Minutos)"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-time`} className="text-sm font-medium text-ink">Hora de inicio</label>
          <input
            id={`${uid}-time`}
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="glass-input"
          />
          <p className="text-xs text-ink-faint">Deja la hora vacía para mover el bloque a «Sin hora».</p>
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}
