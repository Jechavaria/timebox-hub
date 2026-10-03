import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Download, File, FileSpreadsheet, FileText, Image, LoaderCircle, Music2, RefreshCw, Trash2 } from 'lucide-react'
import type { TaskFile, MutationResult } from '../../types/domain.ts'
import { formatBytes } from '../../lib/files.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'

interface FileListProps {
  files: TaskFile[]
  isLoading: boolean
  downloadingIds: ReadonlySet<string>
  deletingIds: ReadonlySet<string>
  replacingIds: ReadonlySet<string>
  error: string | null
  onReplace: (file: TaskFile, replacement: File) => Promise<MutationResult<TaskFile>>
  onDownload: (file: TaskFile) => Promise<MutationResult<void>>
  onDelete: (file: TaskFile) => Promise<MutationResult<void>>
}

function FileKindIcon({ file }: { file: TaskFile }) {
  const iconClass = 'size-5 shrink-0 text-ink-muted'
  if (file.file_type.startsWith('image/')) return <Image className={iconClass} aria-hidden="true" />
  if (file.file_type.startsWith('audio/')) return <Music2 className={iconClass} aria-hidden="true" />
  if (file.file_type.includes('spreadsheet')) return <FileSpreadsheet className={iconClass} aria-hidden="true" />
  if (file.file_type.startsWith('text/') || file.file_type === 'application/pdf') {
    return <FileText className={iconClass} aria-hidden="true" />
  }
  return <File className={iconClass} aria-hidden="true" />
}

export function FileList({
  files,
  isLoading,
  downloadingIds,
  deletingIds,
  replacingIds,
  error,
  onReplace,
  onDownload,
  onDelete,
}: FileListProps) {
  const inputRefs = useRef(new Map<string, HTMLInputElement>())
  const [fileToDelete, setFileToDelete] = useState<TaskFile | null>(null)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [replaceError, setReplaceError] = useState<string | null>(null)

  const confirmDelete = async () => {
    if (!fileToDelete) return
    setDeleting(true)
    const result = await onDelete(fileToDelete)
    setDeleting(false)
    if (!result.ok) {
      setDeleteMessage(result.message)
      return
    }
    setFileToDelete(null)
    setDeleteMessage(null)
  }

  return (
    <section aria-labelledby="task-files-heading" className="flex flex-col gap-2">
      <h3 id="task-files-heading" className="text-sm font-semibold text-ink">Archivos adjuntos</h3>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      {replaceError ? <p role="alert" className="text-xs text-danger">{replaceError}</p> : null}
      {isLoading ? (
        <p className="text-sm text-ink-faint">Cargando archivos...</p>
      ) : files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-glass-border px-3 py-4 text-center text-sm text-ink-faint">
          Esta tarea todavía no tiene archivos.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {files.map((file) => {
            const isDownloading = downloadingIds.has(file.id)
            const isDeleting = deletingIds.has(file.id)
            const isReplacing = replacingIds.has(file.id)
            return (
              <li
                key={file.id}
                className="flex min-h-14 items-center gap-2 rounded-xl border border-glass-border bg-glass px-2.5 py-2"
              >
                <input
                  ref={(element) => {
                    if (element) inputRefs.current.set(file.id, element)
                    else inputRefs.current.delete(file.id)
                  }}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.md,.txt,.jpg,.jpeg,.png,.mp3,.m4a"
                  aria-label={`Seleccionar archivo para reemplazar ${file.file_name}`}
                  className="sr-only"
                  onChange={(event) => {
                    const replacement = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (!replacement) return
                    setReplaceError(null)
                    void onReplace(file, replacement).then((result) => {
                      if (!result.ok) setReplaceError(result.message)
                    })
                  }}
                />
                <FileKindIcon file={file} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" title={file.file_name}>{file.file_name}</p>
                  <p className="text-xs tabular-nums text-ink-faint">
                    {formatBytes(file.file_size)} · {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(file.uploaded_at))}
                  </p>
                </div>
                <IconButton
                  label={`Descargar ${file.file_name}`}
                  size="sm"
                  disabled={isDownloading || isDeleting || isReplacing}
                  onClick={() => { void onDownload(file) }}
                  className={clsx('size-9', isDownloading && 'animate-pulse')}
                >
                  {isDownloading ? <LoaderCircle className="animate-spin" /> : <Download />}
                </IconButton>
                <IconButton
                  label={`Reemplazar ${file.file_name}`}
                  size="sm"
                  disabled={isReplacing || isDeleting || isDownloading}
                  onClick={() => inputRefs.current.get(file.id)?.click()}
                  className={clsx('size-9', isReplacing && 'animate-pulse')}
                >
                  {isReplacing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                </IconButton>
                <IconButton
                  label={`Eliminar ${file.file_name}`}
                  size="sm"
                  variant="danger"
                  disabled={isDeleting || isDownloading || isReplacing}
                  onClick={() => { setFileToDelete(file); setDeleteMessage(null) }}
                  className="size-9"
                >
                  {isDeleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      <Modal
        open={fileToDelete !== null}
        onClose={() => { if (!deleting) setFileToDelete(null) }}
        title="Eliminar archivo"
        description={fileToDelete ? `Se eliminará “${fileToDelete.file_name}” del almacenamiento y de esta tarea.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setFileToDelete(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="danger" loading={deleting} onClick={() => { void confirmDelete() }}>
              <Trash2 aria-hidden="true" className="size-4" />
              Eliminar archivo
            </Button>
          </div>
        }
      >
        {deleteMessage ? <p role="alert" className="mb-2 text-sm text-danger">{deleteMessage}</p> : null}
        <p className="text-sm text-ink-muted">No se puede deshacer.</p>
      </Modal>
    </section>
  )
}
