import { addDays, parseLocalDate, toLocalDateString } from './time.ts'
import type { LocalDateString } from '../types/domain.ts'

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year'

export interface DateRange {
  start: LocalDateString
  end: LocalDateString
}

export const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
]

/** Domingo primero, como `Date#getDay()`. */
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const
/** Lunes primero, para las barras semanales. */
export const WEEKDAY_SHORT_MONDAY_FIRST = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
export const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const
export const MONTH_LONG = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Lunes de la semana que contiene `date`. */
export function startOfWeek(date: LocalDateString): LocalDateString {
  const offset = (parseLocalDate(date).getDay() + 6) % 7
  return addDays(date, -offset)
}

export function getPeriodRange(period: AnalyticsPeriod, anchor: LocalDateString): DateRange {
  const date = parseLocalDate(anchor)
  const year = date.getFullYear()
  const month = date.getMonth()
  switch (period) {
    case 'day':
      return { start: anchor, end: anchor }
    case 'week': {
      const start = startOfWeek(anchor)
      return { start, end: addDays(start, 6) }
    }
    case 'month':
      return {
        start: toLocalDateString(new Date(year, month, 1)),
        end: toLocalDateString(new Date(year, month, daysInMonth(year, month))),
      }
    case 'year':
      return {
        start: toLocalDateString(new Date(year, 0, 1)),
        end: toLocalDateString(new Date(year, 11, 31)),
      }
  }
}

/** Desplaza la fecha ancla `delta` períodos, ajustando el día al final de mes si hace falta. */
export function shiftAnchor(period: AnalyticsPeriod, anchor: LocalDateString, delta: number): LocalDateString {
  if (period === 'day') return addDays(anchor, delta)
  if (period === 'week') return addDays(anchor, delta * 7)

  const date = parseLocalDate(anchor)
  const targetYear = period === 'year' ? date.getFullYear() + delta : date.getFullYear()
  const rawMonth = period === 'month' ? date.getMonth() + delta : date.getMonth()
  const first = new Date(targetYear, rawMonth, 1)
  const day = Math.min(date.getDate(), daysInMonth(first.getFullYear(), first.getMonth()))
  return toLocalDateString(new Date(first.getFullYear(), first.getMonth(), day))
}

/** "Vie, 2 Oct 2026" */
export function formatDayLong(value: LocalDateString): string {
  const date = parseLocalDate(value)
  return `${WEEKDAY_SHORT[date.getDay()]}, ${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`
}

/** "Vie 2 Oct" */
export function formatDayCompact(value: LocalDateString): string {
  const date = parseLocalDate(value)
  return `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`
}

export function formatRangeLabel(period: AnalyticsPeriod, range: DateRange): string {
  const start = parseLocalDate(range.start)
  const end = parseLocalDate(range.end)
  switch (period) {
    case 'day':
      return formatDayLong(range.start)
    case 'week': {
      const sameYear = start.getFullYear() === end.getFullYear()
      const startLabel = `${start.getDate()} ${MONTH_SHORT[start.getMonth()]}${sameYear ? '' : ` ${start.getFullYear()}`}`
      const endLabel = `${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()}`
      return `${startLabel} – ${endLabel}`
    }
    case 'month':
      return `${MONTH_LONG[start.getMonth()]} ${start.getFullYear()}`
    case 'year':
      return String(start.getFullYear())
  }
}

export function isDateInRange(date: LocalDateString, range: DateRange): boolean {
  return date >= range.start && date <= range.end
}
