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
    let lastX = -9999
    let lastY = -9999
    let hovered: HTMLElement | null = null
    let pressTimer = 0

    const flush = () => {
      frame = 0
      // Evitar reflujo si el puntero se movió menos de 2px
      if (Math.abs(pointerX - lastX) >= 2 || Math.abs(pointerY - lastY) >= 2) {
        lastX = pointerX
        lastY = pointerY
        root.style.setProperty('--pointer-x', `${pointerX}px`)
        root.style.setProperty('--pointer-y', `${pointerY}px`)
      }
    }

    const schedule = (event: PointerEvent) => {
      // Ignorar toques táctiles directos para no degradar el scroll en móviles
      if (event.pointerType === 'touch') return
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

    const handleLeave = () => {
      setHovered(null)
      root.style.setProperty('--pointer-x', '-9999px')
      root.style.setProperty('--pointer-y', '-9999px')
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
    document.addEventListener('mouseleave', handleLeave)

    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerover', handleOver)
      document.removeEventListener('pointerout', handleOut)
      document.removeEventListener('pointerdown', handleDown)
      document.removeEventListener('mouseleave', handleLeave)
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(pressTimer)
      delete root.dataset.glow
    }
  }, [])
}
