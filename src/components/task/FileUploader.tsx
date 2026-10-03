import { useId, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import clsx from 'clsx'
import { FileUp, Link2, Plus } from 'lucide-react'
import type { MutationResult, TaskFile } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'

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

      {/* Opción para adjuntar enlace web */}
      {onAddLink ? (
        <div className="flex flex-col gap-2 pt-0.5">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowLinkForm((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline cursor-pointer"
            >
              <Link2 className="size-3.5" />
              {showLinkForm ? 'Cerrar formulario de enlace' : '+ Adjuntar enlace web (URL)'}
            </button>
          </div>

          {showLinkForm ? (
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass/80 p-3 shadow-md">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">URL del enlace</label>
                <input
                  type="text"
                  placeholder="https://ejemplo.com o www.ejemplo.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="glass-input text-xs"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink">Título o descripción (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Documentación, Repositorio, Figma, Tarea..."
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  className="glass-input text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setShowLinkForm(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" type="submit" loading={isAddingLink} leadingIcon={<Plus className="size-3.5" />}>
                  Añadir enlace
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
