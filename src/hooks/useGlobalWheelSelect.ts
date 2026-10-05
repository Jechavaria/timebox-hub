import { useEffect } from 'react'

/**
 * Permite que al situar el cursor sobre cualquier <select> del sistema,
 * girar la rueda del ratón cambie de opción automáticamente sin necesidad
 * de abrir el menú desplegable.
 *
 * Optimizado para rendimiento y GPU:
 * NO bloquea el desplazamiento fluido global de window con listeners no pasivos.
 * El evento se asocia puntualmente a los elementos <select> al interactuar con ellos.
 */
export function useGlobalWheelSelect(): void {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const select = event.currentTarget as HTMLSelectElement
      if (!select || select.disabled || select.options.length <= 1) return

      event.preventDefault()
      const delta = event.deltaY > 0 ? 1 : -1
      const nextIndex = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + delta))

      if (nextIndex !== select.selectedIndex) {
        select.selectedIndex = nextIndex
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          'value',
        )?.set

        if (nativeSetter) {
          nativeSetter.call(select, select.options[nextIndex].value)
        }
        select.dispatchEvent(new Event('input', { bubbles: true }))
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    const handlePointerEnter = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      const select = target?.closest('select')
      if (select && !select.dataset.wheelHooked) {
        select.dataset.wheelHooked = 'true'
        select.addEventListener('wheel', handleWheel, { passive: false })
      }
    }

    document.addEventListener('pointerenter', handlePointerEnter, { capture: true, passive: true })

    return () => {
      document.removeEventListener('pointerenter', handlePointerEnter, { capture: true })
    }
  }, [])
}
