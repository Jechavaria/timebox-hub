import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import type { MasterTask, MasterTaskInsert, MutationResult } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'

const DURATION_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 180]

interface NewTaskInlineProps {
  areaId: string
  onCreate: (
    input: Pick<MasterTaskInsert, 'area_id' | 'title'> &
      Partial<Pick<MasterTaskInsert, 'description' | 'estimated_duration_minutes'>>,
  ) => Promise<MutationResult<MasterTask>>
}

export function NewTaskInline({ areaId, onCreate }: NewTaskInlineProps) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const uid = useId()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('Escribe el nombre de la tarea.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await onCreate({ area_id: areaId, title: cleanTitle, estimated_duration_minutes: duration })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setTitle('')
  }

  const handleSelectWheel = (event: React.WheelEvent<HTMLSelectElement>) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? 1 : -1
    const currentIndex = DURATION_OPTIONS.indexOf(duration)
    const nextIndex = Math.max(0, Math.min(DURATION_OPTIONS.length - 1, (currentIndex === -1 ? 2 : currentIndex) + delta))
    setDuration(DURATION_OPTIONS[nextIndex])
  }

  return (
    <form onSubmit={handleSubmit} className="flex shrink-0 flex-col gap-2 border-b border-glass-border px-3 py-3">
      <div className="flex items-center gap-2">
        <label htmlFor={uid} className="sr-only">Nueva tarea</label>
        <input
          id={uid}
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Añadir una tarea..."
          className="glass-input min-w-0 flex-1 font-medium placeholder:text-ink/75"
        />
        <label htmlFor={`${uid}-duration`} className="sr-only">Duración estimada</label>
        <select
          id={`${uid}-duration`}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
          onWheel={handleSelectWheel}
          aria-label="Duración estimada"
          className="glass-input w-[5.5rem] px-2 text-xs tabular-nums cursor-pointer"
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 0
                ? 'Sin est.'
                : minutes >= 60 && minutes % 60 === 0
                  ? `${minutes / 60} h`
                  : minutes >= 60
                    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
                    : `${minutes} min`}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm" aria-label="Añadir tarea" loading={saving} className="size-11 px-0">
          <Plus aria-hidden="true" className="size-5" />
        </Button>
      </div>
      {error ? <p role="alert" className="px-1 text-xs text-danger">{error}</p> : null}
    </form>
  )
}
