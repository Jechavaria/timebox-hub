import clsx from 'clsx'
import type { Area } from '../../types/domain.ts'

interface AreaFilterBarProps {
  areas: Area[]
  onToggle: (area: Area) => void
  disabled?: boolean
}

export function AreaFilterBar({ areas, onToggle, disabled = false }: AreaFilterBarProps) {
  if (areas.length === 0) return null

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto px-3 py-1.5 sm:px-5" aria-label="Visibilidad de ámbitos">
      <span className="shrink-0 text-xs font-medium text-ink-faint">Ámbitos</span>
      <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label="Mostrar u ocultar columnas">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            aria-pressed={!area.is_hidden}
            aria-label={`${area.is_hidden ? 'Mostrar' : 'Ocultar'} ${area.name}`}
            title={`${area.is_hidden ? 'Mostrar' : 'Ocultar'} ${area.name}`}
            disabled={disabled}
            onClick={() => onToggle(area)}
            className={clsx(
              'inline-flex min-h-9 shrink-0 touch-manipulation items-center gap-2 rounded-full border px-3 text-xs font-medium transition-[background-color,border-color,opacity] duration-200',
              area.is_hidden
                ? 'border-glass-border bg-transparent text-ink-faint opacity-60'
                : 'border-glass-border bg-glass-strong text-ink',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: area.color }} />
            <span className="max-w-28 truncate">{area.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
