import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import clsx from 'clsx'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Layers,
  PieChart,
  RotateCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { parseBlockStatus } from '../../lib/routineHabits.ts'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useToday } from '../../hooks/useToday.ts'
import { useAnalyticsRange } from '../../hooks/useAnalyticsRange.ts'
import {
  MONTH_LONG,
  MONTH_SHORT,
  PERIOD_OPTIONS,
  WEEKDAY_SHORT_MONDAY_FIRST,
  daysInMonth,
  formatDayCompact,
  formatRangeLabel,
  getPeriodRange,
  isDateInRange,
  shiftAnchor,
} from '../../lib/analyticsPeriods.ts'
import type { AnalyticsPeriod } from '../../lib/analyticsPeriods.ts'
import {
  formatDuration,
  formatHour12,
  getWeekDates,
  minutesToHM,
  parseLocalDate,
  timeToMinutes,
} from '../../lib/time.ts'
import type { LocalDateString, ScheduleBlock } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Spinner } from '../ui/Spinner.tsx'

interface AnalyticsModalProps {
  open: boolean
  onClose: () => void
}

const NO_AREA_COLOR = 'var(--color-mute)'
const PEAK_FIRST_HOUR = 6
const PEAK_HOURS = 18 // 6:00 AM → 12:00 AM
const FREE_DAY_START = 8 * 60
const FREE_DAY_END = 22 * 60
const MIN_FREE_SLOT = 15

const PREV_LABEL: Record<AnalyticsPeriod, string> = {
  day: 'Día anterior',
  week: 'Semana anterior',
  month: 'Mes anterior',
  year: 'Año anterior',
}

const NEXT_LABEL: Record<AnalyticsPeriod, string> = {
  day: 'Día siguiente',
  week: 'Semana siguiente',
  month: 'Mes siguiente',
  year: 'Año siguiente',
}

const EMPTY_LABEL: Record<AnalyticsPeriod, string> = {
  day: 'este día',
  week: 'esta semana',
  month: 'este mes',
  year: 'este año',
}

function safeStartMinutes(block: ScheduleBlock): number | null {
  if (!block.start_time) return null
  try {
    return timeToMinutes(block.start_time)
  } catch {
    return null
  }
}

function signedDuration(minutes: number): string {
  if (minutes === 0) return '0 min'
  return `${minutes > 0 ? '+' : '−'}${formatDuration(Math.abs(minutes))}`
}

export function AnalyticsModal({ open, onClose }: AnalyticsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dashboard Analítico de Tiempo"
      description="Métricas de rendimiento, distribución de ámbitos y horas pico por día, semana, mes o año."
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      {/* Se monta solo con el modal abierto: el estado vuelve a "Día · Hoy" en cada apertura. */}
      {open ? <AnalyticsDashboard /> : null}
    </Modal>
  )
}

interface TrendBucket {
  key: string
  label: string
  showLabel: boolean
  title: string
  planned: number
  completed: number
  count: number
  completedCount: number
  isCurrent: boolean
}

