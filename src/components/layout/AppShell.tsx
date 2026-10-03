import { Agenda } from '../agenda/Agenda'
import { PlannerDndContext } from '../dnd/PlannerDndContext.tsx'
import { Matrix } from '../matrix/Matrix.tsx'
import { Navbar } from './Navbar.tsx'
import { PlannerProvider } from '../../context/PlannerProvider.tsx'

export function AppShell() {
  return (
    <PlannerProvider>
      <div className="app-frame flex h-dvh flex-col gap-3 overflow-hidden sm:gap-4">
        <Navbar />
        <PlannerDndContext>
          <main className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 overflow-hidden">
            <Matrix />
            <Agenda />
          </main>
        </PlannerDndContext>
      </div>
    </PlannerProvider>
  )
}
