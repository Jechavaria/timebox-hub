import { CalendarClock, LayoutGrid } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GlassPanel } from '../ui/GlassPanel.tsx'
import { Navbar } from './Navbar.tsx'

interface WorkspacePanelProps {
  panelKey: string
  icon: LucideIcon
  title: string
  description: string
  emptyMessage: string
}

function WorkspacePanel({
  panelKey,
  icon: Icon,
  title,
  description,
  emptyMessage,
}: WorkspacePanelProps) {
  const headingId = `${panelKey}-heading`

  return (
    <GlassPanel
      as="section"
      aria-labelledby={headingId}
      className="flex min-h-0 flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-glass-border px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id={headingId}
            className="truncate text-sm font-semibold tracking-tight text-ink sm:text-base"
          >
            {title}
          </h2>
          <p className="truncate text-xs text-ink-muted">{description}</p>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto overscroll-contain p-6 text-center">
        <p className="max-w-sm text-sm text-ink-faint">{emptyMessage}</p>
      </div>
    </GlassPanel>
  )
}

export function AppShell() {
  return (
    <div className="app-frame flex h-dvh flex-col gap-3 overflow-hidden sm:gap-4">
      <Navbar />
      <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] gap-3 sm:gap-4">
        <WorkspacePanel
          panelKey="matrix"
          icon={LayoutGrid}
          title="El Ábaco"
          description="Ámbitos y tareas pendientes por prioridad"
          emptyMessage="Aquí aparecerán tus ámbitos como columnas con sus tareas pendientes."
        />
        <WorkspacePanel
          panelKey="agenda"
          icon={CalendarClock}
          title="Agenda"
          description="Hoy, mañana y los próximos 7 días"
          emptyMessage="Aquí aparecerán los cajones HOY y MAÑANA con la línea de tiempo en vivo."
        />
      </main>
    </div>
  )
}
