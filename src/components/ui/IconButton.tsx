import clsx from 'clsx'
import type { ComponentPropsWithRef } from 'react'

type IconButtonVariant = 'ghost' | 'glass' | 'danger'
type IconButtonSize = 'sm' | 'md'

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** Nombre accesible; también se muestra como tooltip nativo. */
  label: string
  variant?: IconButtonVariant
  size?: IconButtonSize
}

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  ghost: 'text-ink-muted hover:bg-glass-strong hover:text-ink',
  glass: 'border border-glass-border bg-glass-strong text-ink hover:border-accent/40',
  danger: 'text-danger hover:bg-danger/15 [--glow-color:var(--color-danger)]',
}

const SIZE_CLASS: Record<IconButtonSize, string> = {
  sm: 'size-9 [&_svg]:size-4',
  md: 'size-11 [&_svg]:size-5',
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className,
  children,
  ...props
}: IconButtonProps) {
  const isDragHandle = Boolean(className?.includes('cursor-grab') || className?.includes('touch-none'))

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-xl transition-[background-color,border-color,color,scale,opacity] duration-150 ease-out-soft disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        !isDragHandle && 'touch-manipulation active:scale-90',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
