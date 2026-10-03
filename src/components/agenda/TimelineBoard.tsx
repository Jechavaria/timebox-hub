import type { Ref } from 'react'
import { PX_PER_MINUTE } from '../../lib/constants.ts'
import type { Area, ScheduleBlock } from '../../types/domain.ts'
import { HourGutter } from './HourGutter.tsx'
import { NowNeedle } from './NowNeedle.tsx'
import { ScheduleBlockCard } from './ScheduleBlockCard.tsx'

const HOURS_PER_DAY = 24
const HOUR_HEIGHT_PX = 60 * PX_PER_MINUTE

interface TimelineBoardProps {
  date: string
  blocks: ScheduleBlock[]
  areasById: ReadonlyMap<string, Area>
  now: Date
  isToday: boolean
  boardRef: Ref<HTMLDivElement>
  onDelete: (blockId: string) => void
  onOpen: (block: ScheduleBlock) => void
  onToggleComplete: (block: ScheduleBlock) => void
  onResizeDuration?: (blockId: string, durationMinutes: number) => void
}

export function TimelineBoard({
  date,
  blocks,
  areasById,
  now,
  isToday,
  boardRef,
  onDelete,
  onOpen,
  onToggleComplete,
  onResizeDuration,
}: TimelineBoardProps) {
  const timedBlocks = blocks.filter((block) => block.start_time !== null)

  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start">
      <HourGutter />
      <div
        ref={boardRef}
        data-timeline-date={date}
        className="relative isolate overflow-visible border-b border-glass-border/40"
        style={{
          height: `${HOURS_PER_DAY * HOUR_HEIGHT_PX}px`,
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.035) 0, rgb(255 255 255 / 0.035) 1px, transparent 1px, transparent 15px), repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.075) 0, rgb(255 255 255 / 0.075) 1px, transparent 1px, transparent 60px)',
        }}
      >
        <NowNeedle date={date} now={now} visible={isToday} />
        {timedBlocks.map((block) => (
          <ScheduleBlockCard
            key={block.id}
            block={block}
            area={block.area_id ? areasById.get(block.area_id) : undefined}
            onDelete={onDelete}
            onOpen={onOpen}
            onToggleComplete={onToggleComplete}
            onResizeDuration={onResizeDuration}
          />
        ))}
      </div>
    </div>
  )
}
