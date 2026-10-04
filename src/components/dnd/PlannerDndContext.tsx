import { useMemo, useState } from 'react'
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { Clock3, GripVertical, LayoutGrid } from 'lucide-react'
import { PX_PER_MINUTE } from '../../lib/constants.ts'
import { clamp, minutesToHM, snapMinutes } from '../../lib/time.ts'
import { usePlanner } from '../../hooks/usePlanner.ts'
import { useToast } from '../../hooks/useToast.ts'
import type {
  DndData,
  DayTimelineDropData,
  DayUntimedDropData,
  MasterTaskDragData,
  ScheduleBlockDragData,
} from '../../types/domain.ts'

interface PlannerDndContextProps {
  children: ReactNode
}

function getData(value: unknown): DndData | null {
  if (typeof value !== 'object' || value === null || !('type' in value)) return null
  const type = value.type
  if (
    type === 'area' ||
    type === 'master-task' ||
    type === 'schedule-block' ||
    type === 'day-timeline' ||
    type === 'day-untimed'
  ) {
    return value as DndData
  }
  return null
}

const plannerCollision: CollisionDetection = (args) => {
  const active = getData(args.active.data.current)
  if (!active) return closestCenter(args)

  const targets = args.droppableContainers.filter((container) => {
    const target = getData(container.data.current)
    if (!target) return false
    if (active.type === 'area') return target.type === 'area'
    if (active.type === 'master-task') {
      return (
        (target.type === 'master-task' && target.areaId === active.areaId) ||
        target.type === 'day-timeline' ||
        target.type === 'day-untimed'
      )
    }
    if (active.type === 'schedule-block') {
      return target.type === 'day-timeline' || target.type === 'day-untimed'
    }
    return false
  })

  const filteredArgs = { ...args, droppableContainers: targets }
  if (active.type === 'master-task' || active.type === 'schedule-block') {
    const dayTargets = targets.filter((container) => {
      const target = getData(container.data.current)
      return target?.type === 'day-timeline' || target?.type === 'day-untimed'
    })
    const pointerHits = pointerWithin({ ...args, droppableContainers: dayTargets })
    if (pointerHits.length > 0) return pointerHits
    const geometricHits = rectIntersection({ ...args, droppableContainers: dayTargets })
    if (geometricHits.length > 0) return geometricHits
  }
  return closestCenter(filteredArgs)
}

function describeActive(data: DndData | null, titleById: ReadonlyMap<string, string>): string {
  if (!data) return ''
  if (data.type === 'area') return titleById.get(data.areaId) ?? ''
  if (data.type === 'master-task') return titleById.get(data.taskId) ?? ''
  if (data.type === 'schedule-block') return titleById.get(data.blockId) ?? ''
  return ''
}

type DragGeometryEvent = Pick<DragEndEvent, 'active' | 'delta'>

/**
 * Calcula la hora de inicio a partir de la posición real en pantalla de la tarjeta arrastrada.
 * Usa el rectángulo trasladado (ya incluye el auto-scroll de los contenedores), así la hora
 * coincide con lo que el usuario ve aunque la línea de tiempo se haya desplazado durante el arrastre.
 */
function getDropStartMinutes(event: DragGeometryEvent, date: string, _durationMinutes?: number): number {
  const board = Array.from(document.querySelectorAll<HTMLElement>('[data-timeline-date]')).find(
    (element) => element.dataset.timelineDate === date,
  )
  const translatedTop = event.active.rect.current.translated?.top
  const initialTop = event.active.rect.current.initial?.top
  const dropTop = translatedTop ?? (initialTop !== undefined ? initialTop + event.delta.y : undefined)
  if (!board || dropTop === undefined) return 9 * 60

  const rawMinutes = (dropTop - board.getBoundingClientRect().top) / PX_PER_MINUTE
  // Permite soltar hasta las 23:45 (1425 min) sin forzar bloques largos a terminar antes de medianoche
  return clamp(snapMinutes(rawMinutes), 0, 1425)
}

