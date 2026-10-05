import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import clsx from 'clsx'
import {
  BookOpen,
  Car,
  Code,
  Coffee,
  Dumbbell,
  Languages,
  Moon,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Utensils,
} from 'lucide-react'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { minutesToTime, timeToMinutes } from '../../lib/time.ts'
import {
  BUILTIN_ROUTINE_TEMPLATES,
  deleteCustomRoutineTemplate,
  formatBlockNotesWithMeta,
  getCustomRoutineTemplates,
  saveCustomRoutineTemplate,
  type CustomRoutineTemplate,
} from '../../lib/routineHabits.ts'
import type { CreateRoutineBlockInput, LocalDateString, MutationResult, ScheduleBlock } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'
import { DurationPicker } from '../ui/DurationPicker.tsx'
import { RecurrenceSelector } from '../ui/RecurrenceSelector.tsx'
import type { RecurrenceRule } from '../../lib/recurrence.ts'

interface RoutineModalProps {
  date: LocalDateString | null
  onClose: () => void
  onSave: (
    input: CreateRoutineBlockInput,
    recurrence?: RecurrenceRule,
  ) => Promise<MutationResult<ScheduleBlock>>
}

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120, 480]

const ICON_MAP = {
  Moon,
  Car,
  Utensils,
  Coffee,
  BookOpen,
  Languages,
  Dumbbell,
  Sparkles,
  Code,
  Target,
} as const

