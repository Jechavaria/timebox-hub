import { useEffect, useRef } from 'react'
import { useAppearance } from '../../hooks/useAppearance.ts'

/**
 * Capa de fondo a pantalla completa (imagen o video) detrás de toda la interfaz.
 * Los degradados integrados los pinta body::before en CSS, así que aquí no se renderiza nada.
 */
export function BackgroundLayer() {
  const { activeBackground } = useAppearance()
  const videoRef = useRef<HTMLVideoElement>(null)

  // Pausar el video cuando la pestaña no es visible o si se prefiere menos movimiento.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const sync = () => {
      if (document.hidden || reduceMotion.matches) video.pause()
      else void video.play().catch(() => undefined)
    }

    sync()
    document.addEventListener('visibilitychange', sync)
    reduceMotion.addEventListener('change', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      reduceMotion.removeEventListener('change', sync)
    }
  }, [activeBackground.id])

  if (activeBackground.kind === 'gradient' || !activeBackground.src) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-1 overflow-hidden"
      style={{ transform: 'translateZ(0)', willChange: 'transform' }}
    >
      {activeBackground.kind === 'video' ? (
        <video
          key={activeBackground.id}
          ref={videoRef}
          src={activeBackground.src}
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
          className="size-full animate-fade-in object-cover"
          style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        />
      ) : (
        <img
          key={activeBackground.id}
          src={activeBackground.src}
          alt=""
          decoding="async"
          className="size-full animate-fade-in object-cover"
        />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgb(var(--bg-scrim-rgb) / var(--bg-dim))' }} />
    </div>
  )
}
