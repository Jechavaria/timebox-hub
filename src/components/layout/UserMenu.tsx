import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import clsx from 'clsx'
import { ChevronDown, LogOut, Wallpaper } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.ts'
import { useToast } from '../../hooks/useToast.ts'
import { Spinner } from '../ui/Spinner.tsx'
import { BackgroundModal } from './BackgroundModal.tsx'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [showBackgrounds, setShowBackgrounds] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const email = user?.email ?? null
  const initial = (email ?? '?').charAt(0).toUpperCase()

  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    container?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !container?.contains(event.target)) setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
    )
    if (items.length === 0) return

    const index = items.findIndex((item) => item === document.activeElement)
    let nextIndex: number | null = null
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % items.length
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = items.length - 1

    if (nextIndex === null) return
    event.preventDefault()
    items[nextIndex].focus()
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    const result = await signOut()
    setSigningOut(false)
    if (!result.ok) toast.error(result.message, 'No se pudo cerrar la sesión')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Menú de usuario"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 touch-manipulation items-center gap-1.5 rounded-2xl border border-glass-border bg-glass-strong pl-1.5 pr-2.5 transition-[background-color,scale] duration-200 ease-out-soft hover:bg-glass-strong active:scale-[0.97]"
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-xl bg-accent-soft text-sm font-semibold text-accent"
        >
          {initial}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={clsx(
            'size-4 text-ink-muted transition-transform duration-200 ease-out-soft',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          className="glass-popover absolute right-0 top-full z-40 mt-2 w-64 origin-top-right animate-pop-in p-1.5"
        >
          <div className="px-3 py-2">
            <p className="text-xs text-ink-faint">Sesión iniciada como</p>
            <p className="truncate text-sm font-medium text-ink" title={email ?? undefined}>
              {email ?? 'Usuario'}
            </p>
          </div>
          <div role="separator" className="my-1 h-px bg-glass-border" />
          <div role="menu" aria-label="Cuenta" onKeyDown={handleMenuKeyDown}>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setShowBackgrounds(true) }}
              className="flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl px-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-glass-strong"
            >
              <Wallpaper aria-hidden="true" className="size-4 text-ink-muted" />
              Fondo de pantalla
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className="flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl px-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-glass-strong disabled:opacity-60"
            >
              {signingOut ? (
                <Spinner size="sm" decorative className="text-current" />
              ) : (
                <LogOut aria-hidden="true" className="size-4 text-ink-muted" />
              )}
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
      <BackgroundModal open={showBackgrounds} onClose={() => setShowBackgrounds(false)} />
    </div>
  )
}
