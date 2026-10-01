import { Hourglass } from 'lucide-react'
import { GlassPanel } from '../ui/GlassPanel.tsx'
import { Clock } from './Clock.tsx'
import { UserMenu } from './UserMenu.tsx'

export function Navbar() {
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

      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <Clock />
        <UserMenu />
      </div>
    </GlassPanel>
  )
}
