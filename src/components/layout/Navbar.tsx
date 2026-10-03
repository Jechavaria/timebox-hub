import { useState } from 'react'
import { BarChart3, Bell, BellRing, Hourglass } from 'lucide-react'
import { AnalyticsModal } from '../analytics/AnalyticsModal.tsx'
import { Button } from '../ui/Button.tsx'
import { GlassPanel } from '../ui/GlassPanel.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Clock } from './Clock.tsx'
import { ThemeSwitch } from './ThemeSwitch.tsx'
import { UserMenu } from './UserMenu.tsx'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useTaskNotifications } from '../../hooks/useTaskNotifications.ts'

export function Navbar() {
  const [showAnalytics, setShowAnalytics] = useState(false)
  const { schedule } = usePlanner()
  const { enabled, permission, toggleEnabled } = useTaskNotifications(schedule.blocks)

  const isAlertingActive = enabled && permission === 'granted'

  return (
    <GlassPanel
      as="header"
      className="relative z-30 flex shrink-0 items-center justify-between gap-3 px-3 py-2 sm:px-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Hourglass className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-base font-semibold tracking-tight text-ink">TimeBox Hub</p>
          <p className="hidden truncate text-xs text-ink-muted sm:block">
            Gestor háptico de tiempo y tareas
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <Clock />
        <IconButton
          label={
            isAlertingActive
              ? 'Recordatorios activados: aviso 3 min antes con sonido y notificación (clic para pausar)'
              : 'Activar recordatorios automáticos (aviso 3 min antes de empezar)'
          }
          size="sm"
          variant="glass"
          onClick={toggleEnabled}
          className={`relative ${isAlertingActive ? 'text-accent border-accent/40 bg-accent/10' : 'text-ink-muted'}`}
        >
          {isAlertingActive ? (
            <>
              <BellRing className="size-4 animate-pulse" />
              <span className="absolute right-1 top-1 size-2 rounded-full bg-success shadow-[0_0_8px_rgb(95_217_160_/_0.8)]" />
            </>
          ) : (
            <Bell className="size-4" />
          )}
        </IconButton>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAnalytics(true)}
          leadingIcon={<BarChart3 className="size-4 text-accent" />}
          aria-label="Abrir métricas y analítica"
        >
          <span className="hidden sm:inline">Métricas</span>
        </Button>
        <ThemeSwitch />
        <UserMenu />
      </div>

      <AnalyticsModal open={showAnalytics} onClose={() => setShowAnalytics(false)} />
    </GlassPanel>
  )
}
