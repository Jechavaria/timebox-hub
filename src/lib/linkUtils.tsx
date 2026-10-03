import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

const URL_REGEX = /(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+)/gi

export interface DetectedLink {
  url: string
  display: string
}

export type CloudDocType =
  | 'google_docs'
  | 'google_sheets'
  | 'google_slides'
  | 'google_drive'
  | 'office_word'
  | 'office_excel'
  | 'office_powerpoint'
  | 'generic'

export interface CloudDocServiceInfo {
  type: CloudDocType
  label: string
  serviceName: string
  isCloudDoc: boolean
  badgeColor: string
  textColor: string
  actionLabel: string
}

export function detectCloudDocService(url: string): CloudDocServiceInfo {
  const u = url.toLowerCase()
  if (u.includes('docs.google.com/document') || u.includes('docs.new')) {
    return {
      type: 'google_docs',
      label: 'Google Docs',
      serviceName: 'Google Docs',
      isCloudDoc: true,
      badgeColor: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
      textColor: 'text-blue-400',
      actionLabel: 'Abrir y editar en Google Docs',
    }
  }
  if (u.includes('docs.google.com/spreadsheets') || u.includes('sheets.new')) {
    return {
      type: 'google_sheets',
      label: 'Google Sheets',
      serviceName: 'Google Sheets',
      isCloudDoc: true,
      badgeColor: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
      textColor: 'text-emerald-400',
      actionLabel: 'Abrir y editar en Google Sheets',
    }
  }
  if (u.includes('docs.google.com/presentation') || u.includes('slides.new')) {
    return {
      type: 'google_slides',
      label: 'Google Slides',
      serviceName: 'Google Slides',
      isCloudDoc: true,
      badgeColor: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
      textColor: 'text-amber-400',
      actionLabel: 'Abrir y editar en Google Slides',
    }
  }
  if (u.includes('drive.google.com')) {
    return {
      type: 'google_drive',
      label: 'Google Drive',
      serviceName: 'Google Drive',
      isCloudDoc: true,
      badgeColor: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
      textColor: 'text-cyan-400',
      actionLabel: 'Abrir en Google Drive',
    }
  }
  if (u.includes('word.office.com') || (u.includes('sharepoint.com') && u.includes('.doc'))) {
    return {
      type: 'office_word',
      label: 'Word Online',
      serviceName: 'Microsoft 365',
      isCloudDoc: true,
      badgeColor: 'border-blue-600/40 bg-blue-600/15 text-blue-300',
      textColor: 'text-blue-400',
      actionLabel: 'Abrir y editar en Word Online',
    }
  }
  if (u.includes('excel.office.com') || (u.includes('sharepoint.com') && u.includes('.xls'))) {
    return {
      type: 'office_excel',
      label: 'Excel Online',
      serviceName: 'Microsoft 365',
      isCloudDoc: true,
      badgeColor: 'border-emerald-600/40 bg-emerald-600/15 text-emerald-300',
      textColor: 'text-emerald-400',
      actionLabel: 'Abrir y editar en Excel Online',
    }
  }
  if (u.includes('powerpoint.office.com') || (u.includes('sharepoint.com') && u.includes('.ppt'))) {
    return {
      type: 'office_powerpoint',
      label: 'PowerPoint Online',
      serviceName: 'Microsoft 365',
      isCloudDoc: true,
      badgeColor: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
      textColor: 'text-orange-400',
      actionLabel: 'Abrir y editar en PowerPoint Online',
    }
  }
  return {
    type: 'generic',
    label: 'Enlace web',
    serviceName: 'Web',
    isCloudDoc: false,
    badgeColor: 'border-accent/40 bg-accent/15 text-accent',
    textColor: 'text-accent',
    actionLabel: 'Abrir enlace',
  }
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
export interface ExtractedUrlWithIndex {
  url: string
  display: string
  start: number
  end: number
}

export function extractUrlsWithIndices(text: string): ExtractedUrlWithIndex[] {
  if (!text) return []
  const regex = /(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+)/gi
  const results: ExtractedUrlWithIndex[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0]
    const trailingPunctuation = raw.match(/[.,;:!?)]+$/)?.[0] ?? ''
    const clean = raw.slice(0, raw.length - trailingPunctuation.length)
    if (clean.length > 3) {
      results.push({
        url: normalizeUrl(clean),
        display: clean,
        start: match.index,
        end: match.index + clean.length,
      })
    }
  }
  return results
}

/**
 * Renderiza el texto formateado para el fondo del editor de notas,
 * coloreando las URLs automáticamente en azul con subrayado.
 */
export function renderHighlightedNotes(text: string): ReactNode {
  if (!text) return null
  const content = text.endsWith('\n') ? text + ' ' : text
  const parts = content.split(/(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+)/gi)

  return parts.map((part, index) => {
    if (/(https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+)/i.test(part)) {
      const trailingPunctuation = part.match(/[.,;:!?)]+$/)?.[0] ?? ''
      const cleanUrl = part.slice(0, part.length - trailingPunctuation.length)
      return (
        <span key={index}>
          <span className="text-blue-400 font-semibold underline decoration-blue-400/80">
            {cleanUrl}
          </span>
          <span className="text-ink">{trailingPunctuation}</span>
        </span>
      )
    }
    return <span key={index} className="text-ink">{part}</span>
  })
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
