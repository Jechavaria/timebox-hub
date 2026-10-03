import { Agenda } from '../agenda/Agenda'
import { PlannerDndContext } from '../dnd/PlannerDndContext.tsx'
import { Matrix } from '../matrix/Matrix.tsx'
import { Navbar } from './Navbar.tsx'
import { PlannerProvider } from '../../context/PlannerProvider.tsx'

export function AppShell() {
  return (
    <div className="app-frame flex h-dvh flex-col gap-3 overflow-hidden sm:gap-4">
      <Navbar />
      <PlannerProvider>
        <PlannerDndContext>
          <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] gap-3 sm:gap-4">
            <Matrix />
            <Agenda />
          </main>
        </PlannerDndContext>
      </PlannerProvider>
    </div>
  )
}
