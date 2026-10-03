import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import clsx from 'clsx'
import { Car, Coffee, Moon, Sparkles, Utensils } from 'lucide-react'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { minutesToTime, timeToMinutes } from '../../lib/time.ts'
import type { CreateRoutineBlockInput, LocalDateString, MutationResult, RoutineKind, ScheduleBlock } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'
import { DurationPicker } from '../ui/DurationPicker.tsx'

interface RoutineModalProps {
  date: LocalDateString | null
  onClose: () => void
  onSave: (input: CreateRoutineBlockInput) => Promise<MutationResult<ScheduleBlock>>
}

interface RoutineTemplate {
  kind: RoutineKind
  label: string
  defaultTitle: string
  defaultMinutes: number
  suggestedTime: string
  defaultNotes: string
  icon: typeof Moon
  accentColor: string
}

const TEMPLATES: readonly RoutineTemplate[] = [
  {
    kind: 'sleep',
    label: 'Dormir',
    defaultTitle: 'Dormir / Descanso',
    defaultMinutes: 480,
    suggestedTime: '23:00',
    defaultNotes: 'Descanso nocturno reparador',
    icon: Moon,
    accentColor: '#818cf8',
  },
  {
    kind: 'transport',
    label: 'Transporte',
    defaultTitle: 'Transporte',
    defaultMinutes: 45,
    suggestedTime: '08:00',
    defaultNotes: '',
    icon: Car,
    accentColor: '#f59e0b',
  },
  {
    kind: 'meal',
    label: 'Comida',
    defaultTitle: 'Almuerzo',
    defaultMinutes: 60,
    suggestedTime: '13:00',
    defaultNotes: 'Alimentación e hidratación',
    icon: Utensils,
    accentColor: '#10b981',
  },
  {
    kind: 'leisure',
    label: 'Ocio',
    defaultTitle: 'Ocio / Pausa activa',
    defaultMinutes: 45,
    suggestedTime: '18:30',
    defaultNotes: 'Tiempo libre y esparcimiento',
    icon: Coffee,
    accentColor: '#ec4899',
  },
]

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120, 480]

export function RoutineModal({ date, onClose, onSave }: RoutineModalProps) {
  const { areas } = usePlanner()
  const [selectedKind, setSelectedKind] = useState<RoutineKind>('sleep')
  const [title, setTitle] = useState(TEMPLATES[0].defaultTitle)
  const [duration, setDuration] = useState(TEMPLATES[0].defaultMinutes)
  const [hasTime, setHasTime] = useState(true)
  const [startTime, setStartTime] = useState(TEMPLATES[0].suggestedTime)
  const [areaId, setAreaId] = useState<string>('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [customNotes, setCustomNotes] = useState(TEMPLATES[0].defaultNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uid = useId()

  const handleSelectTemplate = (template: RoutineTemplate) => {
    setSelectedKind(template.kind)
    setTitle(template.defaultTitle)
    setDuration(template.defaultMinutes)
    setStartTime(template.suggestedTime)
    setHasTime(true)
    setCustomNotes(template.defaultNotes)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!date) return

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
    if (hasTime && startTime) {
      try {
        normalizedTime = minutesToTime(timeToMinutes(startTime))
      } catch {
        setError('Ingresa una hora válida entre 12:00 AM y 11:59 PM.')
        return
      }
    }

    let finalNotes = customNotes.trim()
    if (selectedKind === 'transport') {
      const parts: string[] = []
      if (origin.trim() || destination.trim()) {
        parts.push(`Ruta: ${origin.trim() || '?'} ➔ ${destination.trim() || '?'}`)
      }
      if (finalNotes) parts.push(finalNotes)
      finalNotes = parts.join(' · ')
    }

    setSaving(true)
    setError(null)
    const result = await onSave({
      scheduledDate: date,
      title: cleanTitle,
      notes: finalNotes,
      plannedDurationMinutes: duration,
      startTime: normalizedTime,
      areaId: areaId || null,
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
      open={date !== null}
      onClose={onClose}
      title="Agregar rutina cotidiana"
      description={date ? `Insertar un bloque de rutina para el ${date}.` : undefined}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            type="submit"
            form={`routine-form-${uid}`}
            variant="primary"
            loading={saving}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Insertar rutina
          </Button>
        </div>
      }
    >
      <form id={`routine-form-${uid}`} onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        {/* Selector de plantillas */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Plantilla rápida
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMPLATES.map((template) => {
              const Icon = template.icon
              const isSelected = selectedKind === template.kind
              return (
                <button
                  key={template.kind}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className={clsx(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all duration-150',
                    isSelected
                      ? 'border-accent bg-accent/15 ring-2 ring-accent/30 text-ink'
                      : 'border-glass-border bg-glass hover:bg-glass-strong text-ink-muted',
                  )}
                >
                  <span
                    className="grid size-8 place-items-center rounded-lg"
                    style={{ backgroundColor: `${template.accentColor}25`, color: template.accentColor }}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold">{template.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Título */}
        <div>
          <label htmlFor={`routine-title-${uid}`} className="block text-xs font-medium text-ink-muted">
            Título
          </label>
          <input
            id={`routine-title-${uid}`}
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="glass-input mt-1 w-full"
            placeholder="Nombre de la rutina"
          />
        </div>

        {/* Campos específicos para transporte */}
        {selectedKind === 'transport' ? (
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-glass-border bg-glass p-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`routine-origin-${uid}`} className="block text-xs font-medium text-ink-muted">
                Origen
              </label>
              <input
                id={`routine-origin-${uid}`}
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Ej. Casa"
                className="glass-input mt-1 w-full text-xs"
              />
            </div>
            <div>
              <label htmlFor={`routine-dest-${uid}`} className="block text-xs font-medium text-ink-muted">
                Destino
              </label>
              <input
                id={`routine-dest-${uid}`}
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Ej. Trabajo / Universidad"
                className="glass-input mt-1 w-full text-xs"
              />
            </div>
          </div>
        ) : null}

        {/* Duración */}
        <DurationPicker
          id={`routine-dur-${uid}`}
          value={duration}
          onChange={setDuration}
          presets={QUICK_DURATIONS}
          label="Duración (Horas y Minutos)"
        />

        {/* Horario */}
        <div className="rounded-xl border border-glass-border bg-glass p-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={hasTime}
              onChange={(e) => setHasTime(e.target.checked)}
              className="size-4 rounded border-glass-border accent-accent"
            />
            <span>Asignar hora de inicio en la planificación diaria</span>
          </label>
          {hasTime ? (
            <div className="mt-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="glass-input w-full"
              />
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-ink-faint">
              Se colocará en la bandeja “Sin hora” del día para que la programes luego.
            </p>
          )}
        </div>

        {/* Ámbito opcional */}
        {areas.areas.length > 0 ? (
          <div>
            <label htmlFor={`routine-area-${uid}`} className="block text-xs font-medium text-ink-muted">
              Ámbito asociado (opcional)
            </label>
            <select
              id={`routine-area-${uid}`}
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="glass-input mt-1 w-full"
            >
              <option value="">(Sin ámbito específico)</option>
              {areas.areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Notas */}
        <div>
          <label htmlFor={`routine-notes-${uid}`} className="block text-xs font-medium text-ink-muted">
            Notas
          </label>
          <textarea
            id={`routine-notes-${uid}`}
            rows={2}
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            className="glass-input mt-1 w-full text-xs"
            placeholder="Detalles adicionales de la rutina"
          />
        </div>
      </form>
    </Modal>
  )
}