function AnalyticsDashboard() {
  const { areas } = usePlanner()
  const today = useToday()
  const [period, setPeriod] = useState<AnalyticsPeriod>('day')
  const [anchor, setAnchor] = useState<LocalDateString>(today)
  const tabsId = useId()
  const dateInputId = useId()

  const range = useMemo(() => getPeriodRange(period, anchor), [period, anchor])
  const rangeLabel = formatRangeLabel(period, range)
  const containsToday = isDateInRange(today, range)
  const { blocks, isLoading, error, refresh } = useAnalyticsRange(range.start, range.end, true)

  const areasById = useMemo(() => new Map(areas.areas.map((a) => [a.id, a])), [areas.areas])

  // 1. Métricas de resumen general, completitud y fallos
  const summary = useMemo(() => {
    let plannedTotalMinutes = 0
    let actualCompletedMinutes = 0
    let plannedForCompletedMinutes = 0
    let completedCount = 0
    let completedSuccessCount = 0
    let failedTimeCount = 0
    let failedAbandonedCount = 0

    for (const b of blocks) {
      plannedTotalMinutes += b.planned_duration_minutes
      const statusInfo = parseBlockStatus(b)
      if (b.is_completed) {
        completedCount += 1
        plannedForCompletedMinutes += b.planned_duration_minutes
        actualCompletedMinutes += b.actual_duration_minutes ?? b.planned_duration_minutes

        if (statusInfo.status === 'failed_abandoned') {
          failedAbandonedCount += 1
        } else if (statusInfo.status === 'failed_time') {
          failedTimeCount += 1
        } else {
          completedSuccessCount += 1
        }
      }
    }

    const totalBlocks = blocks.length
    const totalFailedCount = failedTimeCount + failedAbandonedCount
    return {
      totalBlocks,
      completedCount,
      completedSuccessCount,
      failedTimeCount,
      failedAbandonedCount,
      totalFailedCount,
      completionRate: totalBlocks > 0 ? Math.round((completedCount / totalBlocks) * 100) : 0,
      successRate: totalBlocks > 0 ? Math.round((completedSuccessCount / totalBlocks) * 100) : 0,
      plannedTotalMinutes,
      actualCompletedMinutes,
      discrepancy: actualCompletedMinutes - plannedForCompletedMinutes,
    }
  }, [blocks])

  // Seguimiento de Rutinas y Hábitos cotidianos
  const habitsAnalysis = useMemo(() => {
    const map = new Map<string, {
      title: string
      totalCount: number
      completedCount: number
      failedCount: number
      totalMinutes: number
      totalQuantity: number
      primaryUnit: string
      unitsSummary: string[]
    }>()

    for (const b of blocks) {
      const statusInfo = parseBlockStatus(b)
      const isRoutineOrHabit = b.is_routine || Boolean(statusInfo.targetMetric) || Boolean(statusInfo.metricProgress)
      if (!isRoutineOrHabit) continue

      const key = b.title.trim().toLowerCase()
      const existing = map.get(key) ?? {
        title: b.title.trim(),
        totalCount: 0,
        completedCount: 0,
        failedCount: 0,
        totalMinutes: 0,
        totalQuantity: 0,
        primaryUnit: '',
        unitsSummary: [],
      }

      existing.totalCount += 1
      if (b.is_completed) {
        if (statusInfo.isFailed) {
          existing.failedCount += 1
        } else {
          existing.completedCount += 1
        }
        existing.totalMinutes += b.actual_duration_minutes ?? b.planned_duration_minutes

        if (statusInfo.metricQuantity && statusInfo.metricQuantity > 0) {
          existing.totalQuantity += statusInfo.metricQuantity
        }
        if (statusInfo.metricUnit && !existing.primaryUnit) {
          existing.primaryUnit = statusInfo.metricUnit
        }

        if (statusInfo.metricProgress && !existing.unitsSummary.includes(statusInfo.metricProgress)) {
          existing.unitsSummary.push(statusInfo.metricProgress)
        }
      }
      map.set(key, existing)
    }

    return Array.from(map.values()).sort((a, b) => b.completedCount - a.completedCount)
  }, [blocks])

  // Análisis de Áreas donde más se falla
  const failureAnalysis = useMemo(() => {
    const areaFailures = new Map<string, { name: string; color: string; total: number; failed: number }>()

    for (const b of blocks) {
      const statusInfo = parseBlockStatus(b)
      const area = b.area_id ? areasById.get(b.area_id) : null
      const key = area ? area.id : '__no_area__'
      const curr = areaFailures.get(key) ?? {
        name: area ? area.name : 'Rutinas / General',
        color: area ? area.color : NO_AREA_COLOR,
        total: 0,
        failed: 0,
      }
      curr.total += 1
      if (statusInfo.isFailed) {
        curr.failed += 1
      }
      areaFailures.set(key, curr)
    }

    const list = Array.from(areaFailures.values()).filter((item) => item.failed > 0)
    list.sort((a, b) => b.failed - a.failed)
    return list
  }, [blocks, areasById])

  // 2. Distribución de tiempo por Ámbito
  const areaDistribution = useMemo(() => {
    const totals = new Map<string, { key: string; name: string; color: string; minutes: number }>()

    for (const b of blocks) {
      const area = b.area_id ? areasById.get(b.area_id) : null
      const key = area ? area.id : '__no_area__'
      const current = totals.get(key) ?? {
        key,
        name: area ? area.name : 'Rutinas / General',
        color: area ? area.color : NO_AREA_COLOR,
        minutes: 0,
      }
      current.minutes += b.planned_duration_minutes
      totals.set(key, current)
    }

    const list = Array.from(totals.values()).sort((a, b) => b.minutes - a.minutes)
    const totalMins = list.reduce((acc, curr) => acc + curr.minutes, 0)
    return list.map((item) => ({
      ...item,
      percentage: totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0,
    }))
  }, [blocks, areasById])

  // 3. Tendencia: un bucket por día (semana/mes) o por mes (año)
  const trend = useMemo<TrendBucket[]>(() => {
    if (period === 'day') return []

    const buckets: TrendBucket[] = []
    const indexByKey = new Map<string, number>()
    const push = (bucket: Omit<TrendBucket, 'planned' | 'completed' | 'count' | 'completedCount'>) => {
      indexByKey.set(bucket.key, buckets.length)
      buckets.push({ ...bucket, planned: 0, completed: 0, count: 0, completedCount: 0 })
    }

    if (period === 'year') {
      const year = parseLocalDate(range.start).getFullYear()
      const currentMonthKey = today.slice(0, 7)
      MONTH_SHORT.forEach((label, index) => {
        const key = `${year}-${String(index + 1).padStart(2, '0')}`
        push({
          key,
          label,
          showLabel: true,
          title: `${MONTH_LONG[index]} ${year}`,
          isCurrent: key === currentMonthKey,
        })
      })
    } else {
      const start = parseLocalDate(range.start)
      const count = period === 'week' ? 7 : daysInMonth(start.getFullYear(), start.getMonth())
      getWeekDates(range.start, count).forEach((date, index) => {
        const dayNumber = parseLocalDate(date).getDate()
        push({
          key: date,
          label: period === 'week' ? WEEKDAY_SHORT_MONDAY_FIRST[index] : String(dayNumber),
          showLabel: period === 'week' || dayNumber === 1 || dayNumber % 5 === 0,
          title: formatDayCompact(date),
          isCurrent: date === today,
        })
      })
    }

    const keyOf = (b: ScheduleBlock) => (period === 'year' ? b.scheduled_date.slice(0, 7) : b.scheduled_date)
    for (const b of blocks) {
      const index = indexByKey.get(keyOf(b))
      if (index === undefined) continue
      const bucket = buckets[index]
      bucket.planned += b.planned_duration_minutes
      bucket.count += 1
      if (b.is_completed) {
        bucket.completed += b.planned_duration_minutes
        bucket.completedCount += 1
      }
    }
    return buckets
  }, [blocks, period, range.start, today])

  const trendMax = useMemo(() => Math.max(1, ...trend.map((b) => b.planned)), [trend])

  // 4. Horas pico de actividad (minutos programados por hora, 6:00 AM a 12:00 AM)
  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: PEAK_HOURS }, (_, i) => {
      const hour = i + PEAK_FIRST_HOUR
      const h12 = hour % 12 === 0 ? 12 : hour % 12
      return {
        hour,
        label: formatHour12(hour),
        shortLabel: `${h12}${hour >= 12 ? 'pm' : 'am'}`,
        minutes: 0,
      }
    })

    for (const b of blocks) {
      const startMin = safeStartMinutes(b)
      if (startMin === null) continue
      const endMin = startMin + b.planned_duration_minutes
      for (const h of hours) {
        const slotStart = h.hour * 60
        const overlap = Math.min(endMin, slotStart + 60) - Math.max(startMin, slotStart)
        if (overlap > 0) h.minutes += overlap
      }
    }

    const peakHour = hours.reduce((peak, h) => (h.minutes > peak.minutes ? h : peak), hours[0])
    const maxMinutes = Math.max(...hours.map((h) => h.minutes), 1)
    return { hours, peakHour, maxMinutes }
  }, [blocks])

  // 5. Bloques libres del día seleccionado (8:00 AM a 10:00 PM) — solo en vista Día
  const freeSlots = useMemo(() => {
    if (period !== 'day') return []
    const dayBlocks = blocks
      .filter((b) => b.scheduled_date === range.start)
      .flatMap((b) => {
        const start = safeStartMinutes(b)
        return start === null ? [] : [{ start, end: start + b.planned_duration_minutes }]
      })
      .sort((a, b) => a.start - b.start)

    const slots: { startMinutes: number; endMinutes: number; duration: number }[] = []
    let cursor = FREE_DAY_START
    for (const b of dayBlocks) {
      const gapEnd = Math.min(b.start, FREE_DAY_END)
      if (gapEnd - cursor >= MIN_FREE_SLOT) {
        slots.push({ startMinutes: cursor, endMinutes: gapEnd, duration: gapEnd - cursor })
      }
      cursor = Math.max(cursor, b.end)
      if (cursor >= FREE_DAY_END) break
    }
    if (FREE_DAY_END - cursor >= MIN_FREE_SLOT) {
      slots.push({ startMinutes: cursor, endMinutes: FREE_DAY_END, duration: FREE_DAY_END - cursor })
    }
    return slots
  }, [blocks, period, range.start])

  const selectPeriod = (next: AnalyticsPeriod) => setPeriod(next)

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % PERIOD_OPTIONS.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + PERIOD_OPTIONS.length) % PERIOD_OPTIONS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = PERIOD_OPTIONS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    selectPeriod(PERIOD_OPTIONS[nextIndex].value)
    document.getElementById(`${tabsId}-tab-${PERIOD_OPTIONS[nextIndex].value}`)?.focus()
  }

  const isEmpty = !isLoading && !error && blocks.length === 0

  return (
    <div className="space-y-5">
      {/* Selector de período y navegación */}
      <div className="space-y-3 border-b border-glass-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent">
              <BarChart3 className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Rango de análisis
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Período de análisis"
            className="flex rounded-xl border border-glass-border bg-glass p-0.5"
          >
            {PERIOD_OPTIONS.map((option, index) => {
              const selected = option.value === period
              return (
                <button
                  key={option.value}
                  id={`${tabsId}-tab-${option.value}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${tabsId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectPeriod(option.value)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={clsx(
                    'min-h-8 rounded-lg px-3 text-xs font-medium transition-colors',
                    selected ? 'bg-accent-soft text-accent shadow-sm' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <IconButton
              label={PREV_LABEL[period]}
              size="sm"
              variant="glass"
              onClick={() => setAnchor((current) => shiftAnchor(period, current, -1))}
            >
              <ChevronLeft />
            </IconButton>
            <p
              className="min-w-0 truncate px-2 text-sm font-semibold tabular-nums text-ink sm:text-base"
              aria-live="polite"
            >
              <CalendarRange className="mr-1.5 inline size-4 align-[-2px] text-accent" aria-hidden="true" />
              {rangeLabel}
            </p>
            <IconButton
              label={NEXT_LABEL[period]}
              size="sm"
              variant="glass"
              onClick={() => setAnchor((current) => shiftAnchor(period, current, 1))}
            >
              <ChevronRight />
            </IconButton>
          </div>

          <div className="flex items-center gap-2">
            {period === 'day' || period === 'week' ? (
              <>
                <label htmlFor={dateInputId} className="sr-only">
                  Elegir fecha
                </label>
                <input
                  id={dateInputId}
                  type="date"
                  value={anchor}
                  onChange={(event) => {
                    if (event.target.value) setAnchor(event.target.value)
                  }}
                  className="glass-input min-h-9 px-2 py-1 text-xs tabular-nums"
                />
              </>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}
              onClick={() => setAnchor(today)}
              disabled={anchor === today}
            >
              Hoy
            </Button>
          </div>
        </div>
      </div>

      <div
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${period}`}
        aria-busy={isLoading || undefined}
        className="space-y-5"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Spinner size="lg" label={`Cargando métricas de ${rangeLabel}`} />
            <p className="text-xs text-ink-muted">Cargando métricas…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-glass-border bg-glass px-4 py-10 text-center">
            <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
            <p role="alert" className="max-w-sm text-sm text-ink">
              {error}
            </p>
            <Button size="sm" onClick={refresh} leadingIcon={<RotateCcw className="size-3.5" aria-hidden="true" />}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            {isEmpty ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-glass-border bg-glass px-4 py-10 text-center">
                <span className="grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <CalendarRange className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-ink">Sin bloques en {EMPTY_LABEL[period]}</p>
                <p className="max-w-sm text-xs text-ink-muted">
                  No hay bloques programados para {rangeLabel}. Planifica tu agenda o elige otro período.
                </p>
              </div>
            ) : (
              <>
                {/* Tarjetas de Métricas Clave */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                  <MetricCard
                    className="sm:col-span-3"
                    label="Planificado"
                    icon={<Clock className="size-4 text-ink-muted" aria-hidden="true" />}
                    value={formatDuration(summary.plannedTotalMinutes)}
                    hint="Carga asignada"
                  />
                  <MetricCard
                    className="sm:col-span-3"
                    label="Tiempo real"
                    icon={<Sparkles className="size-4 text-success" aria-hidden="true" />}
                    value={formatDuration(summary.actualCompletedMinutes)}
                    valueClassName="text-success"
                    hint="Ejecutado en bloques completados"
                  />
                  <MetricCard
                    className="sm:col-span-2"
                    label="Completitud"
                    icon={<Target className="size-4 text-accent" aria-hidden="true" />}
                    value={`${summary.completionRate}%`}
                    hint={
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-glass-strong">
                        <span
                          className="block h-full rounded-full bg-accent transition-[width] duration-300"
                          style={{ width: `${summary.completionRate}%` }}
                        />
                      </span>
                    }
                  />
                  <MetricCard
                    className="sm:col-span-2"
                    label="Discrepancia"
                    icon={
                      summary.discrepancy > 0 ? (
                        <TrendingUp className="size-4 text-warning" aria-hidden="true" />
                      ) : summary.discrepancy < 0 ? (
                        <TrendingDown className="size-4 text-accent" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                      )
                    }
                    value={signedDuration(summary.discrepancy)}
                    valueClassName={
                      summary.discrepancy > 0
                        ? 'text-warning'
                        : summary.discrepancy < 0
                          ? 'text-accent'
                          : 'text-success'
                    }
                    hint={
                      summary.discrepancy === 0
                        ? 'Real vs planeado: exacto'
                        : summary.discrepancy > 0
                          ? 'Más de lo planeado'
                          : 'Menos de lo planeado'
                    }
                  />
                  <MetricCard
                    className="col-span-2 sm:col-span-2"
                    label="Bloques"
                    icon={<Layers className="size-4 text-accent" aria-hidden="true" />}
                    value={
                      <>
                        {summary.completedCount}{' '}
                        <span className="text-xs font-normal text-ink-muted">/ {summary.totalBlocks}</span>
                      </>
                    }
                    hint="Completados / programados"
                  />
                </div>

                {/* Tendencia por día / mes */}
                {period !== 'day' ? (
                  <Section
                    icon={<BarChart3 className="size-4 text-accent" aria-hidden="true" />}
                    title={period === 'year' ? 'Tendencia mensual' : 'Tendencia diaria'}
                    aside={
                      <span className="flex items-center gap-3 text-[11px] text-ink-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm border border-accent/40 bg-accent-soft" aria-hidden="true" />
                          Planificado
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm bg-accent" aria-hidden="true" />
                          Completado
                        </span>
                      </span>
                    }
                  >
                    <p className="mb-2 text-[11px] text-ink-faint">Máximo: {formatDuration(trendMax)}</p>
                    <ul
                      aria-label={`Tendencia de ${rangeLabel}: tiempo planificado y completado`}
                      className={clsx('flex h-36 items-stretch', period === 'month' ? 'gap-0.5' : 'gap-1.5')}
                    >
                      {trend.map((bucket) => {
                        const plannedPct = (bucket.planned / trendMax) * 100
                        const completedPct = (bucket.completed / trendMax) * 100
                        const description = `${bucket.title}: ${formatDuration(bucket.planned)} planificado, ${formatDuration(bucket.completed)} completado (${bucket.completedCount}/${bucket.count} bloques)`
                        return (
                          <li
                            key={bucket.key}
                            title={description}
                            className="flex min-w-0 flex-1 flex-col items-center gap-1"
                          >
                            <span className="sr-only">{description}</span>
                            <div
                              aria-hidden="true"
                              className="relative flex w-full flex-1 items-end overflow-hidden rounded-md bg-glass"
                            >
                              {bucket.planned > 0 ? (
                                <div
                                  className="absolute inset-x-0 bottom-0 rounded-md border border-accent/40 bg-accent-soft transition-[height] duration-300"
                                  style={{ height: `${Math.max(plannedPct, 3)}%` }}
                                />
                              ) : null}
                              {bucket.completed > 0 ? (
                                <div
                                  className="absolute inset-x-0 bottom-0 rounded-md bg-accent transition-[height] duration-300"
                                  style={{ height: `${Math.max(completedPct, 3)}%` }}
                                />
                              ) : null}
                            </div>
                            <span
                              aria-hidden="true"
                              className={clsx(
                                'h-3.5 text-[10px] leading-none tabular-nums',
                                bucket.isCurrent ? 'font-semibold text-accent' : 'text-ink-faint',
                              )}
                            >
                              {bucket.showLabel ? bucket.label : ''}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </Section>
                ) : null}

                {/* Distribución de Tiempo por Ámbito */}
                <Section
                  icon={<PieChart className="size-4 text-accent" aria-hidden="true" />}
                  title="Distribución por Ámbito"
                  aside={
                    <span className="text-xs text-ink-muted">
                      Total: {formatDuration(summary.plannedTotalMinutes)}
                    </span>
                  }
                >
                  <ul className="space-y-3">
                    {areaDistribution.map((item) => (
                      <li key={item.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                              aria-hidden="true"
                            />
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-ink-muted">
                            {formatDuration(item.minutes)} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-glass-strong" aria-hidden="true">
                          <div
                            className="h-full rounded-full transition-[width] duration-300"
                            style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>

                {/* Horas Pico de Actividad */}
                <Section
                  icon={<Flame className="size-4 text-warning" aria-hidden="true" />}
                  title="Horas Pico de Actividad"
                  aside={
                    hourlyActivity.peakHour.minutes > 0 ? (
                      <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                        Pico: {hourlyActivity.peakHour.label} ({formatDuration(hourlyActivity.peakHour.minutes)})
                      </span>
                    ) : null
                  }
                >
                  <p className="mb-3 text-xs text-ink-muted">
                    {period === 'day'
                      ? 'Minutos programados por hora (de 6:00 AM a 12:00 AM):'
                      : 'Minutos programados por hora, acumulados en el período (de 6:00 AM a 12:00 AM):'}
                  </p>
                  {hourlyActivity.peakHour.minutes === 0 ? (
                    <p className="py-3 text-center text-xs text-ink-muted">
                      Ningún bloque tiene hora de inicio asignada en este período.
                    </p>
                  ) : (
                    <ul
                      aria-label="Densidad de actividad por hora"
                      className="flex h-20 items-end gap-1 overflow-x-auto pt-2"
                    >
                      {hourlyActivity.hours.map((h) => {
                        const heightPct = Math.round((h.minutes / hourlyActivity.maxMinutes) * 100)
                        const isPeak = h.hour === hourlyActivity.peakHour.hour
                        const description = `${h.label}: ${formatDuration(h.minutes)} ocupados`
                        return (
                          <li
                            key={h.hour}
                            className="flex min-w-[20px] flex-1 flex-col items-center gap-1"
                            title={description}
                          >
                            <span className="sr-only">{description}</span>
                            <div
                              aria-hidden="true"
                              className="flex h-12 w-full items-end justify-center rounded-sm bg-glass"
                            >
                              <div
                                className={clsx(
                                  'w-full rounded-sm transition-[height] duration-200',
                                  isPeak ? 'bg-warning' : 'bg-accent/60',
                                )}
                                style={{ height: `${h.minutes > 0 ? Math.max(heightPct, 4) : 0}%` }}
                              />
                            </div>
                            <span aria-hidden="true" className="text-[9px] tabular-nums text-ink-faint">
                              {h.shortLabel}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Section>
                {/* Seguimiento de Rutinas y Hábitos Cotidianos */}
                <Section
                  icon={<BookOpen className="size-4 text-accent" aria-hidden="true" />}
                  title="Rutinas y Hábitos Cotidianos"
                  aside={
                    <span className="text-xs text-ink-muted">
                      {habitsAnalysis.length} hábitos en {rangeLabel}
                    </span>
                  }
                >
                  {habitsAnalysis.length === 0 ? (
                    <p className="py-3 text-center text-xs text-ink-muted">
                      No hay rutinas o hábitos registrados en este período. Agrega rutinas como Duolingo, Lectura o Ejercicio en tu agenda.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {/* Resumen global de hábitos en el período */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-accent/20 bg-accent/5 p-2.5 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Hábitos seguidos</p>
                          <p className="mt-0.5 text-lg font-extrabold text-ink tabular-nums">{habitsAnalysis.length}</p>
                        </div>
                        <div className="rounded-xl border border-success/20 bg-success/5 p-2.5 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-success">Tiempo en hábitos</p>
                          <p className="mt-0.5 text-lg font-extrabold text-success tabular-nums">
                            {formatDuration(habitsAnalysis.reduce((acc, h) => acc + h.totalMinutes, 0))}
                          </p>
                        </div>
                        <div className="col-span-2 sm:col-span-1 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Sesiones completadas</p>
                          <p className="mt-0.5 text-lg font-extrabold text-blue-300 tabular-nums">
                            {habitsAnalysis.reduce((acc, h) => acc + h.completedCount, 0)}
                          </p>
                        </div>
                      </div>

                      {/* Tarjetas individuales de hábitos con acumulación */}
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {habitsAnalysis.map((habit) => (
                          <div
                            key={habit.title}
                            className="flex flex-col gap-2 rounded-2xl border border-glass-border bg-glass p-3.5 shadow-sm hover:border-glass-border/80 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-ink truncate">{habit.title}</span>
                              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent tabular-nums">
                                {habit.completedCount}/{habit.totalCount} sesiones
                              </span>
                            </div>

                            {/* Métricas clave: Progreso Acumulado + Tiempo Invertido */}
                            <div className="grid grid-cols-2 gap-2 my-0.5">
                              <div className="rounded-xl border border-glass-border/70 bg-glass/60 p-2 text-center">
                                <p className="text-[10px] font-semibold uppercase text-ink-faint">
                                  Progreso acumulado
                                </p>
                                <p className="mt-0.5 text-sm font-extrabold text-accent tabular-nums">
                                  {habit.totalQuantity > 0 ? (
                                    <>
                                      {habit.totalQuantity}{' '}
                                      <span className="text-[11px] font-medium text-ink-muted">
                                        {habit.primaryUnit || 'unidades'}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      {habit.completedCount}{' '}
                                      <span className="text-[11px] font-medium text-ink-muted">sesiones</span>
                                    </>
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl border border-glass-border/70 bg-glass/60 p-2 text-center">
                                <p className="text-[10px] font-semibold uppercase text-ink-faint">
                                  Tiempo invertido
                                </p>
                                <p className="mt-0.5 text-sm font-extrabold text-success tabular-nums">
                                  {formatDuration(habit.totalMinutes)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-glass-border/40">
                              <span className="tabular-nums">
                                Efectividad: {habit.totalCount > 0 ? Math.round((habit.completedCount / habit.totalCount) * 100) : 0}%
                              </span>
                              {habit.failedCount > 0 ? (
                                <span className="text-danger font-medium">{habit.failedCount} fallidas</span>
                              ) : (
                                <span className="text-success font-medium">✨ 100% éxito</span>
                              )}
                            </div>

                            {habit.unitsSummary.length > 0 && habit.totalQuantity === 0 ? (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {habit.unitsSummary.map((u, i) => (
                                  <span
                                    key={i}
                                    className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                                  >
                                    🎯 {u}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>

                {/* Control de Cumplimiento y Análisis de Fallos */}
                <Section
                  icon={<AlertTriangle className="size-4 text-warning" aria-hidden="true" />}
                  title="Control de Cumplimiento y Análisis de Fallos"
                  aside={
                    <span className="rounded-md bg-glass px-2 py-0.5 text-xs font-semibold text-ink-muted">
                      Tasa de éxito: {summary.successRate}%
                    </span>
                  }
                >
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="rounded-xl border border-success/30 bg-success/10 p-2">
                      <p className="text-[11px] text-success font-medium">A tiempo</p>
                      <p className="text-base font-bold text-success tabular-nums">{summary.completedSuccessCount}</p>
                    </div>
                    <div className="rounded-xl border border-warning/30 bg-warning/10 p-2">
                      <p className="text-[11px] text-warning font-medium">Tiempo excedido</p>
                      <p className="text-base font-bold text-warning tabular-nums">{summary.failedTimeCount}</p>
                    </div>
                    <div className="rounded-xl border border-danger/30 bg-danger/10 p-2">
                      <p className="text-[11px] text-danger font-medium">No realizadas</p>
                      <p className="text-base font-bold text-danger tabular-nums">{summary.failedAbandonedCount}</p>
                    </div>
                  </div>

                  {failureAnalysis.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                        Ámbitos con mayor fricción / fallos:
                      </p>
                      <ul className="space-y-2">
                        {failureAnalysis.map((item) => (
                          <li
                            key={item.name}
                            className="flex items-center justify-between gap-3 rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs"
                          >
                            <span className="flex items-center gap-2 font-medium text-ink">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                                aria-hidden="true"
                              />
                              {item.name}
                            </span>
                            <span className="tabular-nums text-danger font-semibold">
                              {item.failed} fallo{item.failed > 1 ? 's' : ''} ({Math.round((item.failed / item.total) * 100)}% de sus bloques)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-center py-2 text-xs text-success font-medium">
                      ✨ Excelente rendimiento: Sin tareas fallidas en este período.
                    </p>
                  )}
                </Section>
              </>
            )}

            {/* Detección de Bloques Libres (solo vista Día) */}
            {period === 'day' ? (
              <Section
                icon={<Clock className="size-4 text-accent" aria-hidden="true" />}
                title={`Bloques libres${containsToday ? ' (hoy)' : ''}`}
                aside={<span className="text-xs text-ink-muted">Ventanas de 8:00 AM a 10:00 PM</span>}
              >
                {freeSlots.length === 0 ? (
                  <p className="py-3 text-center text-xs text-ink-muted">
                    Jornada completa: no se detectaron bloques libres de al menos {MIN_FREE_SLOT} min.
                  </p>
                ) : (
                  <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {freeSlots.map((slot) => (
                      <li
                        key={`${slot.startMinutes}-${slot.endMinutes}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-success/30 bg-success/5 px-3 py-2 text-xs"
                      >
                        <span className="flex items-center gap-2 text-ink">
                          <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                          <span className="font-semibold tabular-nums">
                            {minutesToHM(slot.startMinutes)} – {minutesToHM(slot.endMinutes)}
                          </span>
                        </span>
                        <span className="rounded-md bg-success/15 px-2 py-0.5 font-medium tabular-nums text-success">
                          {formatDuration(slot.duration)} libre
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

interface MetricCardProps {
  label: string
  icon: ReactNode
  value: ReactNode
  hint: ReactNode
  valueClassName?: string
  className?: string
}

function MetricCard({ label, icon, value, hint, valueClassName, className }: MetricCardProps) {
  return (
    <div className={clsx('min-w-0 rounded-2xl border border-glass-border bg-glass p-3.5', className)}>
      <div className="flex items-center justify-between gap-2 text-ink-muted">
        <span className="truncate text-xs font-medium">{label}</span>
        {icon}
      </div>
      <p
        className={clsx(
          'mt-2 truncate text-xl font-bold tracking-tight tabular-nums sm:text-2xl',
          valueClassName ?? 'text-ink',
        )}
      >
        {value}
      </p>
      <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div>
    </div>
  )
}

interface SectionProps {
  icon: ReactNode
  title: string
  aside?: ReactNode
  children: ReactNode
}

function Section({ icon, title, aside, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-glass-border bg-glass p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">{title}</h3>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}
