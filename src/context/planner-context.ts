import { createContext } from 'react'
import type { UseAreasResult } from '../hooks/useAreas.ts'
import type { UseScheduleResult } from '../hooks/useSchedule.ts'
import type { UseTasksResult } from '../hooks/useTasks.ts'

export interface PlannerContextValue {
  areas: UseAreasResult
  tasks: UseTasksResult
  schedule: UseScheduleResult
}

export const PlannerContext = createContext<PlannerContextValue | null>(null)