export function PlannerDndContext({ children }: PlannerDndContextProps) {
  const planner = usePlanner()
  const toast = useToast()
  const [activeData, setActiveData] = useState<DndData | null>(null)
  const [previewLabel, setPreviewLabel] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor),
  )

  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const area of planner.areas.areas) map.set(area.id, area.name)
    for (const task of planner.tasks.tasks) map.set(task.id, task.title)
    for (const block of planner.schedule.blocks) map.set(block.id, block.title)
    return map
  }, [planner.areas.areas, planner.schedule.blocks, planner.tasks.tasks])

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveData(getData(active.data.current))
    setPreviewLabel(null)
  }

  /** Muestra en la tarjeta flotante la hora exacta (o "Sin hora") donde quedará al soltar. */
  const handleDragMove = (event: DragMoveEvent) => {
    const source = getData(event.active.data.current)
    const target = event.over ? getData(event.over.data.current) : null
    let next: string | null = null
    if (source && (source.type === 'master-task' || source.type === 'schedule-block') && target) {
      if (target.type === 'day-untimed') next = 'Sin hora'
      else if (target.type === 'day-timeline') {
        next = minutesToHM(getDropStartMinutes(event, target.date, source.durationMinutes))
      }
    }
    setPreviewLabel((current) => (current === next ? current : next))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveData(null)
    setPreviewLabel(null)
    if (!event.over) return
    const source = getData(event.active.data.current)
    const target = getData(event.over.data.current)
    if (!source || !target) return

    if (source.type === 'area' && target.type === 'area') {
      if (source.areaId === target.areaId) return
      const visibleAreas = planner.areas.areas.filter((area) => !area.is_hidden)
      const oldIndex = visibleAreas.findIndex((area) => area.id === source.areaId)
      const newIndex = visibleAreas.findIndex((area) => area.id === target.areaId)
      if (oldIndex < 0 || newIndex < 0) return
      const reorderedVisible = arrayMove(visibleAreas, oldIndex, newIndex)
      let visibleIndex = 0
      const fullOrder = planner.areas.areas.map((area) =>
        area.is_hidden ? area.id : reorderedVisible[visibleIndex++].id,
      )
      const result = await planner.areas.reorderAreas(fullOrder)
      if (!result.ok) toast.error(result.message, 'No se pudo reordenar')
      return
    }

    if (source.type === 'master-task' && target.type === 'master-task') {
      if (source.areaId !== target.areaId || source.taskId === target.taskId) return
      const group = planner.tasks.tasks.filter((task) => task.area_id === source.areaId)
      const oldIndex = group.findIndex((task) => task.id === source.taskId)
      const newIndex = group.findIndex((task) => task.id === target.taskId)
      if (oldIndex < 0 || newIndex < 0) return
      const orderedIds = arrayMove(group, oldIndex, newIndex).map((task) => task.id)
      const result = await planner.tasks.reorderTasks(source.areaId, orderedIds)
      if (!result.ok) toast.error(result.message, 'No se pudo reordenar')
      return
    }

    if (source.type === 'master-task' && (target.type === 'day-timeline' || target.type === 'day-untimed')) {
      await cloneMasterTask(source, target, event)
      return
    }

    if (source.type === 'schedule-block' && (target.type === 'day-timeline' || target.type === 'day-untimed')) {
      await moveScheduleBlock(source, target, event)
    }
  }

  const cloneMasterTask = async (
    source: MasterTaskDragData,
    target: DayTimelineDropData | DayUntimedDropData,
    event: DragEndEvent,
  ) => {
    const task = planner.tasks.tasks.find((candidate) => candidate.id === source.taskId)
    if (!task) {
      toast.error('La tarea ya no está disponible.', 'No se pudo planificar')
      return
    }
    const startMinutes = target.type === 'day-untimed'
      ? null
      : getDropStartMinutes(event, target.date, source.durationMinutes)
    if (task.is_completed) {
      void planner.tasks.updateTask(task.id, { is_completed: false })
    }
    const result = await planner.schedule.cloneTaskToBlock(task, target.date, startMinutes)
    if (!result.ok) {
      toast.error(result.message, 'No se pudo añadir a la planificación diaria')
      return
    }
    toast.success(
      startMinutes === null
        ? `“${task.title}” se añadió a Sin hora.`
        : `“${task.title}” se planificó para ${target.date}.`,
    )
  }

  const moveScheduleBlock = async (
    source: ScheduleBlockDragData,
    target: DayTimelineDropData | DayUntimedDropData,
    event: DragEndEvent,
  ) => {
    const startMinutes = target.type === 'day-untimed'
      ? null
      : getDropStartMinutes(event, target.date, source.durationMinutes)
    const currentBlock = planner.schedule.blocks.find((b) => b.id === source.blockId)
    const isChangingDate = currentBlock && currentBlock.scheduled_date !== target.date

    const result = await planner.schedule.moveBlock(source.blockId, target.date, startMinutes)
    if (!result.ok) {
      toast.error(result.message, 'No se pudo reprogramar')
      return
    }
    if (isChangingDate) {
      toast.success(
        startMinutes === null
          ? `Tarea movida al ${target.date}.`
          : `Tarea reprogramada para el ${target.date} a las ${minutesToHM(startMinutes)}.`,
      )
    } else {
      toast.success(startMinutes === null ? 'El bloque volvió a Sin hora.' : 'Bloque reprogramado.')
    }
  }

  const activeLabel = describeActive(activeData, titleById)
  const activeIcon = activeData?.type === 'area'
    ? <LayoutGrid aria-hidden="true" className="size-4 shrink-0 text-accent" />
    : <GripVertical aria-hidden="true" className="size-4 shrink-0 text-accent" />

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={plannerCollision}
      autoScroll={{
        threshold: { x: 0.05, y: 0.07 },
        acceleration: 2.2,
        interval: 14,
      }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragCancel={() => {
        setActiveData(null)
        setPreviewLabel(null)
      }}
      onDragEnd={(event) => { void handleDragEnd(event) }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeData ? (
          <div className="glass-popover pointer-events-none z-50 flex w-64 max-w-[18rem] items-center justify-between gap-2 rounded-xl border border-accent/40 bg-surface/95 px-3 py-2 text-sm font-semibold text-ink shadow-2xl backdrop-blur-xl">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {activeIcon}
              <span className="truncate">{activeLabel}</span>
            </div>
            {previewLabel ? (
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-accent/20 px-1.5 py-0.5 text-xs font-bold text-accent tabular-nums">
                <Clock3 className="size-3" />
                {previewLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
