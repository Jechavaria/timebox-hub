import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  PieChart,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useNow } from '../../hooks/useNow.ts'
import { formatDuration, minutesToHM, timeToMinutes, toLocalDateString } from '../../lib/time.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'

interface AnalyticsModalProps {
  open: boolean
  onClose: () => void
}

type Period = 'today' | 'week'

export function AnalyticsModal({ open, onClose }: AnalyticsModalProps) {
  const { areas, schedule } = usePlanner()
  const now = useNow({ intervalMs: 60_000 })
  const today = toLocalDateString(now)
  const [period, setPeriod] = useState<Period>('today')

  const areasById = useMemo(() => new Map(areas.areas.map((a) => [a.id, a])), [areas.areas])

  // Filtrar bloques según el período seleccionado
  const filteredBlocks = useMemo(() => {
    if (period === 'today') {
      return schedule.blocks.filter((b) => b.scheduled_date === today)
    }
    return schedule.blocks
  }, [schedule.blocks, period, today])

  // 1. Métricas de resumen general y completitud
  const summary = useMemo(() => {
    const totalBlocks = filteredBlocks.length
    const completedBlocks = filteredBlocks.filter((b) => b.is_completed)
    const completionRate = totalBlocks > 0 ? Math.round((completedBlocks.length / totalBlocks) * 100) : 0

    let plannedTotalMinutes = 0
    let actualCompletedMinutes = 0
    let plannedForCompletedMinutes = 0

    for (const b of filteredBlocks) {
      plannedTotalMinutes += b.planned_duration_minutes
      if (b.is_completed) {
        plannedForCompletedMinutes += b.planned_duration_minutes
        actualCompletedMinutes += b.actual_duration_minutes ?? b.planned_duration_minutes
      }
    }

    const discrepancy = actualCompletedMinutes - plannedForCompletedMinutes

    return {
      totalBlocks,
      completedCount: completedBlocks.length,
      completionRate,
      plannedTotalMinutes,
      actualCompletedMinutes,
      discrepancy,
    }
  }, [filteredBlocks])

  // 2. Distribución de tiempo por Ámbito
  const areaDistribution = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; minutes: number }>()

    for (const b of filteredBlocks) {
      const area = b.area_id ? areasById.get(b.area_id) : null
      const key = area ? area.id : '__no_area__'
      const name = area ? area.name : 'Rutinas / General'
      const color = area ? area.color : '#8a909c'
      const current = totals.get(key) ?? { name, color, minutes: 0 }
      current.minutes += b.planned_duration_minutes
      totals.set(key, current)
    }

    const list = Array.from(totals.values()).sort((a, b) => b.minutes - a.minutes)
    const totalMins = list.reduce((acc, curr) => acc + curr.minutes, 0)

    return list.map((item) => ({
      ...item,
      percentage: totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0,
    }))
  }, [filteredBlocks, areasById])

  // 3. Cálculo de horas pico de actividad (distribución por horas del día 06:00 a 23:00)
  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: 18 }, (_, i) => {
      const h = i + 6
      const h12 = h % 12 === 0 ? 12 : h % 12
      const ampm = h >= 12 ? 'PM' : 'AM'
      return {
        hour: h,
        label: `${h12}:00 ${ampm}`,
        shortLabel: `${h12}${ampm.toLowerCase()}`,
        minutes: 0,
      }
    })

    for (const b of filteredBlocks) {
      if (!b.start_time) continue
      const startMin = timeToMinutes(b.start_time)
      const endMin = startMin + b.planned_duration_minutes

      for (const h of hours) {
        const slotStart = h.hour * 60
        const slotEnd = slotStart + 60
        const overlapStart = Math.max(startMin, slotStart)
        const overlapEnd = Math.min(endMin, slotEnd)
        if (overlapEnd > overlapStart) {
          h.minutes += overlapEnd - overlapStart
        }
      }
    }

    let peakHour = hours[0]
    for (const h of hours) {
      if (h.minutes > peakHour.minutes) {
        peakHour = h
      }
    }

    const maxMinutes = Math.max(...hours.map((h) => h.minutes), 1)

    return { hours, peakHour, maxMinutes }
  }, [filteredBlocks])

  // 4. Detección de bloques libres (ventanas de tiempo libre para hoy entre 08:00 y 22:00)
  const freeSlots = useMemo(() => {
    const todayBlocks = schedule.blocks
      .filter((b) => b.scheduled_date === today && b.start_time !== null)
      .map((b) => ({
        start: timeToMinutes(b.start_time!),
        end: timeToMinutes(b.start_time!) + b.planned_duration_minutes,
        title: b.title,
      }))
      .sort((a, b) => a.start - b.start)

    const dayStart = 8 * 60 // 08:00
    const dayEnd = 22 * 60 // 22:00
    const slots: { startMinutes: number; endMinutes: number; duration: number }[] = []

    let cursor = dayStart
    for (const b of todayBlocks) {
      if (b.start > cursor) {
        const gap = b.start - cursor
        if (gap >= 15) {
          slots.push({ startMinutes: cursor, endMinutes: b.start, duration: gap })
        }
      }
      cursor = Math.max(cursor, b.end)
    }

    if (dayEnd > cursor) {
      const gap = dayEnd - cursor
      if (gap >= 15) {
        slots.push({ startMinutes: cursor, endMinutes: dayEnd, duration: gap })
      }
    }

    return slots
  }, [schedule.blocks, today])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dashboard Analítico de Tiempo"
      description="Métricas de rendimiento, distribución de ámbitos y horas pico (RF-E2)."
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Selector de Período */}
        <div className="flex items-center justify-between border-b border-glass-border pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent">
              <BarChart3 className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Rango de análisis
            </span>
          </div>
          <div className="flex rounded-xl border border-glass-border bg-glass p-0.5">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={clsx(
                'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                period === 'today'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              Hoy ({today})
            </button>
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={clsx(
                'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                period === 'week'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              Semana (7 días)
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas Clave */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-glass-border bg-glass p-3.5">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-xs font-medium">Bloques</span>
              <CheckCircle2 className="size-4 text-accent" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {summary.completedCount} <span className="text-xs font-normal text-ink-muted">/ {summary.totalBlocks}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {summary.completionRate}% completados
            </p>
          </div>

          <div className="rounded-2xl border border-glass-border bg-glass p-3.5">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-xs font-medium">Planificado</span>
              <Clock className="size-4 text-ink-muted" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {formatDuration(summary.plannedTotalMinutes)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">Carga asignada</p>
          </div>

          <div className="rounded-2xl border border-glass-border bg-glass p-3.5">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-xs font-medium">Tiempo Real</span>
              <Sparkles className="size-4 text-success" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-success sm:text-2xl">
              {formatDuration(summary.actualCompletedMinutes)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">Ejecutado comprobado</p>
          </div>

          <div className="rounded-2xl border border-glass-border bg-glass p-3.5">
            <div className="flex items-center justify-between text-ink-muted">
              <span className="text-xs font-medium">Discrepancia</span>
              {summary.discrepancy > 0 ? (
                <TrendingUp className="size-4 text-warning" />
              ) : summary.discrepancy < 0 ? (
                <TrendingDown className="size-4 text-accent" />
              ) : (
                <CheckCircle2 className="size-4 text-success" />
              )}
            </div>
            <p
              className={clsx(
                'mt-2 text-xl font-bold tracking-tight sm:text-2xl',
                summary.discrepancy > 0
                  ? 'text-warning'
                  : summary.discrepancy < 0
                    ? 'text-accent'
                    : 'text-success',
              )}
            >
              {summary.discrepancy === 0
                ? '0m'
                : `${summary.discrepancy > 0 ? '+' : ''}${formatDuration(summary.discrepancy)}`}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {summary.discrepancy === 0
                ? 'Estimación exacta'
                : summary.discrepancy > 0
                  ? 'Más de lo planeado'
                  : 'Ahorro de tiempo'}
            </p>
          </div>
        </div>

        {/* Sección: Distribución de Tiempo por Ámbito */}
        <div className="rounded-2xl border border-glass-border bg-glass p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChart className="size-4 text-accent" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                Distribución por Ámbito
              </h3>
            </div>
            <span className="text-xs text-ink-muted">
              Total: {formatDuration(summary.plannedTotalMinutes)}
            </span>
          </div>

          {areaDistribution.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-muted">
              No hay bloques programados para este período.
            </p>
          ) : (
            <div className="space-y-3">
              {areaDistribution.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </span>
                    <span className="tabular-nums text-ink-muted">
                      {formatDuration(item.minutes)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sección: Horas Pico de Actividad */}
        <div className="rounded-2xl border border-glass-border bg-glass p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-warning" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                Horas Pico de Actividad
              </h3>
            </div>
            {hourlyActivity.peakHour.minutes > 0 ? (
              <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                Pico: {hourlyActivity.peakHour.label} ({formatDuration(hourlyActivity.peakHour.minutes)})
              </span>
            ) : null}
          </div>

          <p className="mb-3 text-xs text-ink-muted">
            Densidad de minutos programados por hora (de 6:00 AM a 11:00 PM):
          </p>

          <div className="flex h-20 items-end gap-1 overflow-x-auto pt-2">
            {hourlyActivity.hours.map((h) => {
              const heightPct = hourlyActivity.maxMinutes > 0
                ? Math.round((h.minutes / hourlyActivity.maxMinutes) * 100)
                : 0
              const isPeak = h.hour === hourlyActivity.peakHour.hour && h.minutes > 0
              return (
                <div
                  key={h.hour}
                  className="flex flex-1 min-w-[20px] flex-col items-center gap-1"
                  title={`${h.label}: ${formatDuration(h.minutes)} ocupados`}
                >
                  <div className="h-12 w-full flex items-end justify-center rounded-sm bg-white/4">
                    <div
                      className={clsx(
                        'w-full rounded-sm transition-all duration-200',
                        isPeak ? 'bg-warning shadow-[0_0_8px_rgb(246_196_83_/_0.5)]' : 'bg-accent/60',
                      )}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-ink-faint">
                    {h.shortLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sección: Detección Visual de Bloques Libres */}
        <div className="rounded-2xl border border-glass-border bg-glass p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-accent" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                Bloques Libres Detectados (Hoy)
              </h3>
            </div>
            <span className="text-xs text-ink-muted">
              Ventanas de 8:00 AM a 10:00 PM
            </span>
          </div>

          {freeSlots.length === 0 ? (
            <p className="py-3 text-center text-xs text-ink-muted">
              Jornada completa o sin bloques libres detectados en el día activo.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {freeSlots.map((slot) => (
                <div
                  key={`${slot.startMinutes}-${slot.endMinutes}`}
                  className="flex items-center justify-between rounded-xl border border-dashed border-success/30 bg-success/5 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 text-ink">
                    <span className="size-2 rounded-full bg-success" />
                    <span className="font-semibold">
                      {minutesToHM(slot.startMinutes)} – {minutesToHM(slot.endMinutes)}
                    </span>
                  </div>
                  <span className="rounded-md bg-success/15 px-2 py-0.5 font-medium tabular-nums text-success">
                    {formatDuration(slot.duration)} libre
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
