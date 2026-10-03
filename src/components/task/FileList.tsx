import { useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Cloud,
  Download,
  ExternalLink,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Image,
  Link2,
  LoaderCircle,
  Music2,
  Presentation,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { TaskFile, MutationResult } from '../../types/domain.ts'
import { formatBytes } from '../../lib/files.ts'
import { detectCloudDocService } from '../../lib/linkUtils.tsx'
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
  onPreview?: (file: TaskFile) => void
  onReplace: (file: TaskFile, replacement: File) => Promise<MutationResult<TaskFile>>
  onDownload: (file: TaskFile) => Promise<MutationResult<void>>
  onDelete: (file: TaskFile) => Promise<MutationResult<void>>
}

function FileKindIcon({ file }: { file: TaskFile }) {
  const iconClass = 'size-5 shrink-0 text-ink-muted'
  if (file.file_type === 'link') {
    const service = detectCloudDocService(file.file_url)
    if (service.type === 'google_docs' || service.type === 'office_word') {
      return <FileText className="size-5 shrink-0 text-blue-400" aria-hidden="true" />
    }
    if (service.type === 'google_sheets' || service.type === 'office_excel') {
      return <FileSpreadsheet className="size-5 shrink-0 text-emerald-400" aria-hidden="true" />
    }
    if (service.type === 'google_slides' || service.type === 'office_powerpoint') {
      return <Presentation className="size-5 shrink-0 text-amber-400" aria-hidden="true" />
    }
    if (service.type === 'google_drive') {
      return <Cloud className="size-5 shrink-0 text-cyan-400" aria-hidden="true" />
    }
    return <Link2 className="size-5 shrink-0 text-accent" aria-hidden="true" />
  }
  if (file.file_type.startsWith('image/')) return <Image className={iconClass} aria-hidden="true" />
  if (file.file_type.startsWith('audio/')) return <Music2 className={iconClass} aria-hidden="true" />
  if (file.file_type.includes('spreadsheet') || file.file_name.endsWith('.xlsx') || file.file_name.endsWith('.xls')) {
    return <FileSpreadsheet className="size-5 shrink-0 text-emerald-400" aria-hidden="true" />
  }
  if (
    file.file_type.startsWith('text/') ||
    file.file_type === 'application/pdf' ||
    file.file_name.endsWith('.docx') ||
    file.file_name.endsWith('.doc')
  ) {
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
  onPreview,
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
                className="flex flex-col gap-2 rounded-xl border border-glass-border bg-glass p-2.5 transition-colors hover:border-glass-border/80"
              >
                <input
                  ref={(element) => {
                    if (element) inputRefs.current.set(file.id, element)
                    else inputRefs.current.delete(file.id)
                  }}
                  type="file"
                  accept="*/*"
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
                <div className="flex items-start gap-2.5">
                  <FileKindIcon file={file} />
                  {file.file_type === 'link' ? (
                    (() => {
                      const service = detectCloudDocService(file.file_url)
                      return (
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                              href={file.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`min-w-0 break-words text-sm font-semibold leading-snug hover:underline inline-flex items-center gap-1.5 ${service.textColor}`}
                              title={service.actionLabel}
                            >
                              <span>{file.file_name}</span>
                              <ExternalLink className="size-3.5 shrink-0 inline opacity-80" />
                            </a>
                            {service.isCloudDoc ? (
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${service.badgeColor}`}>
                                ☁️ {service.label} · Autoguardado
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <p
                      className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-ink select-text"
                      title={file.file_name}
                    >
                      {file.file_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-glass-border/40 pt-1.5">
                  <span className="text-[11px] tabular-nums text-ink-faint">
                    {file.file_type === 'link'
                      ? (() => {
                          const s = detectCloudDocService(file.file_url)
                          return `${s.isCloudDoc ? `${s.label} en la nube` : 'Enlace web'} · ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(file.uploaded_at))}`
                        })()
                      : `${formatBytes(file.file_size)} · ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(file.uploaded_at))}`}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {file.file_type === 'link' ? (
                      (() => {
                        const s = detectCloudDocService(file.file_url)
                        return (
                          <IconButton
                            label={s.actionLabel}
                            size="sm"
                            onClick={() => { void onDownload(file) }}
                            className={`size-8 ${s.textColor} hover:bg-white/10`}
                          >
                            <ExternalLink className="size-4" />
                          </IconButton>
                        )
                      })()
                    ) : (
                      <>
                        {onPreview ? (
                          <IconButton
                            label={`Vista previa de ${file.file_name}`}
                            size="sm"
                            disabled={isDownloading || isDeleting || isReplacing}
                            onClick={() => onPreview(file)}
                            className="size-8 text-accent hover:bg-accent/20"
                          >
                            <Eye className="size-4" />
                          </IconButton>
                        ) : null}
                        <IconButton
                          label={`Descargar ${file.file_name}`}
                          size="sm"
                          disabled={isDownloading || isDeleting || isReplacing}
                          onClick={() => { void onDownload(file) }}
                          className={clsx('size-8', isDownloading && 'animate-pulse')}
                        >
                          {isDownloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                        </IconButton>
                        <IconButton
                          label={`Reemplazar ${file.file_name}`}
                          size="sm"
                          disabled={isReplacing || isDeleting || isDownloading}
                          onClick={() => inputRefs.current.get(file.id)?.click()}
                          className={clsx('size-8', isReplacing && 'animate-pulse')}
                        >
                          {isReplacing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      label={`Eliminar ${file.file_name}`}
                      size="sm"
                      variant="danger"
                      disabled={isDeleting || isDownloading || isReplacing}
                      onClick={() => { setFileToDelete(file); setDeleteMessage(null) }}
                      className="size-8"
                    >
                      {isDeleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </IconButton>
                  </div>
                </div>
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
