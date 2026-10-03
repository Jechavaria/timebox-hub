/** Fecha local sin zona horaria, formato YYYY-MM-DD. */
export type LocalDateString = string
/** Hora del día, formato HH:MM o HH:MM:SS. */
export type TimeOfDayString = string
/** Marca de tiempo ISO 8601 con zona horaria (timestamptz). */
export type IsoTimestamp = string

// Las entidades usan `type` y no `interface` para ser asignables a Record<string, unknown>,
// restricción del genérico Database de supabase-js.

export type User = {
  id: string
  email: string | null
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type Credentials = {
  email: string
  password: string
}

export type AuthFailure = { ok: false; message: string }
export type AuthResult = { ok: true; needsEmailConfirmation: boolean } | AuthFailure
export type SignOutResult = { ok: true } | AuthFailure
export type MutationResult<T> = { ok: true; data: T } | { ok: false; message: string }

export type Area = {
  id: string
  user_id: string
  name: string
  /** Color en formato #RRGGBB. */
  color: string
  position: number
  is_hidden: boolean
  created_at: IsoTimestamp
}

export type AreaInsert = {
  id?: string
  user_id?: string
  name: string
  color?: string
  position?: number
  is_hidden?: boolean
  created_at?: IsoTimestamp
}

export type AreaUpdate = Partial<Omit<AreaInsert, 'id' | 'user_id' | 'created_at'>>

export type MasterTask = {
  id: string
  user_id: string
  area_id: string
  title: string
  description: string
  estimated_duration_minutes: number
  priority_order: number
  is_completed: boolean
  created_at: IsoTimestamp
}

export type MasterTaskInsert = {
  id?: string
  user_id?: string
  area_id: string
  title: string
  description?: string
  estimated_duration_minutes?: number
  priority_order?: number
  is_completed?: boolean
  created_at?: IsoTimestamp
}

export type MasterTaskUpdate = Partial<Omit<MasterTaskInsert, 'id' | 'user_id' | 'created_at'>>

export type ScheduleBlock = {
  id: string
  user_id: string
  /** Nulo en rutinas o cuando la tarea maestra original fue eliminada. */
  master_task_id: string | null
  /** Nulo en rutinas o cuando el ámbito fue eliminado. */
  area_id: string | null
  title: string
  notes: string
  scheduled_date: LocalDateString
  /** Nulo cuando el bloque está en la bandeja "Sin hora" del día. */
  start_time: TimeOfDayString | null
  planned_duration_minutes: number
  actual_duration_minutes: number | null
  is_completed: boolean
  is_routine: boolean
  created_at: IsoTimestamp
}

export type ScheduleBlockInsert = {
  id?: string
  user_id?: string
  master_task_id?: string | null
  area_id?: string | null
  title: string
  notes?: string
  scheduled_date: LocalDateString
  start_time?: TimeOfDayString | null
  planned_duration_minutes: number
  actual_duration_minutes?: number | null
  is_completed?: boolean
  is_routine?: boolean
  created_at?: IsoTimestamp
}

export type ScheduleBlockUpdate = Partial<Omit<ScheduleBlockInsert, 'id' | 'user_id' | 'created_at'>>

export type TaskFile = {
  id: string
  user_id: string
  master_task_id: string
  /** Nombre original del archivo, el que ve el usuario. */
  file_name: string
  /** Ruta del objeto dentro del bucket privado; nunca una URL pública. */
  file_url: string
  /** Tamaño en bytes. */
  file_size: number
  /** Tipo MIME. */
  file_type: string
  uploaded_at: IsoTimestamp
}

export type TaskFileInsert = {
  id?: string
  user_id?: string
  master_task_id: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  uploaded_at?: IsoTimestamp
}

export type TaskFileUpdate = Partial<Omit<TaskFileInsert, 'id' | 'user_id' | 'master_task_id'>>

export type RoutineKind = 'sleep' | 'transport' | 'meal' | 'leisure'

export type AgendaView = 'today-tomorrow' | 'week'

export type BlockTone = 'active' | 'muted' | 'neutral'

export type AreaDragData = {
  type: 'area'
  areaId: string
}

export type MasterTaskDragData = {
  type: 'master-task'
  taskId: string
  areaId: string
  durationMinutes: number
}

export type ScheduleBlockDragData = {
  type: 'schedule-block'
  blockId: string
  durationMinutes: number
}

export type DayTimelineDropData = {
  type: 'day-timeline'
  date: LocalDateString
}

export type DayUntimedDropData = {
  type: 'day-untimed'
  date: LocalDateString
}

export type DragSourceData = AreaDragData | MasterTaskDragData | ScheduleBlockDragData
export type DropTargetData = DayTimelineDropData | DayUntimedDropData
export type DndData = DragSourceData | DropTargetData
