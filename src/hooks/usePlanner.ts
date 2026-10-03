import { useContext } from 'react'
import { PlannerContext } from '../context/planner-context.ts'
import type { PlannerContextValue } from '../context/planner-context.ts'

export function usePlanner(): PlannerContextValue {
  const context = useContext(PlannerContext)
  if (!context) {
    throw new Error('usePlanner debe usarse dentro de <PlannerProvider>')
  }
  return context
}
