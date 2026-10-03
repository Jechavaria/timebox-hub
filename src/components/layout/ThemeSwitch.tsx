import clsx from 'clsx'
import { Moon, Sun } from 'lucide-react'
import { useAppearance } from '../../hooks/useAppearance.ts'

export function ThemeSwitch() {
  const { theme, toggleTheme } = useAppearance()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Modo oscuro"
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={toggleTheme}
      className="relative inline-flex h-9 w-16 shrink-0 touch-manipulation items-center rounded-full border border-glass-border bg-glass-strong p-1"
    >
      <Sun aria-hidden="true" className={clsx('absolute left-2 size-3.5', isDark ? 'text-ink-faint' : 'text-warning')} />
      <Moon aria-hidden="true" className={clsx('absolute right-2 size-3.5', isDark ? 'text-accent' : 'text-ink-faint')} />
      <span
        aria-hidden="true"
        className={clsx(
          'relative z-10 grid size-7 place-items-center rounded-full bg-accent-strong text-white shadow-md transition-transform duration-300 ease-spring',
          isDark ? 'translate-x-7' : 'translate-x-0',
        )}
      >
        {isDark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </span>
    </button>
  )
}
