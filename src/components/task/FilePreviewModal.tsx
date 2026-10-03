import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileSpreadsheet, FileText, LoaderCircle, Music2, X } from 'lucide-react'
import type { TaskFile } from '../../types/domain.ts'
import { formatBytes } from '../../lib/files.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'

interface FilePreviewModalProps {
  open: boolean
  onClose: () => void
  file: TaskFile | null
  previewUrl: string | null
  loading: boolean
  onDownload: (file: TaskFile) => void
}

function isTextLike(mime: string, name: string): boolean {
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') return true
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ['md', 'txt', 'js', 'ts', 'jsx', 'tsx', 'py', 'c', 'cpp', 'h', 'hpp', 'cs', 'ino', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'toml', 'sql', 'sh', 'bat', 'ps1', 'diff', 'patch'].includes(ext)
}

export function FilePreviewModal({
  open,
  onClose,
  file,
  previewUrl,
  loading,
  onDownload,
}: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)

  const isImage = file?.file_type.startsWith('image/')
  const isVideo = file?.file_type.startsWith('video/')
  const isAudio = file?.file_type.startsWith('audio/')
  const isPdf = file?.file_type === 'application/pdf'
  const isCodeOrText = Boolean(file && isTextLike(file.file_type, file.file_name))

  useEffect(() => {
    if (!open || !file || !previewUrl || !isCodeOrText) {
      setTextContent(null)
      setTextError(null)
      return
    }

    let active = true
    setLoadingText(true)
    setTextError(null)

    fetch(previewUrl)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el archivo')
        return res.text()
      })
      .then((text) => {
        if (active) {
          setTextContent(text)
          setLoadingText(false)
        }
      })
      .catch((err) => {
        if (active) {
          setTextError((err as Error).message)
          setLoadingText(false)
        }
      })

    return () => {
      active = false
    }
  }, [open, file, previewUrl, isCodeOrText])

  if (!file) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={file.file_name}
      description={`${formatBytes(file.file_size)} · ${file.file_type}`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Abrir en pestaña nueva
            </a>
          ) : <div />}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onDownload(file)}>
              <Download className="size-4" />
              Descargar
            </Button>
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-xl bg-black/40 p-2 sm:p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-2 p-8 text-ink-muted">
            <LoaderCircle className="size-8 animate-spin text-accent" />
            <p className="text-sm">Generando vista previa segura...</p>
          </div>
        ) : !previewUrl ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-ink-muted">
            <X className="size-8 text-danger" />
            <p className="text-sm">No fue posible cargar la vista previa.</p>
          </div>
        ) : isImage ? (
          <div className="flex max-h-[72vh] w-full items-center justify-center overflow-auto">
            <img
              src={previewUrl}
              alt={file.file_name}
              className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-lg"
            />
          </div>
        ) : isVideo ? (
          <div className="flex max-h-[72vh] w-full items-center justify-center">
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-h-[70vh] w-full rounded-lg shadow-lg"
            >
              Tu navegador no soporta reproducción de video.
            </video>
          </div>
        ) : isAudio ? (
          <div className="flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
            <div className="grid size-20 place-items-center rounded-2xl bg-accent-soft text-accent shadow-inner">
              <Music2 className="size-10" />
            </div>
            <div>
              <p className="font-semibold text-ink">{file.file_name}</p>
              <p className="text-xs text-ink-muted">{formatBytes(file.file_size)}</p>
            </div>
            <audio src={previewUrl} controls autoPlay className="w-full pt-2" />
          </div>
        ) : isPdf ? (
          <iframe
            src={`${previewUrl}#toolbar=1`}
            title={file.file_name}
            className="h-[72vh] w-full rounded-lg border border-glass-border bg-white"
          />
        ) : isCodeOrText ? (
          <div className="w-full">
            {loadingText ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-ink-muted">
                <LoaderCircle className="size-5 animate-spin text-accent" />
                Cargando contenido de texto...
              </div>
            ) : textError ? (
              <p className="p-4 text-center text-sm text-danger">{textError}</p>
            ) : (
              <pre className="max-h-[70vh] w-full overflow-auto rounded-lg bg-black/60 p-4 font-mono text-xs text-emerald-300 select-text leading-relaxed">
                <code>{textContent}</code>
              </pre>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="grid size-16 place-items-center rounded-2xl bg-white/10 text-ink">
              {file.file_type.includes('spreadsheet') || file.file_name.endsWith('.xlsx') || file.file_name.endsWith('.xlsm') ? (
                <FileSpreadsheet className="size-8 text-emerald-400" />
              ) : (
                <FileText className="size-8 text-accent" />
              )}
            </div>
            <div>
              <p className="font-medium text-ink">{file.file_name}</p>
              <p className="text-xs text-ink-muted">
                Este formato ({file.file_type || 'archivo binario'}) requiere descargarse para abrirlo con su aplicación correspondiente (Excel, Word, software CAD, etc.).
              </p>
            </div>
            <Button variant="primary" onClick={() => onDownload(file)} className="mt-2">
              <Download className="size-4" />
              Descargar archivo ({formatBytes(file.file_size)})
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
