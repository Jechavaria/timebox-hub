import { useId, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import clsx from 'clsx'
import { FileUp } from 'lucide-react'
import type { MutationResult, TaskFile } from '../../types/domain.ts'

const ACCEPTED_TYPES = '.pdf,.docx,.xlsx,.md,.txt,.jpg,.jpeg,.png,.mp3,.m4a'

interface FileUploaderProps {
  disabled?: boolean
  onUpload: (files: File[]) => Promise<MutationResult<TaskFile[]>>
}

export function FileUploader({ disabled = false, onUpload }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  return (
    <div className="flex flex-col gap-1.5">
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
        <span className="text-xs text-ink-faint">PDF, DOCX, XLSX, MD, TXT, JPG, PNG, MP3 o M4A · hasta 25 MiB c/u</span>
        {!isUploading ? (
          <span aria-hidden="true" className="rounded-xl px-3 py-1 text-xs font-medium text-accent">
            Seleccionar archivos
          </span>
        ) : null}
      </label>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
