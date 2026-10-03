import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

const URL_REGEX = /(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+)/gi

export interface DetectedLink {
  url: string
  display: string
}

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function extractUrls(text: string): DetectedLink[] {
  if (!text) return []
  const matches = text.match(URL_REGEX)
  if (!matches) return []

  const unique = new Map<string, DetectedLink>()
  for (const match of matches) {
    // Limpiar signos de puntuación finales comunes como ., ), ,, ;, :, etc.
    const clean = match.replace(/[.,;:!?)]+$/, '')
    if (clean.length > 3 && !unique.has(clean)) {
      unique.set(clean, {
        url: normalizeUrl(clean),
        display: clean,
      })
    }
  }
  return Array.from(unique.values())
}

/**
 * Renderiza un texto reemplazando las URLs encontradas por enlaces <a> clicables
 * en color azul con apertura segura en una nueva pestaña.
 */
export function renderTextWithLinks(text: string): ReactNode {
  if (!text) return null

  const parts = text.split(URL_REGEX)
  if (parts.length <= 1) return text

  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Limpiar signos de puntuación finales si los hubiera
      const trailingPunctuation = part.match(/[.,;:!?)]+$/)?.[0] ?? ''
      const cleanUrl = part.slice(0, part.length - trailingPunctuation.length)
      const targetUrl = normalizeUrl(cleanUrl)

      return (
        <span key={index}>
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 font-medium text-blue-400 underline decoration-blue-400/60 hover:text-blue-300 hover:decoration-blue-300 transition-colors break-all cursor-pointer"
            title={`Abrir ${targetUrl}`}
          >
            <span>{cleanUrl}</span>
            <ExternalLink aria-hidden="true" className="size-3 shrink-0 inline ml-0.5 opacity-80" />
          </a>
          {trailingPunctuation}
        </span>
      )
    }
    return part
  })
}

/**
 * Barra interactiva de enlaces detectados en las notas para mostrar debajo de textareas.
 */
export function NotesLinkBar({ notes }: { notes: string }) {
  const links = extractUrls(notes)
  if (links.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 transition-all">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
        <ExternalLink className="size-3.5 shrink-0" />
        <span>Enlaces detectados en las notas ({links.length}):</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {links.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group flex max-w-full items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300 hover:border-blue-400 hover:bg-blue-500/25 hover:text-blue-100 transition-all cursor-pointer shadow-sm"
            title={`Abrir ${link.url} en una pestaña nueva`}
          >
            <ExternalLink className="size-3 shrink-0 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="truncate max-w-[240px] sm:max-w-[320px]">{link.display}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
