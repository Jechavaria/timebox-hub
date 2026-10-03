import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Check } from 'lucide-react'
import { useTaskFiles } from '../../hooks/useTaskFiles.ts'
import { useToast } from '../../hooks/useToast.ts'
import { minutesToTime, timeToMinutes } from '../../lib/time.ts'
import type { MutationResult, ScheduleBlock, ScheduleBlockUpdate, TaskFile } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'
import { DurationPicker } from '../ui/DurationPicker.tsx'
import { FileList } from './FileList.tsx'
import { FilePreviewModal } from './FilePreviewModal.tsx'
import { FileUploader } from './FileUploader.tsx'
import { NotesLinkBar } from '../../lib/linkUtils.tsx'
import { NotesEditor } from '../ui/NotesEditor.tsx'

interface BlockModalProps {
  block: ScheduleBlock | null
  onClose: () => void
  onSave: (blockId: string, changes: ScheduleBlockUpdate) => Promise<MutationResult<ScheduleBlock>>
}

export function BlockModal({ block, onClose, onSave }: BlockModalProps) {
  const toast = useToast()
  const taskFiles = useTaskFiles(block?.master_task_id ?? null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const [duration, setDuration] = useState(30)
  const [startTime, setStartTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const uid = useId()

  useEffect(() => {
    if (!block) return
    setTitle(block.title)
    setNotes(block.notes)
    setDuration(block.planned_duration_minutes)
    setStartTime(block.start_time ? block.start_time.slice(0, 5) : '')
    setError(null)
  }, [block?.id, block?.title, block?.notes, block?.planned_duration_minutes, block?.start_time])

  const handleDownload = async (file: TaskFile) => {
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

  const handleDeleteFile = async (file: TaskFile) => {
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

  const handleReplace = async (file: TaskFile, replacement: File) => {
    const result = await taskFiles.replaceFile(file, replacement)
    if (result.ok) toast.success(`“${file.file_name}” se reemplazó correctamente.`)
    return result
  }

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
    <>
      <Modal
        open={block !== null}
        onClose={onClose}
        title="Propiedades del bloque"
        description="Ajusta el contenido, horario y archivos de este bloque."
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_minmax(18rem,0.95fr)]">
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
              <NotesEditor
                id={`${uid}-notes`}
                rows={4}
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

          {/* Columna de archivos adjuntos */}
          <div className="flex flex-col gap-4 border-t border-glass-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            {block?.master_task_id ? (
              <>
                <FileUploader
                  disabled={taskFiles.isUploading}
                  onUpload={handleUpload}
                  onAddLink={taskFiles.addLink}
                />
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
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-glass-border bg-glass p-6 text-center text-sm text-ink-faint">
                <p className="font-medium text-ink">Bloque independiente</p>
                <p className="mt-1 text-xs">
                  Este bloque fue creado como una rutina cotidiana sin tarea base vinculada a archivos.
                </p>
              </div>
            )}
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
