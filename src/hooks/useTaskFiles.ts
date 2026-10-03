import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.ts'
import { useToast } from './useToast.ts'
import { deleteAttachment, getAttachmentMime, getPreviewSignedUrl, getSignedUrl, uploadAttachment } from '../lib/storage.ts'
import { USER_QUOTA_BYTES } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import type { MutationResult, TaskFile } from '../types/domain.ts'

export interface UseTaskFilesResult {
  files: TaskFile[]
  isLoading: boolean
  isUploading: boolean
  downloadingIds: ReadonlySet<string>
  deletingIds: ReadonlySet<string>
  replacingIds: ReadonlySet<string>
  error: string | null
  refresh: () => Promise<void>
  uploadFiles: (files: File[]) => Promise<MutationResult<TaskFile[]>>
  addLink: (url: string, name?: string) => Promise<MutationResult<TaskFile>>
  replaceFile: (existingFile: TaskFile, replacement: File) => Promise<MutationResult<TaskFile>>
  downloadFile: (file: TaskFile) => Promise<MutationResult<void>>
  getPreviewUrl: (file: TaskFile) => Promise<MutationResult<string>>
  deleteFile: (file: TaskFile) => Promise<MutationResult<void>>
}

const LOAD_ERROR = 'No se pudieron cargar los archivos adjuntos.'
const UPLOAD_ERROR = 'No se pudo guardar el archivo adjunto.'

