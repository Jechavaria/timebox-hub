import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAreas } from '../hooks/useAreas.ts'
import { useSchedule } from '../hooks/useSchedule.ts'
import { useTasks } from '../hooks/useTasks.ts'
import type { UseTasksResult } from '../hooks/useTasks.ts'
import { PlannerContext } from './planner-context.ts'
import type { PlannerContextValue } from './planner-context.ts'

interface PlannerProviderProps {
  children: ReactNode
}

export function PlannerProvider({ children }: PlannerProviderProps) {
  const areas = useAreas()
  const tasks = useTasks()
  const schedule = useSchedule()

  const updateTask = useCallback<UseTasksResult['updateTask']>(
    async (id, changes) => {
      const result = await tasks.updateTask(id, changes)
      if (result.ok && changes.is_completed !== undefined) {
        await schedule.syncBlocksCompletion(id, changes.is_completed)
      }
      return result
    },
    [tasks, schedule],
  )

  const coordinatedTasks = useMemo<UseTasksResult>(
    () => ({
      ...tasks,
      updateTask,
    }),
    [tasks, updateTask],
  )

  const value = useMemo<PlannerContextValue>(
    () => ({ areas, tasks: coordinatedTasks, schedule }),
    [areas, coordinatedTasks, schedule],
  )

  return <PlannerContext value={value}>{children}</PlannerContext>
}
