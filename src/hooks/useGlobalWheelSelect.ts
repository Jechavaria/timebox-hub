import { useEffect } from 'react'

/**
 * Permite que al situar el cursor sobre cualquier <select> del sistema,
 * girar la rueda del ratón cambie de opción automáticamente sin necesidad
 * de abrir el menú desplegable.
 */
export function useGlobalWheelSelect(): void {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null
      const select = target?.closest('select')
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

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])
}
