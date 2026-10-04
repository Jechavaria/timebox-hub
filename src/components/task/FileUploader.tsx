import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import clsx from 'clsx'
import {
  ClipboardPaste,
  Cloud,
  FileSpreadsheet,
  FileText,
  FileUp,
  Link2,
  Plus,
  Presentation,
  Sparkles,
} from 'lucide-react'
import type { MutationResult, TaskFile } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { detectCloudDocService } from '../../lib/linkUtils.tsx'

const ACCEPTED_TYPES = '*/*'

interface FileUploaderProps {
  disabled?: boolean
  onUpload: (files: File[]) => Promise<MutationResult<TaskFile[]>>
  onAddLink?: (url: string, name?: string) => Promise<MutationResult<TaskFile>>
}

interface PendingCloudDoc {
  type: 'docs' | 'sheets' | 'slides'
  title: string
}

export function FileUploader({ disabled = false, onUpload, onAddLink }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [isAddingLink, setIsAddingLink] = useState(false)
  const [pendingDoc, setPendingDoc] = useState<PendingCloudDoc | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
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
      setPendingDoc(null)
      setShowLinkForm(false)
    }
  }

  const handleCreateCloudDoc = (type: 'docs' | 'sheets' | 'slides') => {
    const targetUrl =
      type === 'docs' ? 'https://docs.new' : type === 'sheets' ? 'https://sheets.new' : 'https://slides.new'
    const defaultTitle =
      type === 'docs'
        ? 'Documento en la nube'
        : type === 'sheets'
          ? 'Hoja de cálculo en la nube'
          : 'Presentación en la nube'

    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    setPendingDoc({ type, title: defaultTitle })
    if (!linkTitle) setLinkTitle(defaultTitle)
    setError(null)
  }

  const handlePasteAndLinkFromClipboard = async () => {
    if (!onAddLink) return
    setError(null)
    try {
      if (!navigator.clipboard?.readText) {
        setError('Tu navegador requiere pegar manualmente. Por favor presiona Ctrl+V en el campo de texto de abajo.')
        urlInputRef.current?.focus()
        return
      }

      const text = (await navigator.clipboard.readText()).trim()
      if (!text) {
        setError('El portapapeles está vacío. Por favor copia la URL de la pestaña del documento y vuelve a presionar este botón.')
        return
      }

      const isUrl = /^https?:\/\//i.test(text)
      if (!isUrl) {
        setError('El texto copiado no parece ser un enlace web. Copia la URL de la barra de direcciones.')
        setLinkUrl(text)
        urlInputRef.current?.focus()
        return
      }

      setLinkUrl(text)
      const titleToUse = linkTitle.trim() || (pendingDoc ? pendingDoc.title : 'Documento en la nube')

      setIsAddingLink(true)
      const result = await onAddLink(text, titleToUse)
      setIsAddingLink(false)

      if (!result.ok) {
        setError(result.message)
      } else {
        setLinkUrl('')
        setLinkTitle('')
        setPendingDoc(null)
        setShowLinkForm(false)
      }
    } catch {
      setError('No se pudo leer el portapapeles automáticamente. Pega el enlace en el campo de texto con Ctrl+V.')
      urlInputRef.current?.focus()
    }
  }

  const handleQuickPasteIntoInput = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = (await navigator.clipboard.readText()).trim()
        if (text) {
          setLinkUrl(text)
          const det = detectCloudDocService(text)
          if (det.isCloudDoc && !linkTitle) {
            setLinkTitle(det.label)
          }
        }
      }
    } catch {
      urlInputRef.current?.focus()
    }
  }

  const detectedDoc = linkUrl.trim() ? detectCloudDocService(linkUrl.trim()) : null

  return (
    <div className="flex flex-col gap-2">
      {/* Zona de subida de archivos locales */}
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

      {/* Botón y formulario para añadir enlaces y documentos en la nube */}
      {onAddLink ? (
        <div className="flex flex-col gap-2">
          {!showLinkForm ? (
            <button
              type="button"
              onClick={() => {
                setShowLinkForm(true)
                setError(null)
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-glass-border/80 bg-glass/60 px-3 py-2 text-xs font-medium text-ink-muted hover:border-accent hover:bg-glass hover:text-ink transition-all cursor-pointer"
            >
              <Link2 className="size-3.5 text-accent" />
              <span>+ Añadir enlace o documento en la nube</span>
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-glass-border bg-glass/95 p-3.5 shadow-lg">
              {/* Encabezado del panel de enlace */}
              <div className="flex items-center justify-between border-b border-glass-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-blue-500/20 text-blue-400">
                    <Cloud className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-ink">Añadir enlace o documento en la nube</p>
                    <p className="text-[10px] text-ink-faint">Edita en el navegador con autoguardado sin descargar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkForm(false)
                    setPendingDoc(null)
                    setError(null)
                  }}
                  className="rounded-lg p-1 text-xs text-ink-muted hover:bg-white/10 hover:text-ink transition-colors cursor-pointer"
                  title="Cerrar formulario"
                >
                  ✕
                </button>
              </div>

              {/* Opciones rápidas de documentos en la nube dentro de Añadir Enlace */}
              <div className="flex flex-col gap-2 rounded-xl border border-blue-500/25 bg-blue-500/5 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-300">
                    Crear nuevo documento en la nube:
                  </span>
                  <span className="text-[10px] text-blue-300/70">Abre y vincula a esta tarea</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCreateCloudDoc('docs')}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-200 hover:border-blue-400 hover:bg-blue-500/30 transition-all cursor-pointer shadow-xs"
                    title="Crear un nuevo documento de texto y vincularlo a esta tarea"
                  >
                    <FileText className="size-3.5 text-blue-400" />
                    <span>+ Documento de texto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateCloudDoc('sheets')}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/30 transition-all cursor-pointer shadow-xs"
                    title="Crear una nueva hoja de cálculo y vincularla a esta tarea"
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-400" />
                    <span>+ Hoja de cálculo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateCloudDoc('slides')}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-400 hover:bg-amber-500/30 transition-all cursor-pointer shadow-xs"
                    title="Crear una nueva presentación y vincularla a esta tarea"
                  >
                    <Presentation className="size-3.5 text-amber-400" />
                    <span>+ Presentación</span>
                  </button>
                </div>

                {/* Banner guiado cuando se acaba de abrir un documento nuevo */}
                {pendingDoc ? (
                  <div className="mt-1 flex flex-col gap-2 rounded-xl border border-blue-400/40 bg-blue-500/20 p-2.5 animate-fade-in">
                    <div className="flex items-start gap-2">
                      <Sparkles className="size-4 text-blue-300 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="font-semibold text-white">
                          ¡Se abrió tu nuevo {pendingDoc.title}!
                        </span>
                        <span className="text-[11px] text-blue-200 leading-tight">
                          Para que quede adjunto a esta tarea y puedas volver a él en cualquier momento:
                          copia la URL de la pestaña que se abrió y presiona el botón:
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="primary"
                        type="button"
                        loading={isAddingLink}
                        onClick={handlePasteAndLinkFromClipboard}
                        leadingIcon={<ClipboardPaste className="size-3.5" />}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md"
                      >
                        📋 Pegar enlace copiado y vincular a la tarea
                      </Button>
                      <button
                        type="button"
                        onClick={() => setPendingDoc(null)}
                        className="text-[11px] text-blue-300 hover:underline px-1 cursor-pointer"
                      >
                        O pegar en el campo de abajo
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Formulario manual de URL o enlace existente */}
              <form onSubmit={handleLinkSubmit} className="flex flex-col gap-2.5 pt-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-ink">
                      URL del documento o enlace web
                    </label>
                    {detectedDoc?.isCloudDoc ? (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${detectedDoc.badgeColor}`}>
                        ☁️ {detectedDoc.label} detectado
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      ref={urlInputRef}
                      type="text"
                      placeholder="https://... enlace al documento o web"
                      value={linkUrl}
                      onChange={(e) => {
                        setLinkUrl(e.target.value)
                        const det = detectCloudDocService(e.target.value)
                        if (det.isCloudDoc && !linkTitle) {
                          setLinkTitle(det.label)
                        }
                      }}
                      className="glass-input text-xs flex-1"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleQuickPasteIntoInput}
                      title="Pegar del portapapeles"
                      className="flex items-center gap-1 rounded-xl border border-glass-border bg-glass/80 px-2.5 py-2 text-xs font-medium text-ink-muted hover:border-accent hover:text-ink transition-colors cursor-pointer shrink-0"
                    >
                      <ClipboardPaste className="size-3.5" />
                      <span>Pegar</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink">Título o nombre (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. Apuntes, Finanzas, Proyecto..."
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>

                {detectedDoc?.isCloudDoc ? (
                  <p className="text-[11px] text-blue-300/90 leading-tight">
                    ✨ Los cambios que hagas en tus documentos en línea se guardarán automáticamente en la nube sin tener que volver a subir o descargar el archivo.
                  </p>
                ) : null}

                <div className="flex justify-end gap-2 pt-1 border-t border-glass-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowLinkForm(false)
                      setPendingDoc(null)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    type="submit"
                    loading={isAddingLink}
                    disabled={!linkUrl.trim()}
                    leadingIcon={<Plus className="size-3.5" />}
                  >
                    Vincular a la tarea
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
