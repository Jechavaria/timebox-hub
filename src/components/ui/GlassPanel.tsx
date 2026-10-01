import clsx from 'clsx'
import type { ComponentPropsWithRef, ElementType } from 'react'

type PanelElement = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'nav' | 'main'
type PanelVariant = 'panel' | 'popover'
type PanelPadding = 'none' | 'sm' | 'md' | 'lg'

interface GlassPanelProps extends ComponentPropsWithRef<'div'> {
  as?: PanelElement
  variant?: PanelVariant
  padding?: PanelPadding
}

const VARIANT_CLASS: Record<PanelVariant, string> = {
  panel: 'glass-panel',
  popover: 'glass-popover',
}

const PADDING_CLASS: Record<PanelPadding, string | undefined> = {
  none: undefined,
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}

export function GlassPanel({
  as = 'div',
  variant = 'panel',
  padding = 'none',
  className,
  ...props
}: GlassPanelProps) {
  const Component: ElementType = as
  return (
    <Component
      className={clsx(VARIANT_CLASS[variant], PADDING_CLASS[padding], className)}
      {...props}
    />
  )
}
