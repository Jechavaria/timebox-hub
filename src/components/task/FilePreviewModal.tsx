import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileSpreadsheet, FileText, LoaderCircle, Music2, Presentation, X } from 'lucide-react'
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
          (() => {
            const isOfficeDoc = Boolean(
              file.file_name.endsWith('.docx') ||
              file.file_name.endsWith('.doc') ||
              file.file_name.endsWith('.xlsx') ||
              file.file_name.endsWith('.xls') ||
              file.file_name.endsWith('.pptx') ||
              file.file_name.endsWith('.ppt') ||
              file.file_type.includes('spreadsheet') ||
              file.file_type.includes('wordprocessingml') ||
              file.file_type.includes('presentationml')
            )
            const isSpreadsheet = file.file_name.endsWith('.xlsx') || file.file_name.endsWith('.xls') || file.file_type.includes('spreadsheet')
            const isPresentation = file.file_name.endsWith('.pptx') || file.file_name.endsWith('.ppt')
            const googleViewerUrl = previewUrl ? `https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}` : null
            const officeViewerUrl = previewUrl ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(previewUrl)}` : null

            return (
              <div className="flex max-w-md flex-col items-center gap-3 p-6 text-center">
                <div className="grid size-16 place-items-center rounded-2xl bg-white/10 text-ink shadow-sm">
                  {isSpreadsheet ? (
                    <FileSpreadsheet className="size-8 text-emerald-400" />
                  ) : isPresentation ? (
                    <Presentation className="size-8 text-amber-400" />
                  ) : (
                    <FileText className="size-8 text-accent" />
                  )}
                </div>

                <div>
                  <p className="font-semibold text-base text-ink">{file.file_name}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {formatBytes(file.file_size)} · {isOfficeDoc ? 'Documento de Office / Hoja de cálculo' : file.file_type || 'Archivo binario'}
                  </p>
                </div>

                {isOfficeDoc ? (
                  <div className="flex flex-col gap-2.5 w-full pt-1">
                    <div className="flex flex-col sm:flex-row gap-2 justify-center w-full">
                      {googleViewerUrl ? (
                        <a
                          href={googleViewerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-300 hover:border-blue-400 hover:bg-blue-500/25 transition-all cursor-pointer shadow-sm"
                        >
                          <ExternalLink className="size-3.5" />
                          <span>Ver en Google Docs Viewer</span>
                        </a>
                      ) : null}

                      {officeViewerUrl ? (
                        <a
                          href={officeViewerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-300 hover:border-amber-400 hover:bg-amber-500/25 transition-all cursor-pointer shadow-sm"
                        >
                          <ExternalLink className="size-3.5" />
                          <span>Ver en Office Online</span>
                        </a>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5 text-left text-xs text-blue-300/90 leading-snug">
                      <p className="font-semibold text-blue-200 flex items-center gap-1 mb-0.5">
                        💡 ¿Quieres editar en vivo sin descargar y resubir?
                      </p>
                      <p className="text-[11px]">
                        Puedes adjuntar un enlace de <strong>Google Docs</strong> o <strong>Google Sheets</strong> a esta tarea. Google guarda los cambios automáticamente en la nube en tiempo real.
                      </p>
                    </div>

                    <Button variant="secondary" onClick={() => onDownload(file)} className="mt-1">
                      <Download className="size-4" />
                      Descargar archivo local ({formatBytes(file.file_size)})
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-ink-muted">
                      Este formato requiere descargarse para abrirlo con su aplicación correspondiente en tu dispositivo.
                    </p>
                    <Button variant="primary" onClick={() => onDownload(file)} className="mt-2">
                      <Download className="size-4" />
                      Descargar archivo ({formatBytes(file.file_size)})
                    </Button>
                  </>
                )}
              </div>
            )
          })()
        )}
      </div>
    </Modal>
  )
}
