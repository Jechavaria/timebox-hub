import { MAGNET_MINUTES, MINUTES_PER_DAY, SNAP_MINUTES } from './constants.ts'
import { clamp, minutesToTime, snapMinutes, timeToMinutes } from './time.ts'
import type { ScheduleBlock } from '../types/domain.ts'

export type TimelinePlacement =
  | { ok: true; startMinutes: number; shifted: ScheduleBlock[] }
  | { ok: false; reason: 'outside-day' }

interface TimelineItem {
  id: string
  startMinutes: number
  durationMinutes: number
  block: ScheduleBlock | null
  isMoving: boolean
}

/** Ajusta a la rejilla, aplica imán a bordes y empuja bloques en cascada sin solapamientos. */
export function resolveStack(
  blocks: readonly ScheduleBlock[],
  proposedStartMinutes: number,
  durationMinutes: number,
  movingBlockId?: string,
): TimelinePlacement {
  if (
    !Number.isFinite(proposedStartMinutes) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > MINUTES_PER_DAY
  ) {
    return { ok: false, reason: 'outside-day' }
  }

  const maxStart = MINUTES_PER_DAY - durationMinutes
  let startMinutes = clamp(snapMinutes(proposedStartMinutes, SNAP_MINUTES), 0, maxStart)
  const timedBlocks = blocks
    .filter((block) => block.id !== movingBlockId && block.start_time !== null)
    .map((block) => ({ block, start: timeToMinutes(block.start_time!) }))

  let magnet: { start: number; distance: number } | null = null
  for (const { block, start } of timedBlocks) {
    const candidates = [start, start + block.planned_duration_minutes - durationMinutes]
    for (const candidate of candidates) {
      if (candidate < 0 || candidate > maxStart) continue
      const distance = Math.abs(candidate - startMinutes)
      if (distance <= MAGNET_MINUTES && (!magnet || distance < magnet.distance)) {
        magnet = { start: candidate, distance }
      }
    }
  }
  if (magnet) startMinutes = magnet.start

  const movingItem: TimelineItem = {
    id: movingBlockId ?? '__new-block__',
    startMinutes,
    durationMinutes,
    block: null,
    isMoving: true,
  }
  const items: TimelineItem[] = [
    ...timedBlocks.map(({ block, start }) => ({
      id: block.id,
      startMinutes: start,
      durationMinutes: block.planned_duration_minutes,
      block,
      isMoving: false,
    })),
    movingItem,
  ].sort((a, b) => a.startMinutes - b.startMinutes || Number(b.isMoving) - Number(a.isMoving) || a.id.localeCompare(b.id))

  let cursor = 0
  let resolvedStart = startMinutes
  const shifted: ScheduleBlock[] = []

  for (const item of items) {
    const nextStart = Math.max(item.startMinutes, cursor)
    if (nextStart + item.durationMinutes > MINUTES_PER_DAY) {
      return { ok: false, reason: 'outside-day' }
    }
    if (item.isMoving) {
      resolvedStart = nextStart
    } else if (nextStart !== item.startMinutes && item.block) {
      shifted.push({ ...item.block, start_time: minutesToTime(nextStart) })
    }
    cursor = nextStart + item.durationMinutes
  }

  return { ok: true, startMinutes: resolvedStart, shifted }
}
