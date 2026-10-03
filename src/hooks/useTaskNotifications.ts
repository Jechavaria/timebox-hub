import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDuration, minutesToHM, timeToMinutes, toLocalDateString } from '../lib/time.ts'
import type { ScheduleBlock } from '../types/domain.ts'
import { useToast } from './useToast.ts'

/** Reproduce un timbre suave de recordatorio usando Web Audio API nativa */
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const startTime = ctx.currentTime

    // Nota 1: 659.25 Hz (E5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, startTime)
    gain1.gain.setValueAtTime(0.18, startTime)
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(startTime)
    osc1.stop(startTime + 0.25)

    // Nota 2: 880 Hz (A5) un poco después
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, startTime + 0.12)
    gain2.gain.setValueAtTime(0.22, startTime + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.55)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(startTime + 0.12)
    osc2.stop(startTime + 0.55)
  } catch {
    // Si el navegador bloquea audio antes de interacción, se ignora silenciosamente
  }
}

const STORAGE_KEY = 'timebox_notifications_enabled'

export function useTaskNotifications(blocks: ScheduleBlock[]) {
  const toast = useToast()
  const isSupported = typeof window !== 'undefined' && 'Notification' in window
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return isSupported ? Notification.permission : 'denied'
  })
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!isSupported) return false
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) return saved === 'true'
    return Notification.permission === 'granted'
  })

  const notifiedSetRef = useRef<Set<string>>(new Set())

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Tu navegador no admite notificaciones del sistema.')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        setEnabled(true)
        localStorage.setItem(STORAGE_KEY, 'true')
        playNotificationChime()
        toast.success('¡Notificaciones activadas! Te avisaremos 3 minutos antes de cada tarea.')
        return true
      } else if (result === 'denied') {
        setEnabled(false)
        localStorage.setItem(STORAGE_KEY, 'false')
        toast.info('Permiso de notificaciones denegado en el navegador.')
        return false
      }
    } catch {
      // Fallback
    }
    return false
  }, [isSupported, toast])

  const toggleEnabled = useCallback(() => {
    if (!enabled && permission !== 'granted') {
      void requestPermission()
      return
    }
    const next = !enabled
    setEnabled(next)
    localStorage.setItem(STORAGE_KEY, String(next))
    if (next) {
      playNotificationChime()
      toast.success('Recordatorios activados (aviso 3 minutos antes).')
    } else {
      toast.info('Recordatorios desactivados.')
    }
  }, [enabled, permission, requestPermission, toast])

  // Verificación periódica cada 20 segundos
  useEffect(() => {
    if (!enabled || permission !== 'granted') return

    const checkUpcomingTasks = () => {
      const now = new Date()
      const todayDate = toLocalDateString(now)
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      const todayBlocks = blocks.filter(
        (b) => b.scheduled_date === todayDate && !b.is_completed && b.start_time !== null,
      )

      for (const block of todayBlocks) {
        if (!block.start_time) continue
        try {
          const startMinutes = timeToMinutes(block.start_time)
          // Avisar exactamente 3 minutos antes (ventana de gracia entre 3 y 1 minuto antes)
          const alertMinutes = startMinutes - 3

          if (currentMinutes >= alertMinutes && currentMinutes <= alertMinutes + 2) {
            const alertKey = `${todayDate}_${block.id}`
            const sessionRecorded = sessionStorage.getItem(`notified_${alertKey}`)

            if (!notifiedSetRef.current.has(alertKey) && !sessionRecorded) {
              notifiedSetRef.current.add(alertKey)
              sessionStorage.setItem(`notified_${alertKey}`, 'true')

              const timeStr = minutesToHM(startMinutes)
              const durationStr = formatDuration(block.planned_duration_minutes)

              // 1. Timbre de aviso sonoro
              playNotificationChime()

              // 2. Notificación en pantalla nativa de Windows / Android
              try {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.ready.then((reg) => {
                    void reg.showNotification(`⏳ En 3 min: ${block.title}`, {
                      body: `Comienza a las ${timeStr} (${durationStr}). ¡Prepárate para empezar!`,
                      icon: '/favicon.svg',
                      badge: '/favicon.svg',
                      tag: `timebox-${block.id}`,
                    })
                  }).catch(() => {
                    new Notification(`⏳ En 3 min: ${block.title}`, {
                      body: `Comienza a las ${timeStr} (${durationStr}).`,
                      icon: '/favicon.svg',
                    })
                  })
                } else {
                  new Notification(`⏳ En 3 min: ${block.title}`, {
                    body: `Comienza a las ${timeStr} (${durationStr}). ¡Prepárate para empezar!`,
                    icon: '/favicon.svg',
                  })
                }
              } catch {
                // Notificación nativa bloqueada en segundo plano
              }

              // 3. Aviso visual en la aplicación
              toast.info(
                `“${block.title}” comienza a las ${timeStr} (${durationStr}).`,
                '⏳ Tu tarea comienza en 3 minutos',
              )
            }
          }
        } catch {
          // Ignorar hora inválida
        }
      }
    }

    checkUpcomingTasks()
    const timer = setInterval(checkUpcomingTasks, 20_000)
    return () => clearInterval(timer)
  }, [blocks, enabled, permission, toast])

  return {
    isSupported,
    permission,
    enabled,
    requestPermission,
    toggleEnabled,
  }
}
