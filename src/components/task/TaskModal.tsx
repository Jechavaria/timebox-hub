import { useEffect, useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarPlus, Check } from 'lucide-react'
import { addDays, minutesToHM, timeToMinutes, toLocalDateString } from '../../lib/time.ts'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useTaskFiles } from '../../hooks/useTaskFiles.ts'
import { useToast } from '../../hooks/useToast.ts'
import type { MasterTask, MasterTaskUpdate, MutationResult, TaskFile } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'
import { DurationPicker } from '../ui/DurationPicker.tsx'
import { FileList } from './FileList.tsx'
import { FilePreviewModal } from './FilePreviewModal.tsx'
import { FileUploader } from './FileUploader.tsx'
import { NotesLinkBar } from '../../lib/linkUtils.tsx'
import { NotesEditor } from '../ui/NotesEditor.tsx'
import { RecurrenceSelector } from '../ui/RecurrenceSelector.tsx'
import type { RecurrenceRule } from '../../lib/recurrence.ts'

interface TaskModalProps {
  task: MasterTask | null
  onClose: () => void
  onSave: (taskId: string, changes: MasterTaskUpdate) => Promise<MutationResult<MasterTask>>
}

export function TaskModal({ task, onClose, onSave }: TaskModalProps) {
  const { areas, schedule } = usePlanner()
  const taskFiles = useTaskFiles(task?.id ?? null)
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const [duration, setDuration] = useState(30)
  const [priorityStr, setPriorityStr] = useState('0')
  const [areaId, setAreaId] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [planTime, setPlanTime] = useState('')
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({ frequency: 'none' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const uid = useId()

  const todayStr = useMemo(() => toLocalDateString(new Date()), [])
  const tomorrowStr = useMemo(() => addDays(todayStr, 1), [todayStr])

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setNotes(task.description)
    setDuration(task.estimated_duration_minutes)
    setPriorityStr(String(task.priority_order ?? 0))
    setAreaId(task.area_id)
    setPlanDate('')
    setPlanTime('')
    setError(null)
  }, [task?.id, task?.title, task?.description, task?.estimated_duration_minutes, task?.priority_order, task?.area_id])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    const cleanTitle = title.trim()
    if (!cleanTitle || cleanTitle.length > 120) {
      setError('El título debe tener entre 1 y 120 caracteres.')
      return
    }
    if (!Number.isInteger(duration) || duration < 0 || duration > 1440) {
      setError('La duración estimada debe estar entre 0 y 1440 minutos.')
      return
    }
    const finalPriority = Math.max(0, parseInt(priorityStr, 10) || 0)
    if (!areas.areas.some((area) => area.id === areaId)) {
      setError('Selecciona un ámbito válido.')
      return
    }

    setSaving(true)
    setError(null)
    const result = await onSave(task.id, {
      title: cleanTitle,
      description: notes,
      estimated_duration_minutes: duration,
      priority_order: finalPriority,
      area_id: areaId,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }

    // Si el usuario eligió fecha para planificarla directamente
    if (planDate) {
      let startMinutes: number | null = null
      if (planTime) {
        try {
          startMinutes = timeToMinutes(planTime)
        } catch {
          // ignore
        }
      }
      const cloneResult = await schedule.cloneTaskToBlock(result.data, planDate, startMinutes, recurrence)
      if (cloneResult.ok) {
        if (recurrence && recurrence.frequency !== 'none') {
          toast.success(`“${cleanTitle}” programada repetitivamente en la agenda.`)
        } else {
          toast.success(
            startMinutes !== null
              ? `“${cleanTitle}” planificada para ${planDate} a las ${minutesToHM(startMinutes)}.`
              : `“${cleanTitle}” añadida a Sin hora para ${planDate}.`,
          )
        }
      } else {
        toast.error(cloneResult.message, 'No se pudo planificar en la agenda')
      }
    }

    onClose()
  }

  const handleDownload = async (file: Parameters<typeof taskFiles.downloadFile>[0]) => {
    const result = await taskFiles.downloadFile(file)
    if (!result.ok) toast.error(result.message, 'No se pudo descargar')
    return result
  }

  const handlePreview = async (file: TaskFile) => {
    setPreviewFile(file)
    setLoadingPreview(true)
    const result = await taskFiles.getPreviewUrl(file)
    setLoadingPreview(false)
    if (result.ok) {
      setPreviewUrl(result.data)
    } else {
      setPreviewUrl(null)
      toast.error(result.message, 'Vista previa no disponible')
    }
  }

  const handleDeleteFile = async (file: Parameters<typeof taskFiles.deleteFile>[0]) => {
    const result = await taskFiles.deleteFile(file)
    if (!result.ok) toast.error(result.message, 'No se pudo eliminar el archivo')
    return result
  }

  const handleUpload = async (files: File[]) => {
    const result = await taskFiles.uploadFiles(files)
    if (result.ok && result.data.length > 0) {
      toast.success(`${result.data.length} ${result.data.length === 1 ? 'archivo añadido' : 'archivos añadidos'}.`)
    }
    return result
  }

  const handleReplace = async (
    file: Parameters<typeof taskFiles.replaceFile>[0],
    replacement: File,
  ) => {
    const result = await taskFiles.replaceFile(file, replacement)
    if (result.ok) toast.success(`“${file.file_name}” se reemplazó correctamente.`)
    return result
  }

  return (
    <>
      <Modal
        open={task !== null}
        onClose={onClose}
        title="Propiedades de la tarea"
        description="Edita los detalles del pendiente y sus archivos."
        size="lg"
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.85fr)]">
          <form id={`${uid}-form`} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-title`} className="text-sm font-medium text-ink">Tarea</label>
              <input
                id={`${uid}-title`}
                data-autofocus
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                className="glass-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-notes`} className="text-sm font-medium text-ink">Notas</label>
              <NotesEditor
                id={`${uid}-notes`}
                rows={3}
                maxLength={4000}
                value={notes}
                onChange={setNotes}
                placeholder="Notas, detalles o enlaces (se detectarán automáticamente)..."
              />
              <NotesLinkBar notes={notes} />
            </div>

            <DurationPicker
              id={`${uid}-duration`}
              value={duration}
              onChange={setDuration}
              allowZero={true}
              label="Duración estimada (Horas y Minutos)"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${uid}-priority`} className="text-sm font-medium text-ink">Prioridad</label>
                <input
                  id={`${uid}-priority`}
                  type="number"
                  min={0}
                  step={1}
                  value={priorityStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(event) => setPriorityStr(event.target.value.replace(/^0+(?=\d)/, ''))}
                  onBlur={() => {
                    const p = Math.max(0, parseInt(priorityStr, 10) || 0)
                    setPriorityStr(String(p))
                  }}
                  className="glass-input tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${uid}-area`} className="text-sm font-medium text-ink">Ámbito</label>
                <select
                  id={`${uid}-area`}
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                  className="glass-input"
                >
                  {areas.areas.map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Planificar directamente en la agenda (opcional) */}
            <div className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <CalendarPlus className="size-3.5 text-accent" />
                  Planificar en la agenda (opcional)
                </span>
                <span className="text-[11px] text-ink-faint">Día y hora</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor={`${uid}-plan-date`} className="text-[11px] text-ink-muted">
                    Día
                  </label>
                  <input
                    id={`${uid}-plan-date`}
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="glass-input mt-1 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor={`${uid}-plan-time`} className="text-[11px] text-ink-muted">
                    Hora (vacía = Sin hora)
                  </label>
                  <input
                    id={`${uid}-plan-time`}
                    type="time"
                    value={planTime}
                    onChange={(e) => setPlanTime(e.target.value)}
                    className="glass-input mt-1 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlanDate(todayStr)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    planDate === todayStr
                      ? 'border-accent bg-accent/20 text-accent font-bold'
                      : 'border-glass-border/70 bg-glass/60 text-ink-muted hover:border-accent hover:text-ink'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setPlanDate(tomorrowStr)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    planDate === tomorrowStr
                      ? 'border-accent bg-accent/20 text-accent font-bold'
                      : 'border-glass-border/70 bg-glass/60 text-ink-muted hover:border-accent hover:text-ink'
                  }`}
                >
                  Mañana
                </button>
                {planDate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanDate('')
                      setPlanTime('')
                      setRecurrence({ frequency: 'none' })
                    }}
                    className="ml-auto text-[11px] text-ink-faint hover:text-danger cursor-pointer"
                  >
                    Quitar fecha
                  </button>
                ) : null}
              </div>

              {planDate ? (
                <div className="pt-1">
                  <RecurrenceSelector
                    baseDate={planDate}
                    value={recurrence}
                    onChange={setRecurrence}
                    disabled={saving}
                  />
                </div>
              ) : null}
            </div>

            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          </form>

          <div className="flex min-w-0 flex-col gap-5 border-t border-glass-border pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <FileUploader disabled={task === null} onUpload={handleUpload} onAddLink={taskFiles.addLink} />
            <FileList
              files={taskFiles.files}
              isLoading={taskFiles.isLoading}
              downloadingIds={taskFiles.downloadingIds}
              deletingIds={taskFiles.deletingIds}
              replacingIds={taskFiles.replacingIds}
              error={taskFiles.error}
              onPreview={handlePreview}
              onReplace={handleReplace}
              onDownload={handleDownload}
              onDelete={handleDeleteFile}
            />
          </div>
        </div>
      </Modal>

      <FilePreviewModal
        open={previewFile !== null}
        onClose={() => {
          setPreviewFile(null)
          setPreviewUrl(null)
        }}
        file={previewFile}
        previewUrl={previewUrl}
        loading={loadingPreview}
        onDownload={handleDownload}
      />
    </>
  )
}
