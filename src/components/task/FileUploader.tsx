import { useId, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import clsx from 'clsx'
import { Cloud, FileSpreadsheet, FileText, FileUp, Link2, Plus, Presentation } from 'lucide-react'
import type { MutationResult, TaskFile } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { detectCloudDocService } from '../../lib/linkUtils.tsx'

const ACCEPTED_TYPES = '*/*'

interface FileUploaderProps {
  disabled?: boolean
  onUpload: (files: File[]) => Promise<MutationResult<TaskFile[]>>
  onAddLink?: (url: string, name?: string) => Promise<MutationResult<TaskFile>>
}

export function FileUploader({ disabled = false, onUpload, onAddLink }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [isAddingLink, setIsAddingLink] = useState(false)
  const inputId = useId()

  const upload = async (files: File[]) => {
    if (disabled || isUploading || files.length === 0) return
    setIsUploading(true)
    setError(null)
    const result = await onUpload(files)
    setIsUploading(false)
    if (!result.ok) setError(result.message)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    void upload(files)
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (!disabled && !isUploading) setIsDragging(true)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void upload(Array.from(event.dataTransfer.files))
  }

  const handleLinkSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!onAddLink || !linkUrl.trim()) return
    setIsAddingLink(true)
    setError(null)
    const result = await onAddLink(linkUrl.trim(), linkTitle.trim() || undefined)
    setIsAddingLink(false)
    if (!result.ok) {
      setError(result.message)
    } else {
      setLinkUrl('')
      setLinkTitle('')
      setShowLinkForm(false)
    }
  }

  const detectedDoc = linkUrl.trim() ? detectCloudDocService(linkUrl.trim()) : null

  const handleCreateCloudDoc = (type: 'docs' | 'sheets' | 'slides') => {
    const targetUrl = type === 'docs' ? 'https://docs.new' : type === 'sheets' ? 'https://sheets.new' : 'https://slides.new'
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    setShowLinkForm(true)
    if (!linkTitle) {
      setLinkTitle(type === 'docs' ? 'Documento de Google' : type === 'sheets' ? 'Hoja de cálculo de Google' : 'Presentación de Google')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false)
        }}
        onDrop={handleDrop}
        aria-disabled={disabled || isUploading}
        className={clsx(
          'flex min-h-24 cursor-pointer touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-4 text-center transition-[background-color,border-color,opacity] duration-200',
          isDragging ? 'border-accent bg-accent-soft' : 'border-glass-border bg-glass hover:border-white/25',
          (disabled || isUploading) && 'pointer-events-none opacity-55',
        )}
      >
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          disabled={disabled || isUploading}
          onChange={handleChange}
          className="sr-only"
        />
        <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
          <FileUp aria-hidden="true" className="size-5" />
        </span>
        <span className="text-sm font-medium text-ink">
          {isUploading ? 'Subiendo archivos...' : isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o selecciónalos'}
        </span>
        <span className="text-xs text-ink-faint">Documentos, imágenes, audio, video, código · hasta 25 MiB c/u</span>
        {!isUploading ? (
          <span aria-hidden="true" className="rounded-xl px-3 py-1 text-xs font-medium text-accent">
            Seleccionar archivos
          </span>
        ) : null}
      </label>

      {/* Accesos rápidos para Google Docs / Sheets y enlaces en la nube */}
      {onAddLink ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass/60 p-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Cloud className="size-3.5 text-blue-400" />
              <span>Documentos en la nube (sin descargar)</span>
            </span>
            <span className="text-[10px] text-ink-faint">Autoguardado en vivo</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleCreateCloudDoc('docs')}
              className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300 hover:border-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer"
              title="Abrir docs.new para crear y editar un nuevo documento de Google"
            >
              <FileText className="size-3 text-blue-400" />
              <span>+ Google Doc</span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateCloudDoc('sheets')}
              className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
              title="Abrir sheets.new para crear y editar una nueva hoja de cálculo"
            >
              <FileSpreadsheet className="size-3 text-emerald-400" />
              <span>+ Google Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateCloudDoc('slides')}
              className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:border-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
              title="Abrir slides.new para crear y editar una nueva presentación"
            >
              <Presentation className="size-3 text-amber-400" />
              <span>+ Google Slides</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLinkForm((prev) => !prev)}
              className="flex items-center gap-1 rounded-lg border border-glass-border/70 bg-glass/60 px-2 py-1 text-[11px] font-medium text-ink-muted hover:border-accent hover:text-ink transition-all cursor-pointer ml-auto"
            >
              <Link2 className="size-3 text-accent" />
              <span>{showLinkForm ? 'Cerrar' : '+ Pegar enlace'}</span>
            </button>
          </div>

          {showLinkForm ? (
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-2 rounded-xl border border-glass-border bg-glass/90 p-3 shadow-md mt-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-ink">URL del enlace o documento</label>
                  {detectedDoc?.isCloudDoc ? (
                    <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${detectedDoc.badgeColor}`}>
                      ☁️ {detectedDoc.label} detectado
                    </span>
                  ) : null}
                </div>
                <input
                  type="text"
                  placeholder="https://docs.google.com/... o enlace web"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value)
                    const det = detectCloudDocService(e.target.value)
                    if (det.isCloudDoc && !linkTitle) {
                      setLinkTitle(det.label)
                    }
                  }}
                  className="glass-input text-xs"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Título o nombre (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Tarea en Docs, Finanzas en Sheets, Referencia..."
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  className="glass-input text-xs"
                />
              </div>

              {detectedDoc?.isCloudDoc ? (
                <p className="text-[11px] text-blue-300/90 leading-tight">
                  ✨ Los cambios que hagas en Google Docs / Sheets se guardarán automáticamente en la nube sin tener que volver a subir o descargar el archivo.
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setShowLinkForm(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" type="submit" loading={isAddingLink} leadingIcon={<Plus className="size-3.5" />}>
                  Vincular enlace
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
