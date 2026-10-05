import { addDays, isValidLocalDateString, safeParseLocalDate, toLocalDateString } from './time.ts'
import type { LocalDateString } from '../types/domain.ts'

export type { LocalDateString } from '../types/domain.ts'

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'weekdays' | 'custom'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval?: number // Cada X semanas / días (default: 1)
  weekdays?: number[] // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  count?: number // Número total de ocurrencias (incluyendo la inicial)
  endDate?: LocalDateString
}

export const ES_WEEKDAY_NAMES: readonly string[] = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]

export const ES_WEEKDAY_NAMES_CAPITALIZED: readonly string[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

export const DEFAULT_RECURRENCE_COUNTS: Record<RecurrenceFrequency, number> = {
  none: 1,
  daily: 14, // 2 semanas por defecto
  weekly: 8, // 8 semanas por defecto (~2 meses)
  weekdays: 20, // 4 semanas laborales (20 días de Lun a Vie)
  custom: 8,
}

/**
 * Obtiene el día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado) de una fecha YYYY-MM-DD.
 * Nunca lanza excepciones ante fechas parciales o inválidas.
 */
export function getDayOfWeek(dateStr: LocalDateString): number {
  const parsed = safeParseLocalDate(dateStr)
  return parsed ? parsed.getDay() : 1 // 1 = Lunes por defecto
}

/**
 * Obtiene el nombre del día en español (ej. "viernes").
 */
export function getWeekdayNameEs(dateStr: LocalDateString): string {
  const day = getDayOfWeek(dateStr)
  return ES_WEEKDAY_NAMES[day] ?? 'lunes'
}

/**
 * Genera las opciones de texto para el selector de recurrencia
 * basadas en la fecha base seleccionada.
 */
export function getRecurrenceOptionsForDate(dateStr: LocalDateString): {
  frequency: RecurrenceFrequency
  label: string
}[] {
  const weekday = getWeekdayNameEs(dateStr)
  return [
    { frequency: 'none', label: 'No se repite' },
    { frequency: 'daily', label: 'Todos los días' },
    { frequency: 'weekly', label: `Cada semana el ${weekday}` },
    { frequency: 'weekdays', label: 'Todos los días laborales (lunes a viernes)' },
    { frequency: 'custom', label: 'Personalizado...' },
  ]
}

/**
 * Describe una regla de recurrencia en lenguaje natural en español.
 */
export function describeRecurrenceRule(rule: RecurrenceRule, baseDate: LocalDateString): string {
  if (rule.frequency === 'none') return 'No se repite'

  const weekday = getWeekdayNameEs(baseDate)
  const count = rule.count ?? DEFAULT_RECURRENCE_COUNTS[rule.frequency]

  switch (rule.frequency) {
    case 'daily':
      return `Todos los días (${count} días)`
    case 'weekly':
      return `Cada semana el ${weekday} (${count} semanas)`
    case 'weekdays':
      return `Días laborales (Lun–Vie, ${count} sesiones)`
    case 'custom':
      if (rule.weekdays && rule.weekdays.length > 0) {
        const names = rule.weekdays.map((w) => ES_WEEKDAY_NAMES_CAPITALIZED[w].slice(0, 3)).join(', ')
        return `Repite: ${names} (${count} repeticiones)`
      }
      return `Cada ${rule.interval || 1} semana(s) (${count} repeticiones)`
    default:
      return 'No se repite'
  }
}

/**
 * Calcula todas las fechas en formato YYYY-MM-DD generadas por la regla de recurrencia.
 * Garantiza que la primera fecha sea startDate y respeta límites seguros para evitar desbordamientos.
 */
export function calculateRecurringDates(
  startDate: LocalDateString,
  rule: RecurrenceRule,
): LocalDateString[] {
  const validStart = isValidLocalDateString(startDate) ? startDate : toLocalDateString(new Date())
  if (rule.frequency === 'none') {
    return [validStart]
  }

  const targetCount = Math.max(1, Math.min(365, rule.count ?? DEFAULT_RECURRENCE_COUNTS[rule.frequency]))
  const results: LocalDateString[] = [validStart]
  const seen = new Set<string>([validStart])

  if (rule.frequency === 'daily') {
    let current = validStart
    while (results.length < targetCount) {
      current = addDays(current, 1)
      if (!seen.has(current)) {
        seen.add(current)
        results.push(current)
      }
    }
  } else if (rule.frequency === 'weekly') {
    const interval = Math.max(1, rule.interval ?? 1)
    let current = startDate
    while (results.length < targetCount) {
      current = addDays(current, 7 * interval)
      if (!seen.has(current)) {
        seen.add(current)
        results.push(current)
      }
    }
  } else if (rule.frequency === 'weekdays') {
    let current = startDate
    let safetyCounter = 0
    while (results.length < targetCount && safetyCounter < 1500) {
      safetyCounter++
      current = addDays(current, 1)
      const day = getDayOfWeek(current)
      // 0 = Domingo, 6 = Sábado
      if (day !== 0 && day !== 6) {
        if (!seen.has(current)) {
          seen.add(current)
          results.push(current)
        }
      }
    }
  } else if (rule.frequency === 'custom') {
    const weekdays = rule.weekdays && rule.weekdays.length > 0
      ? rule.weekdays
      : [getDayOfWeek(startDate)]
    const weekdaySet = new Set(weekdays)

    let current = startDate
    let safetyCounter = 0
    while (results.length < targetCount && safetyCounter < 2000) {
      safetyCounter++
      current = addDays(current, 1)
      const day = getDayOfWeek(current)
      if (weekdaySet.has(day)) {
        if (!seen.has(current)) {
          seen.add(current)
          results.push(current)
        }
      }
    }
  }

  return results
}

const REPEAT_TAG_REGEX = /\[repite:([^\]]+)\]/i

export function parseRecurrenceFromNotes(notes: string): string | null {
  const match = notes.match(REPEAT_TAG_REGEX)
  return match ? match[1].trim() : null
}

export function formatNotesWithRecurrence(notes: string, recurrenceDescription: string): string {
  const clean = notes.replace(REPEAT_TAG_REGEX, '').trim()
  if (!recurrenceDescription) return clean
  return clean ? `${clean} · [repite:${recurrenceDescription}]` : `[repite:${recurrenceDescription}]`
}
