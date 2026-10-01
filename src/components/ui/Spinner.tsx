import clsx from 'clsx'

type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  /** Texto accesible; se ignora si el spinner es decorativo. */
  label?: string
  /** Úsalo cuando ya hay un texto visible que describe la espera. */
  decorative?: boolean
  className?: string
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-10',
}

export function Spinner({
  size = 'md',
  label = 'Cargando',
  decorative = false,
  className,
}: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={clsx('animate-spin text-accent', SIZE_CLASS[size], className)}
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
