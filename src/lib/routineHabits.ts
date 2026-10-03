import type { ScheduleBlock } from '../types/domain.ts'

export type CompletionStatus = 'completed' | 'failed_time' | 'failed_abandoned'

export interface CustomRoutineTemplate {
  id: string
  label: string
  defaultTitle: string
  defaultMinutes: number
  suggestedTime: string
  defaultNotes: string
  iconName: 'Moon' | 'Car' | 'Utensils' | 'Coffee' | 'BookOpen' | 'Languages' | 'Dumbbell' | 'Sparkles' | 'Code' | 'Target'
  accentColor: string
  unitLabel?: string // Ej. "páginas", "lección", "km", "capítulo"
  targetQuantity?: number // Ej. 5, 1, 10
}

export const BUILTIN_ROUTINE_TEMPLATES: readonly CustomRoutineTemplate[] = [
  {
    id: 'sleep',
    label: 'Dormir',
    defaultTitle: 'Dormir / Descanso',
    defaultMinutes: 480,
    suggestedTime: '23:00',
    defaultNotes: 'Descanso nocturno reparador',
    iconName: 'Moon',
    accentColor: '#818cf8',
  },
  {
    id: 'duolingo',
    label: 'Duolingo / Idiomas',
    defaultTitle: 'Racha de Duolingo',
    defaultMinutes: 15,
    suggestedTime: '09:00',
    defaultNotes: 'Completar lección diaria para mantener la racha',
    iconName: 'Languages',
    accentColor: '#22c55e',
    unitLabel: 'lección',
    targetQuantity: 1,
  },
  {
    id: 'reading',
    label: 'Lectura de libro',
    defaultTitle: 'Lectura de libro',
    defaultMinutes: 30,
    suggestedTime: '21:00',
    defaultNotes: 'Lectura enfocada sin distracciones',
    iconName: 'BookOpen',
    accentColor: '#3b82f6',
    unitLabel: 'páginas',
    targetQuantity: 5,
  },
  {
    id: 'workout',
    label: 'Ejercicio / Gimnasio',
    defaultTitle: 'Entrenamiento físico',
    defaultMinutes: 60,
    suggestedTime: '07:00',
    defaultNotes: 'Rutina de pesas o cardio',
    iconName: 'Dumbbell',
    accentColor: '#f97316',
    unitLabel: 'sesión',
    targetQuantity: 1,
  },
  {
    id: 'meal',
    label: 'Comida',
    defaultTitle: 'Almuerzo / Comida',
    defaultMinutes: 60,
    suggestedTime: '13:00',
    defaultNotes: 'Alimentación e hidratación',
    iconName: 'Utensils',
    accentColor: '#10b981',
  },
  {
    id: 'transport',
    label: 'Transporte',
    defaultTitle: 'Transporte',
    defaultMinutes: 45,
    suggestedTime: '08:00',
    defaultNotes: '',
    iconName: 'Car',
    accentColor: '#f59e0b',
  },
  {
    id: 'leisure',
    label: 'Ocio / Pausa',
    defaultTitle: 'Ocio / Pausa activa',
    defaultMinutes: 45,
    suggestedTime: '18:30',
    defaultNotes: 'Tiempo libre y esparcimiento',
    iconName: 'Coffee',
    accentColor: '#ec4899',
  },
  {
    id: 'code',
    label: 'Práctica de Código',
    defaultTitle: 'Programación / Proyecto',
    defaultMinutes: 60,
    suggestedTime: '16:00',
    defaultNotes: 'Avanzar módulo del proyecto',
    iconName: 'Code',
    accentColor: '#06b6d4',
    unitLabel: 'commits',
    targetQuantity: 1,
  },
]

const CUSTOM_ROUTINES_KEY = 'timebox_custom_routines_templates'

export function getCustomRoutineTemplates(): CustomRoutineTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ROUTINES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomRoutineTemplate(template: CustomRoutineTemplate): CustomRoutineTemplate[] {
  try {
    const existing = getCustomRoutineTemplates().filter((item) => item.id !== template.id)
    const updated = [template, ...existing]
    localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return []
  }
}

export function deleteCustomRoutineTemplate(id: string): CustomRoutineTemplate[] {
  try {
    const existing = getCustomRoutineTemplates().filter((item) => item.id !== id)
    localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(existing))
    return existing
  } catch {
    return []
  }
}

export interface ParsedBlockStatus {
  status: CompletionStatus | 'active'
  isFailed: boolean
  failureReason?: string
  metricProgress?: string
  metricQuantity?: number
  metricUnit?: string
  targetMetric?: string
  initialPlan?: {
    time: string
    duration: number
  }
  cleanNotes: string
}

