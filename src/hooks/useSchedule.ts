import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from './useAuth.ts'
import { AGENDA_WINDOW_DAYS } from '../lib/constants.ts'
import { createUuid } from '../lib/ids.ts'
import { resolveStack } from '../lib/timeline.ts'
import { addDays, minutesToTime, timeToMinutes } from '../lib/time.ts'
import { supabase } from '../lib/supabase.ts'
import {
  calculateRecurringDates,
  describeRecurrenceRule,
  formatNotesWithRecurrence,
  type RecurrenceRule,
} from '../lib/recurrence.ts'
import type {
  CreateRoutineBlockInput,
  LocalDateString,
  MasterTask,
  MutationResult,
  ScheduleBlock,
  ScheduleBlockUpdate,
} from '../types/domain.ts'
import { useToday } from './useToday.ts'

export interface UseScheduleResult {
  blocks: ScheduleBlock[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  cloneTaskToBlock: (
    task: MasterTask,
    scheduledDate: LocalDateString,
    startMinutes: number | null,
    recurrence?: RecurrenceRule,
  ) => Promise<MutationResult<ScheduleBlock>>
  createRoutineBlock: (
    input: CreateRoutineBlockInput,
    recurrence?: RecurrenceRule,
  ) => Promise<MutationResult<ScheduleBlock>>
  cloneTaskToRecurringBlocks: (
    task: MasterTask,
    scheduledDate: LocalDateString,
    startMinutes: number | null,
    recurrence: RecurrenceRule,
  ) => Promise<MutationResult<ScheduleBlock[]>>
  createRoutineRecurringBlocks: (
    input: CreateRoutineBlockInput,
    recurrence: RecurrenceRule,
  ) => Promise<MutationResult<ScheduleBlock[]>>
  moveBlock: (
    blockId: string,
    scheduledDate: LocalDateString,
    startMinutes: number | null,
  ) => Promise<MutationResult<ScheduleBlock>>
  updateBlock: (blockId: string, changes: ScheduleBlockUpdate) => Promise<MutationResult<ScheduleBlock>>
  deleteBlock: (blockId: string) => Promise<MutationResult<string>>
}

const REQUEST_ERROR = 'No fue posible sincronizar la planificación diaria. Comprueba tu conexión y vuelve a intentarlo.'
const MUTATION_ERROR = 'No fue posible guardar el bloque. Comprueba tu conexión y vuelve a intentarlo.'
const OUTSIDE_DAY_ERROR = 'El bloque no cabe antes de la medianoche. Elige otro espacio u horario.'

function sortBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort(
    (a, b) =>
      a.scheduled_date.localeCompare(b.scheduled_date) ||
      (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99') ||
      (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )
}

function mergeBlocks(current: ScheduleBlock[], incoming: ScheduleBlock[]): ScheduleBlock[] {
  const byId = new Map(current.map((block) => [block.id, block]))
  for (const block of incoming) byId.set(block.id, block)
  return sortBlocks([...byId.values()])
}

function getRowsForPlacement(
  block: ScheduleBlock,
  scheduledDate: LocalDateString,
  startMinutes: number | null,
  blocks: ScheduleBlock[],
): { block: ScheduleBlock; rows: ScheduleBlock[] } | null {
  if (startMinutes === null) {
    const untimed = { ...block, scheduled_date: scheduledDate, start_time: null }
    return { block: untimed, rows: [untimed] }
  }

  const dayBlocks = blocks.filter((candidate) => candidate.scheduled_date === scheduledDate)
  const placement = resolveStack(dayBlocks, startMinutes, block.planned_duration_minutes, block.id)
  if (!placement.ok) return null

  const placed = { ...block, scheduled_date: scheduledDate, start_time: minutesToTime(placement.startMinutes) }
  return { block: placed, rows: [placed, ...placement.shifted] }
}

export function useSchedule(): UseScheduleResult {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const today = useToday()
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pendingIds = useRef(new Set<string>())
  const windowEnd = addDays(today, AGENDA_WINDOW_DAYS - 1)

  const refresh = useCallback(async () => {
    if (!userId) {
      setBlocks([])
      setIsLoading(false)
      setError(null)
      return
    }
    try {
      const { data, error: queryError } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', today)
        .lte('scheduled_date', windowEnd)
        .order('scheduled_date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })
      if (queryError) {
        setError(REQUEST_ERROR)
        return
      }
      setBlocks(sortBlocks(data ?? []))
      setError(null)
    } catch {
      setError(REQUEST_ERROR)
    }
  }, [today, userId, windowEnd])

  useEffect(() => {
    let active = true
    let hasSubscribed = false
    let channel: RealtimeChannel | null = null
    pendingIds.current.clear()
    setBlocks([])
    setIsLoading(Boolean(userId))
    setError(null)

    if (!userId) {
      setIsLoading(false)
      return
    }

    const load = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true)
      try {
        const { data, error: queryError } = await supabase
          .from('schedule_blocks')
          .select('*')
          .eq('user_id', userId)
          .gte('scheduled_date', today)
          .lte('scheduled_date', windowEnd)
          .order('scheduled_date', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: false })

        if (!active) return
        if (queryError) {
          setError(REQUEST_ERROR)
        } else {
          setBlocks(sortBlocks(data ?? []))
          setError(null)
        }
      } catch {
        if (active) setError(REQUEST_ERROR)
      } finally {
        if (active && showLoading) setIsLoading(false)
      }
    }

    channel = supabase
      .channel(`schedule_blocks:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_blocks', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id)
            if (pendingIds.current.has(deletedId)) return
            setBlocks((current) => current.filter((block) => block.id !== deletedId))
            return
          }

          const nextBlock = payload.new as ScheduleBlock
          if (pendingIds.current.has(nextBlock.id)) return
          setBlocks((current) => {
            if (nextBlock.scheduled_date < today || nextBlock.scheduled_date > windowEnd) {
              return current.filter((block) => block.id !== nextBlock.id)
            }
            return mergeBlocks(current, [nextBlock])
          })
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const isInitialSubscription = !hasSubscribed
          hasSubscribed = true
          void load(isInitialSubscription)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError(REQUEST_ERROR)
          setIsLoading(false)
        }
      })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load(false)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibility)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [today, userId, windowEnd])

  const persistPlacement = useCallback(
    async (original: ScheduleBlock, scheduledDate: LocalDateString, startMinutes: number | null) => {
      if (!userId) return { ok: false as const, message: 'Inicia sesión para editar la planificación diaria.' }
      const placement = getRowsForPlacement(original, scheduledDate, startMinutes, blocks)
      if (!placement) return { ok: false as const, message: OUTSIDE_DAY_ERROR }

      const ids = placement.rows.map((row) => row.id)
      ids.forEach((id) => pendingIds.current.add(id))
      const previous = blocks
      setBlocks((current) => mergeBlocks(current.filter((candidate) => candidate.id !== original.id), placement.rows))
      try {
        const { data, error: upsertError } = await supabase
          .from('schedule_blocks')
          .upsert(placement.rows)
          .select('*')
        if (upsertError) throw upsertError
        ids.forEach((id) => pendingIds.current.delete(id))
        if (data) setBlocks((current) => mergeBlocks(current, data))
        const saved = data?.find((candidate) => candidate.id === original.id) ?? placement.block
        return { ok: true as const, data: saved }
      } catch (err) {
        console.error('Error al guardar bloque en Supabase:', err)
        ids.forEach((id) => pendingIds.current.delete(id))
        setBlocks(previous)
        const message = (err as { message?: string })?.message || MUTATION_ERROR
        return { ok: false as const, message }
      }
    },
    [blocks, userId],
  )

  const cloneTaskToRecurringBlocks = useCallback<UseScheduleResult['cloneTaskToRecurringBlocks']>(
    async (task, scheduledDate, startMinutes, recurrence) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para planificar tareas.' }
      if (startMinutes !== null && (!Number.isFinite(startMinutes) || startMinutes < 0 || startMinutes >= 1440)) {
        return { ok: false, message: OUTSIDE_DAY_ERROR }
      }

      const duration = Math.max(15, Math.min(1440, task.estimated_duration_minutes || 30))
      const dates = calculateRecurringDates(scheduledDate, recurrence)
      const repeatDesc = recurrence.frequency !== 'none' ? describeRecurrenceRule(recurrence, scheduledDate) : ''

      const newBlocks: ScheduleBlock[] = dates.map((date) => ({
        id: createUuid(),
        user_id: userId,
        master_task_id: task.id,
        area_id: task.area_id,
        title: task.title,
        notes: repeatDesc ? formatNotesWithRecurrence('', repeatDesc) : '',
        scheduled_date: date,
        start_time: startMinutes !== null ? minutesToTime(startMinutes) : null,
        planned_duration_minutes: duration,
        actual_duration_minutes: null,
        is_completed: false,
        is_routine: false,
        created_at: new Date().toISOString(),
      }))

      try {
        const { data, error: upsertError } = await supabase
          .from('schedule_blocks')
          .upsert(newBlocks)
          .select('*')
        if (upsertError) throw upsertError

        const savedBlocks = data && data.length > 0 ? (data as ScheduleBlock[]) : newBlocks
        const visibleBlocks = savedBlocks.filter((b) => b.scheduled_date >= today && b.scheduled_date <= windowEnd)
        if (visibleBlocks.length > 0) {
          setBlocks((current) => mergeBlocks(current, visibleBlocks))
        }

        return { ok: true, data: savedBlocks }
      } catch (err) {
        console.error('Error al guardar bloques recurrentes:', err)
        const message = (err as { message?: string })?.message || MUTATION_ERROR
        return { ok: false, message }
      }
    },
    [today, userId, windowEnd],
  )

  const cloneTaskToBlock = useCallback<UseScheduleResult['cloneTaskToBlock']>(
    async (task, scheduledDate, startMinutes, recurrence) => {
      if (recurrence && recurrence.frequency !== 'none') {
        const res = await cloneTaskToRecurringBlocks(task, scheduledDate, startMinutes, recurrence)
        if (!res.ok) return { ok: false, message: res.message }
        return { ok: true, data: res.data[0] }
      }

      if (startMinutes !== null && (!Number.isFinite(startMinutes) || startMinutes < 0 || startMinutes >= 1440)) {
        return { ok: false, message: OUTSIDE_DAY_ERROR }
      }

      const duration = Math.max(15, Math.min(1440, task.estimated_duration_minutes || 30))

      const original: ScheduleBlock = {
        id: createUuid(),
        user_id: userId ?? '',
        master_task_id: task.id,
        area_id: task.area_id,
        title: task.title,
        notes: '',
        scheduled_date: scheduledDate,
        start_time: null,
        planned_duration_minutes: duration,
        actual_duration_minutes: null,
        is_completed: false,
        is_routine: false,
        created_at: new Date().toISOString(),
      }
      return persistPlacement(original, scheduledDate, startMinutes)
    },
    [cloneTaskToRecurringBlocks, persistPlacement, userId],
  )

  const createRoutineRecurringBlocks = useCallback<UseScheduleResult['createRoutineRecurringBlocks']>(
    async ({ title, notes = '', scheduledDate, plannedDurationMinutes, startTime = null, areaId = null }, recurrence) => {
      if (!userId) return { ok: false, message: 'Debes iniciar sesión.' }
      const cleanTitle = title.trim()
      if (!cleanTitle || cleanTitle.length > 120) {
        return { ok: false, message: 'El título debe tener entre 1 y 120 caracteres.' }
      }
      if (!Number.isInteger(plannedDurationMinutes) || plannedDurationMinutes < 1 || plannedDurationMinutes > 1440) {
        return { ok: false, message: 'La duración debe estar entre 1 y 1440 minutos.' }
      }

      if (startTime) {
        let startMinutes: number
        try {
          startMinutes = timeToMinutes(startTime)
        } catch {
          return { ok: false, message: 'La hora de inicio no es válida.' }
        }
        if (startMinutes + plannedDurationMinutes > 1440) {
          return { ok: false, message: OUTSIDE_DAY_ERROR }
        }
      }

      const dates = calculateRecurringDates(scheduledDate, recurrence)
      const repeatDesc = recurrence.frequency !== 'none' ? describeRecurrenceRule(recurrence, scheduledDate) : ''
      const finalNotes = repeatDesc ? formatNotesWithRecurrence(notes, repeatDesc) : notes

      const newBlocks: ScheduleBlock[] = dates.map((date) => ({
        id: createUuid(),
        user_id: userId,
        master_task_id: null,
        area_id: areaId,
        title: cleanTitle,
        notes: finalNotes,
        scheduled_date: date,
        start_time: startTime,
        planned_duration_minutes: plannedDurationMinutes,
        actual_duration_minutes: null,
        is_completed: false,
        is_routine: true,
        created_at: new Date().toISOString(),
      }))

      try {
        const { data, error: upsertError } = await supabase
          .from('schedule_blocks')
          .upsert(newBlocks)
          .select('*')
        if (upsertError) throw upsertError

        const savedBlocks = data && data.length > 0 ? (data as ScheduleBlock[]) : newBlocks
        const visibleBlocks = savedBlocks.filter((b) => b.scheduled_date >= today && b.scheduled_date <= windowEnd)
        if (visibleBlocks.length > 0) {
          setBlocks((current) => mergeBlocks(current, visibleBlocks))
        }

        return { ok: true, data: savedBlocks }
      } catch (err) {
        console.error('Error al guardar rutinas recurrentes:', err)
        const message = (err as { message?: string })?.message || MUTATION_ERROR
        return { ok: false, message }
      }
    },
    [today, userId, windowEnd],
  )

  const createRoutineBlock = useCallback<UseScheduleResult['createRoutineBlock']>(
    async (input, recurrence) => {
      if (recurrence && recurrence.frequency !== 'none') {
        const res = await createRoutineRecurringBlocks(input, recurrence)
        if (!res.ok) return { ok: false, message: res.message }
        return { ok: true, data: res.data[0] }
      }

      if (!userId) return { ok: false, message: 'Debes iniciar sesión.' }
      const cleanTitle = input.title.trim()
      if (!cleanTitle || cleanTitle.length > 120) {
        return { ok: false, message: 'El título debe tener entre 1 y 120 caracteres.' }
      }
      if (!Number.isInteger(input.plannedDurationMinutes) || input.plannedDurationMinutes < 1 || input.plannedDurationMinutes > 1440) {
        return { ok: false, message: 'La duración debe estar entre 1 y 1440 minutos.' }
      }

      let startMinutes: number | null = null
      if (input.startTime) {
        try {
          startMinutes = timeToMinutes(input.startTime)
        } catch {
          return { ok: false, message: 'La hora de inicio no es válida.' }
        }
        if (startMinutes + input.plannedDurationMinutes > 1440) {
          return { ok: false, message: OUTSIDE_DAY_ERROR }
        }
      }

      const routineBlock: ScheduleBlock = {
        id: createUuid(),
        user_id: userId,
        master_task_id: null,
        area_id: input.areaId ?? null,
        title: cleanTitle,
        notes: input.notes ?? '',
        scheduled_date: input.scheduledDate,
        start_time: input.startTime ?? null,
        planned_duration_minutes: input.plannedDurationMinutes,
        actual_duration_minutes: null,
        is_completed: false,
        is_routine: true,
        created_at: new Date().toISOString(),
      }

      return persistPlacement(routineBlock, input.scheduledDate, startMinutes)
    },
    [createRoutineRecurringBlocks, persistPlacement, userId],
  )

  const moveBlock = useCallback<UseScheduleResult['moveBlock']>(
    async (blockId, scheduledDate, startMinutes) => {
      const block = blocks.find((candidate) => candidate.id === blockId)
      if (!block) return { ok: false, message: 'El bloque ya no está disponible.' }
      if (startMinutes !== null && (!Number.isFinite(startMinutes) || startMinutes < 0 || startMinutes >= 1440)) {
        return { ok: false, message: OUTSIDE_DAY_ERROR }
      }
      return persistPlacement(block, scheduledDate, startMinutes)
    },
    [blocks, persistPlacement],
  )

  const updateBlock = useCallback<UseScheduleResult['updateBlock']>(
    async (blockId, changes) => {
      const previous = blocks.find((candidate) => candidate.id === blockId)
      if (!previous) return { ok: false, message: 'El bloque ya no está disponible.' }
      const updated = { ...previous, ...changes }
      if (!updated.title.trim() || updated.title.trim().length > 120) {
        return { ok: false, message: 'El título debe tener entre 1 y 120 caracteres.' }
      }
      if (!Number.isInteger(updated.planned_duration_minutes) || updated.planned_duration_minutes < 1 || updated.planned_duration_minutes > 1440) {
        return { ok: false, message: 'La duración debe estar entre 1 y 1440 minutos.' }
      }

      let startMinutes: number | null = null
      if (updated.start_time !== null) {
        try {
          startMinutes = timeToMinutes(updated.start_time)
        } catch {
          return { ok: false, message: 'La hora de inicio no es válida.' }
        }
      }
      return persistPlacement(updated, updated.scheduled_date, startMinutes)
    },
    [blocks, persistPlacement],
  )

  const deleteBlock = useCallback<UseScheduleResult['deleteBlock']>(
    async (blockId) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para borrar un bloque.' }
      const previous = blocks.find((block) => block.id === blockId)
      if (!previous) return { ok: false, message: 'El bloque ya no está disponible.' }
      pendingIds.current.add(blockId)
      setBlocks((current) => current.filter((block) => block.id !== blockId))
      try {
        const { error: deleteError } = await supabase
          .from('schedule_blocks')
          .delete()
          .eq('id', blockId)
          .eq('user_id', userId)
        if (deleteError) throw deleteError
        pendingIds.current.delete(blockId)
        return { ok: true, data: blockId }
      } catch {
        pendingIds.current.delete(blockId)
        setBlocks((current) => mergeBlocks(current, [previous]))
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [blocks, userId],
  )

  return {
    blocks,
    isLoading,
    error,
    refresh,
    cloneTaskToBlock,
    createRoutineBlock,
    cloneTaskToRecurringBlocks,
    createRoutineRecurringBlocks,
    moveBlock,
    updateBlock,
    deleteBlock,
  }
}
