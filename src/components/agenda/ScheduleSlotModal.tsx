import { useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { clamp, formatDuration, minutesToHM, parseLocalDate, snapMinutes } from '../../lib/time.ts'
import type { Area, LocalDateString, MasterTask, MutationResult, ScheduleBlock } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { DurationPicker } from '../ui/DurationPicker.tsx'
import { Modal } from '../ui/Modal.tsx'

interface ScheduleSlotModalProps {
  open: boolean
  date: LocalDateString | null
  startMinutes: number | null
  tasks: MasterTask[]
  areas: Area[]
  onClose: () => void
  onSelectTask: (task: MasterTask, date: LocalDateString, startMinutes: number | null) => Promise<void>
  onCreateNew: (input: {
    title: string
    duration: number
    areaId: string | null
    date: LocalDateString
    startMinutes: number | null
    saveToBacklog: boolean
  }) => Promise<MutationResult<ScheduleBlock>>
}

export function ScheduleSlotModal({
  open,
  date,
  startMinutes,
  tasks,
  areas,
  onClose,
  onSelectTask,
  onCreateNew,
}: ScheduleSlotModalProps) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing')
  const [search, setSearch] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all')

  // Estado para nueva tarea
  const [newTitle, setNewTitle] = useState('')
  const [newDuration, setNewDuration] = useState(30)
  const [newAreaId, setNewAreaId] = useState<string>(areas[0]?.id ?? '')
  const [saveToBacklog, setSaveToBacklog] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uid = useId()

  const areasById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])

  const eligibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks
      .filter((task) => !task.is_completed)
      .filter((task) => {
        if (selectedAreaId !== 'all' && task.area_id !== selectedAreaId) return false
        if (!q) return true
        return task.title.toLowerCase().includes(q)
      })
  }, [tasks, search, selectedAreaId])

  if (!date) return null

  const parsedDate = parseLocalDate(date)
  const formattedDate = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parsedDate)

  const timeLabel = startMinutes !== null ? minutesToHM(clamp(snapMinutes(startMinutes), 0, 1425)) : 'Sin hora'

  const handlePickTask = async (task: MasterTask) => {
    setSubmitting(true)
    setError(null)
    await onSelectTask(task, date, startMinutes)
    setSubmitting(false)
    onClose()
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = newTitle.trim()
    if (!clean) {
      setError('Escribe un título para la tarea o bloque.')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await onCreateNew({
      title: clean,
      duration: newDuration,
      areaId: newAreaId || null,
      date,
      startMinutes,
      saveToBacklog,
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setNewTitle('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Planificar en este horario"
      description={`${formattedDate} · ${timeLabel}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          {tab === 'new' ? (
            <Button
              type="submit"
              form={`${uid}-new-form`}
              variant="primary"
              loading={submitting}
            >
              <Check className="size-4" />
              Planificar
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Selector de pestañas */}
        <div className="flex rounded-xl border border-glass-border bg-glass p-1">
          <button
            type="button"
            onClick={() => setTab('existing')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              tab === 'existing'
                ? 'bg-accent text-canvas shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Elegir pendiente ({tasks.filter((t) => !t.is_completed).length})
          </button>
          <button
            type="button"
            onClick={() => setTab('new')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              tab === 'new'
                ? 'bg-accent text-canvas shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Crear nueva
          </button>
        </div>

        {tab === 'existing' ? (
          <div className="flex flex-col gap-3">
            {/* Buscador y filtro de ámbito */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
                <input
                  type="text"
                  placeholder="Buscar pendiente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="glass-input pl-9 text-sm"
                  data-autofocus
                />
              </div>
              {areas.length > 1 ? (
                <select
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  className="glass-input max-w-[9rem] text-xs"
                >
                  <option value="all">Todos los ámbitos</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {/* Lista de tareas pendientes para elegir */}
            <div className="max-h-72 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {eligibleTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-glass-border p-6 text-center text-sm text-ink-faint">
                  {search ? 'No se encontraron tareas con ese nombre.' : 'No tienes tareas pendientes disponibles.'}
                </div>
              ) : (
                eligibleTasks.map((task) => {
                  const area = areasById.get(task.area_id)
                  return (
                    <button
                      key={task.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => { void handlePickTask(task) }}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-glass p-3 text-left transition-all hover:border-accent hover:bg-glass-strong cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink group-hover:text-accent">
                          {task.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                          {area ? (
                            <span className="flex items-center gap-1">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: area.color }}
                              />
                              {area.name}
                            </span>
                          ) : null}
                          <span>·</span>
                          <span className="tabular-nums">
                            {formatDuration(task.estimated_duration_minutes || 30)}
                          </span>
                        </div>
                      </div>
                      <Plus className="size-5 shrink-0 text-ink-faint opacity-50 transition-all group-hover:opacity-100 group-hover:text-accent" />
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <form id={`${uid}-new-form`} onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-title`} className="text-sm font-medium text-ink">
                Nombre de la tarea
              </label>
              <input
                id={`${uid}-title`}
                data-autofocus
                maxLength={120}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Redactar informe, Llamar a cliente..."
                className="glass-input"
              />
            </div>

            <DurationPicker
              id={`${uid}-dur`}
              value={newDuration}
              onChange={setNewDuration}
              label="Duración"
            />

            {areas.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${uid}-area`} className="text-sm font-medium text-ink">
                  Ámbito
                </label>
                <select
                  id={`${uid}-area`}
                  value={newAreaId}
                  onChange={(e) => setNewAreaId(e.target.value)}
                  className="glass-input"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <label className="flex items-center gap-2.5 rounded-xl border border-glass-border bg-glass p-3 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={saveToBacklog}
                onChange={(e) => setSaveToBacklog(e.target.checked)}
                className="size-4 accent-accent"
              />
              <span>Guardar también en la matriz general de pendientes</span>
            </label>

            {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
          </form>
        )}
      </div>
    </Modal>
  )
}
