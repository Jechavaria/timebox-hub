import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { IconButton } from './IconButton.tsx'

type ModalSize = 'sm' | 'md' | 'lg'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Si es false no hay botón de cierre y Esc/clic en el fondo no cierran el modal. */
  dismissible?: boolean
  size?: ModalSize
  footer?: ReactNode
  children: ReactNode
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const openModalIds: string[] = []

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  )
}

function setPageLocked(locked: boolean): void {
  document.documentElement.style.overflow = locked ? 'hidden' : ''
  const appRoot = document.getElementById('root')
  if (appRoot) appRoot.inert = locked
}

function trapTabKey(event: KeyboardEvent, panel: HTMLElement): void {
  const focusable = getFocusableElements(panel)
  if (focusable.length === 0) {
    event.preventDefault()
    panel.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const isOutside = !(active instanceof Node) || !panel.contains(active)

  if (event.shiftKey && (active === first || active === panel || isOutside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || isOutside)) {
    event.preventDefault()
    first.focus()
  }
}

export function Modal({
  open,
  onClose,
  title,
  description,
  dismissible = true,
  size = 'md',
  footer,
  children,
}: ModalProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    openModalIds.push(id)
    if (openModalIds.length === 1) setPageLocked(true)

    const initialTarget =
      panel.querySelector<HTMLElement>('[data-autofocus]') ?? getFocusableElements(panel)[0] ?? panel
    initialTarget.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openModalIds[openModalIds.length - 1] !== id) return
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        onCloseRef.current()
      } else if (event.key === 'Tab') {
        trapTabKey(event, panel)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      openModalIds.splice(openModalIds.indexOf(id), 1)
      if (openModalIds.length === 0) setPageLocked(false)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open, id, dismissible])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-sm"
        onMouseDown={(event) => event.preventDefault()}
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(
          'glass-popover relative flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-3xl rounded-b-none pb-[env(safe-area-inset-bottom)] sm:animate-pop-in sm:rounded-3xl sm:pb-0',
          SIZE_CLASS[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <IconButton label="Cerrar" size="sm" onClick={onClose} className="-mr-2 -mt-1">
              <X />
            </IconButton>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {children}
        </div>
        {footer ? (
          <footer className="border-t border-glass-border px-5 py-4 sm:px-6">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