const STATUS_TAG_REGEX = /\[estado:(completada|fallida_tiempo|fallida)\]/i
const METRIC_TAG_REGEX = /\[(avance|metrica):([^\]]+)\]/i
const META_TAG_REGEX = /\[meta:([^\]]+)\]/i
const PLAN_INITIAL_REGEX = /\[plan_inicial:([0-9]{1,2}:[0-9]{2}(?:\s*(?:am|pm))?)\s*\(?([0-9]+)\s*m(?:in)?\)?\]/i

export function parseBlockStatus(block: Pick<ScheduleBlock, 'notes' | 'is_completed'>): ParsedBlockStatus {
  const notes = block.notes || ''
  let status: CompletionStatus | 'active' = block.is_completed ? 'completed' : 'active'
  let metricProgress: string | undefined
  let targetMetric: string | undefined
  let initialPlan: { time: string; duration: number } | undefined

  const statusMatch = notes.match(STATUS_TAG_REGEX)
  if (statusMatch) {
    const tag = statusMatch[1].toLowerCase()
    if (tag === 'fallida') status = 'failed_abandoned'
    else if (tag === 'fallida_tiempo') status = 'failed_time'
    else if (tag === 'completada') status = 'completed'
  }

  const metricMatch = notes.match(METRIC_TAG_REGEX)
  if (metricMatch) {
    metricProgress = metricMatch[2].trim()
  }

  const metaMatch = notes.match(META_TAG_REGEX)
  if (metaMatch) {
    targetMetric = metaMatch[1].trim()
  }

  const planMatch = notes.match(PLAN_INITIAL_REGEX)
  if (planMatch) {
    initialPlan = {
      time: planMatch[1].trim(),
      duration: Number(planMatch[2]),
    }
  }

  // Extraer número de progreso métrico si existe (ej. "5 páginas" -> 5)
  let metricQuantity: number | undefined
  let metricUnit: string | undefined
  if (metricProgress) {
    const numMatch = metricProgress.match(/(\d+(?:\.\d+)?)\s*(.*)/)
    if (numMatch) {
      metricQuantity = Number(numMatch[1])
      metricUnit = numMatch[2]?.trim() || ''
    }
  }

  // Fallback a targetMetric si no se especificó metricProgress explícito
  if (!metricQuantity && targetMetric) {
    const numMatch = targetMetric.match(/(\d+(?:\.\d+)?)\s*(.*)/)
    if (numMatch) {
      metricQuantity = Number(numMatch[1])
      metricUnit = numMatch[2]?.trim() || ''
    }
  }

  // Fallback inteligente para plantillas y hábitos conocidos basados en texto
  if (!metricQuantity) {
    const textLower = notes.toLowerCase()
    const numInText = textLower.match(/(\d+(?:\.\d+)?)\s*(páginas?|paginas?|pags?|lección|leccion|lecciones|km|kms|kilómetros|kilometros|capítulos?|capitulos?|minutos?|mins?|commits?)/i)
    if (numInText) {
      metricQuantity = Number(numInText[1])
      metricUnit = numInText[2].toLowerCase()
    }
  }

  // Notas limpias removiendo las etiquetas del sistema
  const cleanNotes = notes
    .replace(STATUS_TAG_REGEX, '')
    .replace(METRIC_TAG_REGEX, '')
    .replace(META_TAG_REGEX, '')
    .replace(PLAN_INITIAL_REGEX, '')
    .trim()

  return {
    status,
    isFailed: status === 'failed_abandoned' || status === 'failed_time',
    metricProgress,
    metricQuantity,
    metricUnit,
    targetMetric,
    initialPlan,
    cleanNotes,
  }
}

export function formatBlockNotesWithMeta({
  cleanNotes,
  status,
  metricProgress,
  targetMetric,
  initialPlan,
}: {
  cleanNotes: string
  status?: CompletionStatus
  metricProgress?: string
  targetMetric?: string
  initialPlan?: { time: string; duration: number }
}): string {
  const parts: string[] = []
  const base = cleanNotes.trim()
  if (base) parts.push(base)

  if (targetMetric?.trim()) {
    parts.push(`[meta:${targetMetric.trim()}]`)
  }

  if (initialPlan) {
    parts.push(`[plan_inicial:${initialPlan.time} (${initialPlan.duration}m)]`)
  }

  if (status) {
    const statusVal = status === 'failed_abandoned' ? 'fallida' : status === 'failed_time' ? 'fallida_tiempo' : 'completada'
    parts.push(`[estado:${statusVal}]`)
  }

  if (metricProgress?.trim()) {
    parts.push(`[avance:${metricProgress.trim()}]`)
  }

  return parts.join(' · ')
}