export function RoutineModal({ date, onClose, onSave }: RoutineModalProps) {
  const { areas } = usePlanner()
  const [customTemplates, setCustomTemplates] = useState<CustomRoutineTemplate[]>(() => getCustomRoutineTemplates())
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(BUILTIN_ROUTINE_TEMPLATES[0].id)
  const [title, setTitle] = useState(BUILTIN_ROUTINE_TEMPLATES[0].defaultTitle)
  const [duration, setDuration] = useState(BUILTIN_ROUTINE_TEMPLATES[0].defaultMinutes)
  const [hasTime, setHasTime] = useState(true)
  const [startTime, setStartTime] = useState(BUILTIN_ROUTINE_TEMPLATES[0].suggestedTime)
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({ frequency: 'none' })
  const [areaId, setAreaId] = useState<string>('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [customNotes, setCustomNotes] = useState(BUILTIN_ROUTINE_TEMPLATES[0].defaultNotes)
  const [targetUnit, setTargetUnit] = useState<string>('')
  const [targetQty, setTargetQty] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado para crear una nueva plantilla personalizada
  const [showCreateCustom, setShowCreateCustom] = useState(false)
  const [newCustomTitle, setNewCustomTitle] = useState('')
  const [newCustomMinutes, setNewCustomMinutes] = useState(30)
  const [newCustomTime, setNewCustomTime] = useState('08:00')
  const [newCustomUnit, setNewCustomUnit] = useState('')
  const [newCustomQty, setNewCustomQty] = useState<number | ''>(5)
  const [newCustomColor, setNewCustomColor] = useState('#6366f1')

  const uid = useId()

  const allTemplates = [...customTemplates, ...BUILTIN_ROUTINE_TEMPLATES]

  const handleSelectTemplate = (template: CustomRoutineTemplate) => {
    setSelectedTemplateId(template.id)
    setTitle(template.defaultTitle)
    setDuration(template.defaultMinutes)
    setStartTime(template.suggestedTime)
    setHasTime(true)
    setCustomNotes(template.defaultNotes)
    setTargetUnit(template.unitLabel || '')
    setTargetQty(template.targetQuantity || '')
    setError(null)
  }

  const handleSaveNewCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = newCustomTitle.trim()
    if (!clean) return

    const newTemplate: CustomRoutineTemplate = {
      id: `custom_${Date.now()}`,
      label: clean,
      defaultTitle: clean,
      defaultMinutes: newCustomMinutes || 30,
      suggestedTime: newCustomTime || '08:00',
      defaultNotes: newCustomUnit ? `Meta: ${newCustomQty || ''} ${newCustomUnit}` : '',
      iconName: newCustomUnit ? 'Target' : 'Sparkles',
      accentColor: newCustomColor,
      unitLabel: newCustomUnit.trim() || undefined,
      targetQuantity: typeof newCustomQty === 'number' ? newCustomQty : undefined,
    }

    const updated = saveCustomRoutineTemplate(newTemplate)
    setCustomTemplates(updated)
    handleSelectTemplate(newTemplate)
    setShowCreateCustom(false)
    setNewCustomTitle('')
  }

  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = deleteCustomRoutineTemplate(id)
    setCustomTemplates(updated)
    if (selectedTemplateId === id) {
      handleSelectTemplate(BUILTIN_ROUTINE_TEMPLATES[0])
    }
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
    if (selectedTemplateId === 'transport') {
      const parts: string[] = []
      if (origin.trim() || destination.trim()) {
        parts.push(`Ruta: ${origin.trim() || '?'} ➔ ${destination.trim() || '?'}`)
      }
      if (finalNotes) parts.push(finalNotes)
      finalNotes = parts.join(' · ')
    }

    // Preparar meta y plan inicial
    const targetMetricStr = targetUnit.trim() && targetQty ? `${targetQty} ${targetUnit.trim()}` : undefined
    const initialPlanMeta = normalizedTime ? { time: normalizedTime, duration } : undefined

    const formattedNotes = formatBlockNotesWithMeta({
      cleanNotes: finalNotes,
      targetMetric: targetMetricStr,
      initialPlan: initialPlanMeta,
    })

    setSaving(true)
    setError(null)
    const result = await onSave({
      scheduledDate: date,
      title: cleanTitle,
      notes: formattedNotes,
      plannedDurationMinutes: duration,
      startTime: normalizedTime,
      areaId: areaId || null,
    }, recurrence)
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
      title="Agregar rutina o hábito"
      description={date ? `Insertar un bloque de rutina o hábito para el ${date}.` : undefined}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
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

        {/* Selector de plantillas y hábitos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Elige una rutina o hábito
            </label>
            <button
              type="button"
              onClick={() => setShowCreateCustom(!showCreateCustom)}
              className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline cursor-pointer"
            >
              <Plus className="size-3" />
              {showCreateCustom ? 'Cerrar creador' : 'Crear hábito personalizado'}
            </button>
          </div>

          {/* Formulario desplegable para crear hábito personalizado */}
          {showCreateCustom ? (
            <div className="mb-3 rounded-2xl border border-accent/30 bg-accent/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-ink">Nueva rutina o hábito personalizado</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-ink-muted">Nombre del hábito</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Racha Duolingo, Leer libro..."
                    value={newCustomTitle}
                    onChange={(e) => setNewCustomTitle(e.target.value)}
                    className="glass-input mt-1 w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted">Unidad o métrica (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. páginas, lección, km..."
                    value={newCustomUnit}
                    onChange={(e) => setNewCustomUnit(e.target.value)}
                    className="glass-input mt-1 w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted">Meta por sesión</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Ej. 5"
                    value={newCustomQty}
                    onChange={(e) => setNewCustomQty(e.target.value ? Number(e.target.value) : '')}
                    className="glass-input mt-1 w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted">Duración (minutos)</label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={newCustomMinutes}
                    onChange={(e) => setNewCustomMinutes(Number(e.target.value))}
                    className="glass-input mt-1 w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted">Hora sugerida</label>
                  <input
                    type="time"
                    value={newCustomTime}
                    onChange={(e) => setNewCustomTime(e.target.value)}
                    className="glass-input mt-1 w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted">Color distintivo</label>
                  <div className="flex items-center gap-1.5 mt-1">
                    {['#6366f1', '#22c55e', '#3b82f6', '#f97316', '#ec4899', '#06b6d4', '#eab308'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCustomColor(c)}
                        className={clsx(
                          'size-5 rounded-full transition-transform',
                          newCustomColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" variant="primary" onClick={handleSaveNewCustomTemplate}>
                  Guardar plantilla permanente
                </Button>
              </div>
            </div>
          ) : null}

          {/* Carrusel / Grid de plantillas disponibles */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 max-h-52 overflow-y-auto pr-1">
            {allTemplates.map((template) => {
              const Icon = ICON_MAP[template.iconName as keyof typeof ICON_MAP] || Sparkles
              const isSelected = selectedTemplateId === template.id
              const isCustom = template.id.startsWith('custom_')
              return (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={clsx(
                    'group relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center cursor-pointer transition-all duration-150',
                    isSelected
                      ? 'border-accent bg-accent/15 ring-2 ring-accent/30 text-ink shadow-sm'
                      : 'border-glass-border bg-glass hover:bg-glass-strong text-ink-muted',
                  )}
                >
                  {isCustom ? (
                    <button
                      type="button"
                      title="Eliminar rutina personalizada"
                      onClick={(e) => handleDeleteCustomTemplate(template.id, e)}
                      className="absolute right-1 top-1 rounded p-1 text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  ) : null}
                  <span
                    className="grid size-8 place-items-center rounded-lg"
                    style={{ backgroundColor: `${template.accentColor}25`, color: template.accentColor }}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold leading-tight line-clamp-1">{template.label}</span>
                  {template.unitLabel && template.targetQuantity ? (
                    <span className="text-[10px] text-accent font-medium">
                      Meta: {template.targetQuantity} {template.unitLabel}
                    </span>
                  ) : null}
                </div>
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

        {/* Meta / Métrica opcional para hábitos (ej. Duolingo, lectura de páginas) */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-glass-border bg-glass p-3">
          <div>
            <label className="block text-[11px] font-medium text-ink-muted">
              Meta numérica (opcional)
            </label>
            <input
              type="number"
              min={1}
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value ? Number(e.target.value) : '')}
              placeholder="Ej. 5"
              className="glass-input mt-1 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-ink-muted">
              Unidad de seguimiento
            </label>
            <input
              type="text"
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="Ej. páginas, lecciones"
              className="glass-input mt-1 w-full text-xs"
            />
          </div>
          {targetQty && targetUnit ? (
            <p className="col-span-2 text-[11px] text-accent">
              🎯 Seguimiento activo: Se registrará el avance de {targetQty} {targetUnit} al completar.
            </p>
          ) : null}
        </div>

        {/* Campos específicos para transporte */}
        {selectedTemplateId === 'transport' ? (
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault()
                }}
                className="glass-input w-full"
              />
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-ink-faint">
              Se colocará en la bandeja “Sin hora” del día para que la programes luego.
            </p>
          )}
        </div>

        {/* Repetición periódica de la rutina o hábito */}
        {date ? (
          <RecurrenceSelector
            baseDate={date}
            value={recurrence}
            onChange={setRecurrence}
            disabled={saving}
          />
        ) : null}

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
