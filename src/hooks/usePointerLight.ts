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
    let frame = 0
    let pointerX = -9999
    let pointerY = -9999
    let hovered: HTMLElement | null = null
    let pressTimer = 0

    const flush = () => {
      frame = 0
      root.style.setProperty('--pointer-x', `${pointerX}px`)
      root.style.setProperty('--pointer-y', `${pointerY}px`)
    }

    const schedule = (event: PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      if (!frame) frame = requestAnimationFrame(flush)
    }

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

    const handleMove = (event: PointerEvent) => schedule(event)

    const handleOver = (event: PointerEvent) => {
      schedule(event)
      setHovered(findInteractive(event.target))
    }

    const handleOut = (event: PointerEvent) => {
      if (!event.relatedTarget) setHovered(null)
    }

    const handleDown = (event: PointerEvent) => {
      schedule(event)
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

    document.addEventListener('pointermove', handleMove, { passive: true })
    document.addEventListener('pointerover', handleOver, { passive: true })
    document.addEventListener('pointerout', handleOut, { passive: true })
    document.addEventListener('pointerdown', handleDown, { passive: true })

    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerover', handleOver)
      document.removeEventListener('pointerout', handleOut)
      document.removeEventListener('pointerdown', handleDown)
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(pressTimer)
      delete root.dataset.glow
    }
  }, [])
}