export function useTaskFiles(taskId: string | null): UseTaskFilesResult {
  const { user } = useAuth()
  const toast = useToast()
  const userId = user?.id ?? null
  const [files, setFiles] = useState<TaskFile[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(taskId))
  const [isUploading, setIsUploading] = useState(false)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(() => new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const [replacingIds, setReplacingIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!taskId || !userId) {
      setFiles([])
      setIsLoading(false)
      setError(null)
      return
    }
    setIsLoading(true)
    try {
      const { data, error: queryError } = await supabase
        .from('task_files')
        .select('*')
        .eq('user_id', userId)
        .eq('master_task_id', taskId)
        .order('uploaded_at', { ascending: false })
      if (queryError) throw queryError
      setFiles(data ?? [])
      setError(null)
    } catch {
      setError(LOAD_ERROR)
    } finally {
      setIsLoading(false)
    }
  }, [taskId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const uploadFiles = useCallback(
    async (incomingFiles: File[]): Promise<MutationResult<TaskFile[]>> => {
      if (!taskId || !userId) return { ok: false, message: 'Inicia sesión para adjuntar archivos.' }
      if (incomingFiles.length === 0) return { ok: true, data: [] }

      const mimeByFile = new Map<File, string>()
      try {
        for (const file of incomingFiles) mimeByFile.set(file, getAttachmentMime(file))
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : UPLOAD_ERROR
        return { ok: false, message }
      }

      setIsUploading(true)
      setError(null)
      const created: TaskFile[] = []
      try {
        const { data: existingFiles, error: quotaError } = await supabase
          .from('task_files')
          .select('file_size')
          .eq('user_id', userId)
        if (quotaError) throw quotaError
        let usedBytes = (existingFiles ?? []).reduce((total, file) => total + file.file_size, 0)

        for (const file of incomingFiles) {
          if (usedBytes + file.size > USER_QUOTA_BYTES) {
            throw new Error('Has alcanzado el límite de 150 MiB de archivos adjuntos.')
          }
          const fileType = mimeByFile.get(file)
          if (!fileType) throw new Error(UPLOAD_ERROR)

          const objectPath = await uploadAttachment(userId, taskId, file)
          const { data, error: insertError } = await supabase
            .from('task_files')
            .insert({
              user_id: userId,
              master_task_id: taskId,
              file_name: file.name,
              file_url: objectPath,
              file_size: file.size,
              file_type: fileType,
            })
            .select('*')
            .single()

          if (insertError || !data) {
            try {
              await deleteAttachment(objectPath)
            } catch {
              setError('El registro del archivo falló y quedó un objeto pendiente de limpieza.')
            }
            throw insertError ?? new Error(UPLOAD_ERROR)
          }

          created.push(data)
          usedBytes += file.size
          setFiles((current) => [data, ...current])
        }
        return { ok: true, data: created }
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : UPLOAD_ERROR
        setError(message)
        return { ok: false, message }
      } finally {
        setIsUploading(false)
      }
    },
    [taskId, userId],
  )

  const addLink = useCallback(
    async (url: string, name?: string): Promise<MutationResult<TaskFile>> => {
      if (!taskId || !userId) return { ok: false, message: 'Inicia sesión para adjuntar enlaces.' }
      const trimmedUrl = url.trim()
      if (!trimmedUrl) return { ok: false, message: 'La URL no puede estar vacía.' }

      const normalized = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`
      const displayName = name?.trim() || trimmedUrl

      setIsUploading(true)
      setError(null)
      try {
        const { data, error: insertError } = await supabase
          .from('task_files')
          .insert({
            user_id: userId,
            master_task_id: taskId,
            file_name: displayName,
            file_url: normalized,
            file_size: 0,
            file_type: 'link',
          })
          .select('*')
          .single()

        if (insertError || !data) {
          throw insertError ?? new Error('No se pudo guardar el enlace.')
        }

        setFiles((current) => [data, ...current])
        return { ok: true, data }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo guardar el enlace.'
        setError(message)
        return { ok: false, message }
      } finally {
        setIsUploading(false)
      }
    },
    [taskId, userId],
  )

  const replaceFile = useCallback(
    async (existingFile: TaskFile, replacement: File): Promise<MutationResult<TaskFile>> => {
      if (!taskId || !userId || existingFile.user_id !== userId || existingFile.master_task_id !== taskId) {
        return { ok: false, message: 'No tienes permiso para reemplazar este archivo.' }
      }

      let fileType: string
      try {
        fileType = getAttachmentMime(replacement)
      } catch (replaceError) {
        return {
          ok: false,
          message: replaceError instanceof Error ? replaceError.message : UPLOAD_ERROR,
        }
      }

      setReplacingIds((current) => new Set(current).add(existingFile.id))
      setError(null)
      let newObjectPath: string | null = null
      try {
        const { data: existingFiles, error: quotaError } = await supabase
          .from('task_files')
          .select('file_size')
          .eq('user_id', userId)
        if (quotaError) throw quotaError
        const usedBytes = (existingFiles ?? []).reduce((total, file) => total + file.file_size, 0)
        if (usedBytes - existingFile.file_size + replacement.size > USER_QUOTA_BYTES) {
          throw new Error('Has alcanzado el límite de 150 MiB de archivos adjuntos.')
        }

        newObjectPath = await uploadAttachment(userId, taskId, replacement)
        const { data, error: updateError } = await supabase
          .from('task_files')
          .update({
            file_name: replacement.name,
            file_url: newObjectPath,
            file_size: replacement.size,
            file_type: fileType,
            uploaded_at: new Date().toISOString(),
          })
          .eq('id', existingFile.id)
          .eq('user_id', userId)
          .eq('master_task_id', taskId)
          .select('*')
          .single()
        if (updateError || !data) throw updateError ?? new Error(UPLOAD_ERROR)

        setFiles((current) => current.map((file) => file.id === data.id ? data : file))
        try {
          await deleteAttachment(existingFile.file_url)
        } catch {
          toast.warning('El archivo nuevo está guardado, pero la versión anterior quedó pendiente de limpieza.')
        }
        return { ok: true, data }
      } catch (replaceError) {
        if (newObjectPath) {
          try {
            await deleteAttachment(newObjectPath)
          } catch {
            toast.warning('No se pudo limpiar el archivo temporal. Puedes volver a intentarlo más tarde.')
          }
        }
        const message = replaceError instanceof Error ? replaceError.message : UPLOAD_ERROR
        setError(message)
        return { ok: false, message }
      } finally {
        setReplacingIds((current) => {
          const next = new Set(current)
          next.delete(existingFile.id)
          return next
        })
      }
    },
    [taskId, toast, userId],
  )

  const downloadFile = useCallback(async (file: TaskFile): Promise<MutationResult<void>> => {
    if (!userId || file.user_id !== userId) {
      return { ok: false, message: 'No tienes permiso para descargar este archivo.' }
    }
    if (file.file_type === 'link') {
      window.open(file.file_url, '_blank', 'noopener,noreferrer')
      return { ok: true, data: undefined }
    }
    setDownloadingIds((current) => new Set(current).add(file.id))
    try {
      const signedUrl = await getSignedUrl(file.file_url, file.file_name)
      const response = await fetch(signedUrl)
      if (!response.ok) throw new Error('No se pudo descargar el archivo.')
      const objectUrl = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = file.file_name
      anchor.rel = 'noopener'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      return { ok: true, data: undefined }
    } catch {
      return { ok: false, message: 'No se pudo descargar el archivo. Inténtalo de nuevo.' }
    } finally {
      setDownloadingIds((current) => {
        const next = new Set(current)
        next.delete(file.id)
        return next
      })
    }
  }, [userId])

  const getPreviewUrl = useCallback(
    async (file: TaskFile): Promise<MutationResult<string>> => {
      if (!userId || file.user_id !== userId) {
        return { ok: false, message: 'No tienes permiso para ver este archivo.' }
      }
      if (file.file_type === 'link') {
        return { ok: true, data: file.file_url }
      }
      try {
        const previewUrl = await getPreviewSignedUrl(file.file_url)
        return { ok: true, data: previewUrl }
      } catch {
        return { ok: false, message: 'No se pudo generar la vista previa del archivo.' }
      }
    },
    [userId],
  )

  const deleteFile = useCallback(
    async (file: TaskFile): Promise<MutationResult<void>> => {
      if (!userId || file.user_id !== userId || file.master_task_id !== taskId) {
        return { ok: false, message: 'No tienes permiso para eliminar este archivo.' }
      }
      setDeletingIds((current) => new Set(current).add(file.id))
      try {
        if (file.file_type !== 'link') {
          await deleteAttachment(file.file_url)
        }
        const { error: rowError } = await supabase
          .from('task_files')
          .delete()
          .eq('id', file.id)
          .eq('user_id', userId)
          .eq('master_task_id', taskId)
        if (rowError) throw rowError
        setFiles((current) => current.filter((candidate) => candidate.id !== file.id))
        return { ok: true, data: undefined }
      } catch {
        const message = 'No se pudo eliminar el archivo. Puedes volver a intentarlo.'
        setError(message)
        return { ok: false, message }
      } finally {
        setDeletingIds((current) => {
          const next = new Set(current)
          next.delete(file.id)
          return next
        })
      }
    },
    [taskId, userId],
  )

  return {
    files,
    isLoading,
    isUploading,
    downloadingIds,
    deletingIds,
    replacingIds,
    error,
    refresh,
    uploadFiles,
    addLink,
    replaceFile,
    downloadFile,
    getPreviewUrl,
    deleteFile,
  }
}
