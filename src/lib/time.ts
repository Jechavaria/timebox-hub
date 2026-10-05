import {
  AGENDA_WINDOW_DAYS,
  MIN_BLOCK_PX,
  MINUTES_PER_DAY,
  PX_PER_MINUTE,
  SNAP_MINUTES,
} from './constants.ts'
import type { LocalDateString, TimeOfDayString } from '../types/domain.ts'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/

const shortDateFormatter = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Usa el huso local; `toISOString()` devuelve la fecha UTC y adelanta el día en zonas UTC− por la noche. */
export function toLocalDateString(date: Date): LocalDateString {
  const year = String(date.getFullYear()).padStart(4, '0')
  return `${year}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Valida que un valor tenga exactamente formato YYYY-MM-DD y corresponda a una fecha del calendario real. */
export function isValidLocalDateString(value: unknown): value is LocalDateString {
  if (typeof value !== 'string') return false
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(year, month - 1, day)
  date.setFullYear(year)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/** Parsea una fecha local de forma segura devolviendo null en lugar de lanzar una excepción. */
export function safeParseLocalDate(value: unknown): Date | null {
  if (!isValidLocalDateString(value)) return null
  const match = DATE_PATTERN.exec(value)!
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  date.setFullYear(year)
  return date
}

export function parseLocalDate(value: LocalDateString): Date {
  const date = safeParseLocalDate(value)
  if (!date) {
    throw new RangeError(`Fecha inválida o inexistente "${value}": se esperaba YYYY-MM-DD válida`)
  }
  return date
}

export function addDays(value: LocalDateString, days: number): LocalDateString {
  const date = safeParseLocalDate(value) ?? new Date()
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

export function getWeekDates(
  start: LocalDateString,
  count: number = AGENDA_WINDOW_DAYS,
): LocalDateString[] {
  return Array.from({ length: count }, (_, index) => addDays(start, index))
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return toLocalDateString(a) === toLocalDateString(b)
}

/** Acepta HH:MM, HH:MM:SS o HH:MM:SS.fff (formato `time` de Postgres) y descarta los segundos. */
export function timeToMinutes(value: TimeOfDayString): number {
  const match = TIME_PATTERN.exec(value)
  if (!match) {
    throw new RangeError(`Hora inválida "${value}": se esperaba HH:MM[:SS]`)
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] === undefined ? 0 : Number(match[3])
  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw new RangeError(`Hora fuera de rango: "${value}"`)
  }
  return hours * 60 + minutes
}

/** Devuelve HH:MM:SS, el formato que espera una columna `time` de Postgres. */
export function minutesToTime(totalMinutes: number): TimeOfDayString {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0 || totalMinutes >= MINUTES_PER_DAY) {
    throw new RangeError(`Minutos fuera del día: ${totalMinutes}`)
  }
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}:00`
}

/** Devuelve hora en formato 12h (ej. "1:30 PM", "12:00 AM") para mostrar en pantalla sin lanzar error al pasar de medianoche. */
export function minutesToHM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) {
    return '12:00 AM'
  }
  const intMinutes = Math.round(totalMinutes)
  const normalized = ((intMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const totalHours = Math.floor(normalized / 60)
  const hours12 = totalHours % 12 === 0 ? 12 : totalHours % 12
  const minutes = pad2(normalized % 60)
  const ampm = totalHours >= 12 ? 'PM' : 'AM'
  return `${hours12}:${minutes} ${ampm}`
}

/**
 * Formatea un rango horario respetando bloques nocturnos que pasan de un día a otro.
 * Ej. 23:00 + 480 min -> "11:00 PM – 7:00 AM (+1 d)"
 */
export function formatBlockTimeRange(startMinutes: number, durationMinutes: number): {
  label: string
  crossesMidnight: boolean
  endMinutes: number
} {
  const endTotal = startMinutes + durationMinutes
  const crossesMidnight = endTotal > MINUTES_PER_DAY
  const endMinutes = endTotal % MINUTES_PER_DAY
  const startStr = minutesToHM(startMinutes)
  const endStr = minutesToHM(endMinutes)

  return {
    label: crossesMidnight ? `${startStr} – ${endStr} (+1 d)` : `${startStr} – ${endStr}`,
    crossesMidnight,
    endMinutes,
  }
}

/** Formatea una hora entera (0 a 23) en formato 12h (ej. "12:00 AM", "1:00 PM"). */
export function formatHour12(hour: number): string {
  const normalized = hour % 24
  const hours12 = normalized % 12 === 0 ? 12 : normalized % 12
  const ampm = normalized >= 12 ? 'PM' : 'AM'
  return `${hours12}:00 ${ampm}`
}

/** Minutos transcurridos desde la medianoche local, con fracción por los segundos. */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
}

export function minutesToPx(minutes: number): number {
  return minutes * PX_PER_MINUTE
}

export function pxToMinutes(px: number): number {
  return px / PX_PER_MINUTE
}

export function blockHeightPx(durationMinutes: number): number {
  return Math.max(MIN_BLOCK_PX, minutesToPx(durationMinutes))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Limita el inicio a cualquier intervalo válido del día (de 00:00 a 23:45). */
export function clampStartMinutes(startMinutes: number, _durationMinutes?: number): number {
  return clamp(startMinutes, 0, 1425)
}

export function snapMinutes(minutes: number, step: number = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step
}

export function formatDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

export function formatClockTime(date: Date): string {
  const rawHours = date.getHours()
  const hours12 = rawHours % 12 === 0 ? 12 : rawHours % 12
  const minutes = pad2(date.getMinutes())
  const ampm = rawHours >= 12 ? 'PM' : 'AM'
  return `${hours12}:${minutes} ${ampm}`
}

export function formatDateShort(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }
  return shortDateFormatter.format(date)
}

/** Milisegundos hasta el próximo cambio de minuto del reloj. */
export function msUntilNextMinute(nowMs: number = Date.now()): number {
  return 60_000 - (nowMs % 60_000)
}
