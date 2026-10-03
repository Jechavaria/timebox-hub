import clsx from 'clsx'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Spinner } from './Spinner.tsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

const BASE_CLASS =
  'inline-flex select-none touch-manipulation items-center justify-center rounded-2xl font-medium transition-[background-color,border-color,filter,scale,opacity] duration-200 ease-out-soft active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-white hover:brightness-110',
  secondary: 'border border-glass-border bg-glass-strong text-ink hover:border-accent/40',
  ghost: 'text-ink-muted hover:bg-glass-strong hover:text-ink',
  danger: 'border border-danger/40 bg-danger/15 text-danger hover:bg-danger/25 [--glow-color:var(--color-danger)]',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-9 gap-1.5 px-3 text-sm',
  md: 'min-h-11 gap-2 px-4 text-sm',
  lg: 'min-h-12 gap-2.5 px-5 text-base',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  type = 'button',
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        BASE_CLASS,
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" decorative className="text-current" /> : leadingIcon}
      {children}
      {trailingIcon}
    </button>
  )
}
