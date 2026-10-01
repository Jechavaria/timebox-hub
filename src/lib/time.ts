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

export function parseLocalDate(value: LocalDateString): Date {
  const match = DATE_PATTERN.exec(value)
  if (!match) {
    throw new RangeError(`Fecha inválida "${value}": se esperaba YYYY-MM-DD`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new RangeError(`Fecha inexistente: "${value}"`)
  }
  return date
}

export function addDays(value: LocalDateString, days: number): LocalDateString {
  const date = parseLocalDate(value)
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

/** Devuelve HH:MM para mostrar en pantalla; 1440 se muestra como 24:00 (fin de día). */
export function minutesToHM(totalMinutes: number): string {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0 || totalMinutes > MINUTES_PER_DAY) {
    throw new RangeError(`Minutos fuera del día: ${totalMinutes}`)
  }
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`
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

/** Limita el inicio para que el bloque termine como máximo a las 24:00. */
export function clampStartMinutes(startMinutes: number, durationMinutes: number): number {
  return clamp(startMinutes, 0, Math.max(0, MINUTES_PER_DAY - durationMinutes))
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
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function formatDateShort(date: Date): string {
  return shortDateFormatter.format(date)
}

/** Milisegundos hasta el próximo cambio de minuto del reloj. */
export function msUntilNextMinute(nowMs: number = Date.now()): number {
  return 60_000 - (nowMs % 60_000)
}
