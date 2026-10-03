import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from './useAuth.ts'
import { createUuid } from '../lib/ids.ts'
import { deleteAttachments } from '../lib/storage.ts'
import { supabase } from '../lib/supabase.ts'
import type { MasterTask, MasterTaskInsert, MasterTaskUpdate, MutationResult } from '../types/domain.ts'

export interface UseTasksResult {
  tasks: MasterTask[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createTask: (
    input: Pick<MasterTaskInsert, 'area_id' | 'title'> &
      Partial<Pick<MasterTaskInsert, 'description' | 'estimated_duration_minutes'>>,
  ) => Promise<MutationResult<MasterTask>>
  updateTask: (id: string, changes: MasterTaskUpdate) => Promise<MutationResult<MasterTask>>
  deleteTask: (id: string) => Promise<MutationResult<string>>
  reorderTasks: (areaId: string, orderedIds: string[]) => Promise<MutationResult<MasterTask[]>>
}

const DEFAULT_TASK_DURATION_MINUTES = 30
const REQUEST_ERROR = 'No fue posible sincronizar las tareas. Comprueba tu conexión y vuelve a intentarlo.'
const MUTATION_ERROR = 'No fue posible guardar el cambio. Comprueba tu conexión y vuelve a intentarlo.'

function sortTasks(tasks: MasterTask[]): MasterTask[] {
  return [...tasks].sort(
    (a, b) =>
      a.area_id.localeCompare(b.area_id) ||
      a.priority_order - b.priority_order ||
      (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )
}

function upsertTask(tasks: MasterTask[], next: MasterTask): MasterTask[] {
  return sortTasks([...tasks.filter((task) => task.id !== next.id), next])
}

export function useTasks(): UseTasksResult {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [tasks, setTasks] = useState<MasterTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pendingIds = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    if (!userId) {
      setTasks([])
      setIsLoading(false)
      setError(null)
      return
    }
    try {
      const { data, error: queryError } = await supabase
        .from('master_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('area_id', { ascending: true })
        .order('priority_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (queryError) {
        setError(REQUEST_ERROR)
        return
      }

      setTasks(sortTasks(data ?? []))
      setError(null)
    } catch {
      setError(REQUEST_ERROR)
    }
  }, [userId])

  useEffect(() => {
    let active = true
    let hasSubscribed = false
    let channel: RealtimeChannel | null = null
    pendingIds.current.clear()
    setTasks([])
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
          .from('master_tasks')
          .select('*')
          .eq('user_id', userId)
          .order('area_id', { ascending: true })
          .order('priority_order', { ascending: true })
          .order('created_at', { ascending: true })

        if (!active) return
        if (queryError) {
          setError(REQUEST_ERROR)
        } else {
          setTasks(sortTasks(data ?? []))
          setError(null)
        }
      } catch {
        if (active) setError(REQUEST_ERROR)
      } finally {
        if (active && showLoading) setIsLoading(false)
      }
    }

    channel = supabase
      .channel(`master_tasks:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'master_tasks', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id)
            if (pendingIds.current.has(deletedId)) return
            setTasks((current) => current.filter((task) => task.id !== deletedId))
            return
          }

          const nextTask = payload.new as MasterTask
          if (pendingIds.current.has(nextTask.id)) return
          setTasks((current) => upsertTask(current, nextTask))
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
  }, [userId])

  const createTask = useCallback<UseTasksResult['createTask']>(
    async ({ area_id, title, description = '', estimated_duration_minutes = DEFAULT_TASK_DURATION_MINUTES }) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para crear una tarea.' }
      const cleanTitle = title.trim()
      if (!cleanTitle || cleanTitle.length > 120) {
        return { ok: false, message: 'El título debe tener entre 1 y 120 caracteres.' }
      }
      if (!Number.isInteger(estimated_duration_minutes) || estimated_duration_minutes < 1 || estimated_duration_minutes > 1440) {
        return { ok: false, message: 'La duración debe estar entre 1 y 1440 minutos.' }
      }

      const id = createUuid()
      const sameArea = tasks.filter((task) => task.area_id === area_id)
      const optimistic: MasterTask = {
        id,
        user_id: userId,
        area_id,
        title: cleanTitle,
        description,
        estimated_duration_minutes,
        priority_order: sameArea.reduce((max, task) => Math.max(max, task.priority_order), -1) + 1,
        is_completed: false,
        created_at: new Date().toISOString(),
      }
      pendingIds.current.add(id)
      setTasks((current) => upsertTask(current, optimistic))

      try {
        const { data, error: insertError } = await supabase
          .from('master_tasks')
          .insert({
            id,
            area_id,
            title: cleanTitle,
            description,
            estimated_duration_minutes,
            priority_order: optimistic.priority_order,
          })
          .select('*')
          .single()
        if (insertError) throw insertError
        pendingIds.current.delete(id)
        if (data) setTasks((current) => upsertTask(current, data))
        return data ? { ok: true, data } : { ok: false, message: MUTATION_ERROR }
      } catch {
        pendingIds.current.delete(id)
        setTasks((current) => current.filter((task) => task.id !== id))
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [tasks, userId],
  )

  const updateTask = useCallback<UseTasksResult['updateTask']>(
    async (id, changes) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para editar una tarea.' }
      const previous = tasks.find((task) => task.id === id)
      if (!previous) return { ok: false, message: 'La tarea ya no está disponible.' }

      const cleanChanges = { ...changes }
      if (cleanChanges.title !== undefined) {
        cleanChanges.title = cleanChanges.title.trim()
        if (!cleanChanges.title || cleanChanges.title.length > 120) {
          return { ok: false, message: 'El título debe tener entre 1 y 120 caracteres.' }
        }
      }
      if (
        cleanChanges.estimated_duration_minutes !== undefined &&
        (!Number.isInteger(cleanChanges.estimated_duration_minutes) ||
          cleanChanges.estimated_duration_minutes < 1 ||
          cleanChanges.estimated_duration_minutes > 1440)
      ) {
        return { ok: false, message: 'La duración debe estar entre 1 y 1440 minutos.' }
      }

      const optimistic = { ...previous, ...cleanChanges }
      pendingIds.current.add(id)
      setTasks((current) => upsertTask(current, optimistic))
      try {
        const { data, error: updateError } = await supabase
          .from('master_tasks')
          .update(cleanChanges)
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single()
        if (updateError) throw updateError
        pendingIds.current.delete(id)
        if (data) setTasks((current) => upsertTask(current, data))
        return data ? { ok: true, data } : { ok: false, message: MUTATION_ERROR }
      } catch {
        pendingIds.current.delete(id)
        setTasks((current) => upsertTask(current, previous))
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [tasks, userId],
  )

  const deleteTask = useCallback<UseTasksResult['deleteTask']>(
    async (id) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para borrar una tarea.' }
      const previous = tasks.find((task) => task.id === id)
      if (!previous) return { ok: false, message: 'La tarea ya no está disponible.' }

      pendingIds.current.add(id)
      setTasks((current) => current.filter((task) => task.id !== id))
      try {
        const { data: fileRows, error: filesError } = await supabase
          .from('task_files')
          .select('file_url')
          .eq('user_id', userId)
          .eq('master_task_id', id)
        if (filesError) throw filesError
        await deleteAttachments((fileRows ?? []).map((file) => file.file_url))

        const { error: deleteError } = await supabase
          .from('master_tasks')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
        if (deleteError) throw deleteError
        pendingIds.current.delete(id)
        return { ok: true, data: id }
      } catch {
        pendingIds.current.delete(id)
        setTasks((current) => upsertTask(current, previous))
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [tasks, userId],
  )

  const reorderTasks = useCallback<UseTasksResult['reorderTasks']>(
    async (areaId, orderedIds) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para ordenar las tareas.' }
      const areaTasks = tasks.filter((task) => task.area_id === areaId)
      if (orderedIds.length !== areaTasks.length || new Set(orderedIds).size !== areaTasks.length) {
        return { ok: false, message: 'No se pudo guardar el orden de las tareas.' }
      }
      const byId = new Map(areaTasks.map((task) => [task.id, task]))
      if (orderedIds.some((id) => !byId.has(id))) {
        return { ok: false, message: 'No se pudo guardar el orden de las tareas.' }
      }

      const previous = tasks
      const reordered = orderedIds.map((id, priority_order) => ({
        ...byId.get(id)!,
        priority_order,
      }))
      reordered.forEach((task) => pendingIds.current.add(task.id))
      setTasks((current) =>
        sortTasks([
          ...current.filter((task) => task.area_id !== areaId),
          ...reordered,
        ]),
      )
      try {
        const { data, error: reorderError } = await supabase
          .from('master_tasks')
          .upsert(reordered)
          .select('*')
        if (reorderError) throw reorderError
        reordered.forEach((task) => pendingIds.current.delete(task.id))
        const saved = data ?? reordered
        setTasks((current) =>
          sortTasks([
            ...current.filter((task) => task.area_id !== areaId),
            ...saved,
          ]),
        )
        return { ok: true, data: saved }
      } catch {
        reordered.forEach((task) => pendingIds.current.delete(task.id))
        setTasks(previous)
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [tasks, userId],
  )

  return { tasks, isLoading, error, refresh, createTask, updateTask, deleteTask, reorderTasks }
}
