import { createContext } from 'react'
import type { BackgroundOption, ThemeMode } from '../lib/appearance.ts'

export type AppearanceResult<T> = { ok: true; data: T } | { ok: false; message: string }

export interface AppearanceContextValue {
  theme: ThemeMode
  toggleTheme: () => void
  builtinBackgrounds: readonly BackgroundOption[]
  presetBackgrounds: readonly BackgroundOption[]
  customBackgrounds: readonly BackgroundOption[]
  activeBackground: BackgroundOption
  selectBackground: (id: string) => void
  dim: number
  setDim: (dim: number) => void
  adaptColors: boolean
  setAdaptColors: (adapt: boolean) => void
  addCustomBackground: (file: File) => Promise<AppearanceResult<BackgroundOption>>
  removeCustomBackground: (id: string) => Promise<AppearanceResult<string>>
  /** true mientras se calcula el color de acento de un fondo. */
  isAnalyzing: boolean
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null)
