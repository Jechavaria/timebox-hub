import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from './useAuth.ts'
import { createUuid } from '../lib/ids.ts'
import { deleteAttachments } from '../lib/storage.ts'
import { supabase } from '../lib/supabase.ts'
import type { Area, AreaInsert, AreaUpdate, MutationResult } from '../types/domain.ts'

export interface UseAreasResult {
  areas: Area[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createArea: (input: Pick<AreaInsert, 'name'> & Partial<Pick<AreaInsert, 'color'>>) => Promise<MutationResult<Area>>
  updateArea: (id: string, changes: AreaUpdate) => Promise<MutationResult<Area>>
  deleteArea: (id: string) => Promise<MutationResult<string>>
  reorderAreas: (orderedIds: string[]) => Promise<MutationResult<Area[]>>
}

const DEFAULT_AREA_COLOR = '#6366f1'
const REQUEST_ERROR = 'No fue posible sincronizar los ámbitos. Comprueba tu conexión y vuelve a intentarlo.'
const MUTATION_ERROR = 'No fue posible guardar el cambio. Comprueba tu conexión y vuelve a intentarlo.'

function sortAreas(areas: Area[]): Area[] {
  return [...areas].sort((a, b) => a.position - b.position || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

function upsertArea(areas: Area[], next: Area): Area[] {
  return sortAreas([...areas.filter((area) => area.id !== next.id), next])
}

export function useAreas(): UseAreasResult {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [areas, setAreas] = useState<Area[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pendingIds = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    if (!userId) {
      setAreas([])
      setIsLoading(false)
      setError(null)
      return
    }
    try {
      const { data, error: queryError } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (queryError) {
        setError(REQUEST_ERROR)
        return
      }

      setAreas(sortAreas(data ?? []))
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
    setAreas([])
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
          .from('areas')
          .select('*')
          .eq('user_id', userId)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true })

        if (!active) return
        if (queryError) {
          setError(REQUEST_ERROR)
        } else {
          setAreas(sortAreas(data ?? []))
          setError(null)
        }
      } catch {
        if (active) setError(REQUEST_ERROR)
      } finally {
        if (active && showLoading) setIsLoading(false)
      }
    }

    channel = supabase
      .channel(`areas:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id)
            if (pendingIds.current.has(deletedId)) return
            setAreas((current) => current.filter((area) => area.id !== deletedId))
            return
          }

          const nextArea = payload.new as Area
          if (pendingIds.current.has(nextArea.id)) return
          setAreas((current) => upsertArea(current, nextArea))
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

  const createArea = useCallback<UseAreasResult['createArea']>(
    async ({ name, color = DEFAULT_AREA_COLOR }) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para crear un ámbito.' }
      const cleanName = name.trim()
      if (!cleanName || cleanName.length > 60) {
        return { ok: false, message: 'El nombre del ámbito debe tener entre 1 y 60 caracteres.' }
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return { ok: false, message: 'El color debe ser un hexadecimal válido.' }
      }

      const id = createUuid()
      const optimistic: Area = {
        id,
        user_id: userId,
        name: cleanName,
        color,
        position: areas.reduce((max, area) => Math.max(max, area.position), -1) + 1,
        is_hidden: false,
        created_at: new Date().toISOString(),
      }
      pendingIds.current.add(id)
      setAreas((current) => upsertArea(current, optimistic))

      try {
        const { data, error: insertError } = await supabase
          .from('areas')
          .insert({ id, name: cleanName, color, position: optimistic.position })
          .select('*')
          .single()
        if (insertError) throw insertError
        pendingIds.current.delete(id)
        if (data) setAreas((current) => upsertArea(current, data))
        return data ? { ok: true, data } : { ok: false, message: MUTATION_ERROR }
      } catch {
        pendingIds.current.delete(id)
        setAreas((current) => current.filter((area) => area.id !== id))
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [areas, userId],
  )

  const updateArea = useCallback<UseAreasResult['updateArea']>(
    async (id, changes) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para editar un ámbito.' }
      const previous = areas.find((area) => area.id === id)
      if (!previous) return { ok: false, message: 'El ámbito ya no está disponible.' }
      const cleanChanges = { ...changes }
      if (cleanChanges.name !== undefined) {
        cleanChanges.name = cleanChanges.name.trim()
        if (!cleanChanges.name || cleanChanges.name.length > 60) {
          return { ok: false, message: 'El nombre del ámbito debe tener entre 1 y 60 caracteres.' }
        }
      }
      if (cleanChanges.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(cleanChanges.color)) {
        return { ok: false, message: 'El color debe ser un hexadecimal válido.' }
      }

      const optimistic = { ...previous, ...cleanChanges }
      pendingIds.current.add(id)
      setAreas((current) => upsertArea(current, optimistic))
      try {
        const { data, error: updateError } = await supabase
          .from('areas')
          .update(cleanChanges)
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single()
        if (updateError) throw updateError
        pendingIds.current.delete(id)
        if (data) setAreas((current) => upsertArea(current, data))
        return data ? { ok: true, data } : { ok: false, message: MUTATION_ERROR }
      } catch {
        pendingIds.current.delete(id)
        setAreas((current) => upsertArea(current, previous))
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [areas, userId],
  )

  const deleteArea = useCallback<UseAreasResult['deleteArea']>(
    async (id) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para borrar un ámbito.' }
      const previous = areas.find((area) => area.id === id)
      if (!previous) return { ok: false, message: 'El ámbito ya no está disponible.' }

      pendingIds.current.add(id)
      setAreas((current) => current.filter((area) => area.id !== id))
      try {
        const { data: taskRows, error: tasksError } = await supabase
          .from('master_tasks')
          .select('id')
          .eq('user_id', userId)
          .eq('area_id', id)
        if (tasksError) throw tasksError

        const taskIds = (taskRows ?? []).map((task) => task.id)
        if (taskIds.length > 0) {
          const { data: fileRows, error: filesError } = await supabase
            .from('task_files')
            .select('file_url')
            .eq('user_id', userId)
            .in('master_task_id', taskIds)
          if (filesError) throw filesError
          await deleteAttachments((fileRows ?? []).map((file) => file.file_url))
        }

        const { error: deleteError } = await supabase
          .from('areas')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
        if (deleteError) throw deleteError
        pendingIds.current.delete(id)
        return { ok: true, data: id }
      } catch {
        pendingIds.current.delete(id)
        setAreas((current) => upsertArea(current, previous))
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [areas, userId],
  )

  const reorderAreas = useCallback<UseAreasResult['reorderAreas']>(
    async (orderedIds) => {
      if (!userId) return { ok: false, message: 'Inicia sesión para ordenar los ámbitos.' }
      if (orderedIds.length !== areas.length || new Set(orderedIds).size !== areas.length) {
        return { ok: false, message: 'No se pudo guardar el orden de los ámbitos.' }
      }
      const byId = new Map(areas.map((area) => [area.id, area]))
      if (orderedIds.some((id) => !byId.has(id))) {
        return { ok: false, message: 'No se pudo guardar el orden de los ámbitos.' }
      }

      const previous = areas
      const reordered = orderedIds.map((id, position) => ({
        ...byId.get(id)!,
        position,
      }))
      reordered.forEach((area) => pendingIds.current.add(area.id))
      setAreas(reordered)
      try {
        const { data, error: reorderError } = await supabase
          .from('areas')
          .upsert(reordered)
          .select('*')
        if (reorderError) throw reorderError
        reordered.forEach((area) => pendingIds.current.delete(area.id))
        const saved = sortAreas(data ?? reordered)
        setAreas(saved)
        return { ok: true, data: saved }
      } catch {
        reordered.forEach((area) => pendingIds.current.delete(area.id))
        setAreas(previous)
        return { ok: false, message: MUTATION_ERROR }
      }
    },
    [areas, userId],
  )

  return { areas, isLoading, error, refresh, createArea, updateArea, deleteArea, reorderAreas }
}
