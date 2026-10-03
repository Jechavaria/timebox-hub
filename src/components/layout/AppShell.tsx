import { Agenda } from '../agenda/Agenda'
import { PlannerDndContext } from '../dnd/PlannerDndContext.tsx'
import { Matrix } from '../matrix/Matrix.tsx'
import { Navbar } from './Navbar.tsx'
import { PlannerProvider } from '../../context/PlannerProvider.tsx'

export function AppShell() {
  return (
    <PlannerProvider>
      <div className="app-frame flex min-h-screen flex-col gap-5 pb-16 sm:gap-6 sm:pb-24">
        <Navbar />
        <PlannerDndContext>
          <main className="flex flex-col gap-6 sm:gap-8">
            <Matrix />
            <Agenda />
          </main>
        </PlannerDndContext>
      </div>
    </PlannerProvider>
  )
}
