import { useEffect } from 'react'

const INTERACTIVE_SELECTOR = 'button, a[href], [role="button"], summary'
const PULSE_MS = 260

function findInteractive(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const element = target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
  if (!element) return null
  if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') return null
  return element
}

/**
 * Hace que los botones "emitan luz" sobre las superficies acrílicas:
 * - Actualiza --pointer-x / --pointer-y en <html> (una vez por frame).
 * - data-glow="hover" mientras el puntero está sobre un elemento clicable.
 * - data-glow="press" + [data-pulse] en el botón durante un instante tras el clic.
 * - --light-color toma el color de brillo del botón (p. ej. rojo en botones de peligro).
 */
export function usePointerLight(): void {
  useEffect(() => {
    const root = document.documentElement
    let hovered: HTMLElement | null = null
    let pressTimer = 0

    const setHovered = (element: HTMLElement | null) => {
      if (element === hovered) return
      hovered = element
      if (element) {
        const color = getComputedStyle(element).getPropertyValue('--glow-color').trim()
        if (color) root.style.setProperty('--light-color', color)
        else root.style.removeProperty('--light-color')
        if (root.dataset.glow !== 'press') root.dataset.glow = 'hover'
      } else if (root.dataset.glow !== 'press') {
        delete root.dataset.glow
      }
    }

    const handleOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      setHovered(findInteractive(event.target))
    }

    const handleOut = (event: PointerEvent) => {
      if (!event.relatedTarget) setHovered(null)
    }

    const handleLeave = () => {
      setHovered(null)
    }

    const handleDown = (event: PointerEvent) => {
      const element = findInteractive(event.target)
      if (!element) return
      setHovered(element)
      root.dataset.glow = 'press'
      element.dataset.pulse = ''
      window.clearTimeout(pressTimer)
      pressTimer = window.setTimeout(() => {
        delete element.dataset.pulse
        const stillHovered = event.pointerType === 'mouse' && hovered !== null
        if (stillHovered) root.dataset.glow = 'hover'
        else {
          delete root.dataset.glow
          if (event.pointerType !== 'mouse') hovered = null
        }
      }, PULSE_MS)
    }

    document.addEventListener('pointerover', handleOver, { passive: true })
    document.addEventListener('pointerout', handleOut, { passive: true })
    document.addEventListener('pointerdown', handleDown, { passive: true })
    document.addEventListener('mouseleave', handleLeave)

    return () => {
      document.removeEventListener('pointerover', handleOver)
      document.removeEventListener('pointerout', handleOut)
      document.removeEventListener('pointerdown', handleDown)
      document.removeEventListener('mouseleave', handleLeave)
      window.clearTimeout(pressTimer)
      delete root.dataset.glow
    }
  }, [])
}
