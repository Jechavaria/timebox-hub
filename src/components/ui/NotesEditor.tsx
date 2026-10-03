import { useRef } from 'react'
import type { ChangeEvent, MouseEvent, UIEvent } from 'react'
import { extractUrlsWithIndices, renderHighlightedNotes } from '../../lib/linkUtils.tsx'

export interface NotesEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  disabled?: boolean
  className?: string
}

/**
 * Editor de notas con resaltado automático de enlaces en color azul sin necesidad de alternar
 * modos. El usuario edita directamente y cualquier URL se muestra en azul de forma instantánea.
 */
export function NotesEditor({
  id,
  value,
  onChange,
  placeholder = 'Notas, detalles o enlaces (se detectarán automáticamente)...',
  rows = 3,
  maxLength = 4000,
  disabled = false,
  className,
}: NotesEditorProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleClick = (e: MouseEvent<HTMLTextAreaElement>) => {
    // Si el usuario hace Ctrl+Clic o Cmd+Clic sobre un enlace dentro del texto, abrirlo directamente
    if (e.ctrlKey || e.metaKey) {
      const cursor = e.currentTarget.selectionStart
      const links = extractUrlsWithIndices(value)
      const clickedLink = links.find((l) => cursor >= l.start && cursor <= l.end)
      if (clickedLink) {
        window.open(clickedLink.url, '_blank', 'noopener,noreferrer')
      }
    }
  }

  return (
    <div
      className={`relative w-full rounded-xl border border-glass-border bg-glass/60 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all ${className ?? ''}`}
    >
      {/* Capa de fondo con texto formateado: los enlaces se muestran en azul */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 m-0 p-3 font-sans text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden border border-transparent text-ink"
      >
        {renderHighlightedNotes(value)}
      </div>

      {/* Textarea interactivo: el texto typed es transparente para mostrar el fondo con enlaces en azul */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={handleChange}
        onScroll={handleScroll}
        onClick={handleClick}
        className="relative m-0 w-full resize-y rounded-xl border border-transparent bg-transparent p-3 font-sans text-sm leading-relaxed whitespace-pre-wrap break-words text-transparent placeholder:text-ink-faint focus:outline-none selection:bg-accent/30 selection:text-ink transition-colors"
        style={{ caretColor: 'var(--color-ink, #f3f5fa)' }}
      />
    </div>
  )
}
