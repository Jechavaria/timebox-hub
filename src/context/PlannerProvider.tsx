import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAreas } from '../hooks/useAreas.ts'
import { useSchedule } from '../hooks/useSchedule.ts'
import { useTasks } from '../hooks/useTasks.ts'
import { PlannerContext } from './planner-context.ts'
import type { PlannerContextValue } from './planner-context.ts'

interface PlannerProviderProps {
  children: ReactNode
}

export function PlannerProvider({ children }: PlannerProviderProps) {
  const areas = useAreas()
  const tasks = useTasks()
  const schedule = useSchedule()
  const value = useMemo<PlannerContextValue>(
    () => ({ areas, tasks, schedule }),
    [areas, tasks, schedule],
  )

  return <PlannerContext value={value}>{children}</PlannerContext>
}
