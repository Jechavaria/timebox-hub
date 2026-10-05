import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { AppearanceContext } from './appearance-context.ts'
import type { AppearanceContextValue, AppearanceResult } from './appearance-context.ts'
import {
  BUILTIN_BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_DIM_DARK,
  DEFAULT_DIM_LIGHT,
  DEFAULT_TONE,
  MAX_CUSTOM_BACKGROUND_BYTES,
  MAX_DIM,
  PRESET_BACKGROUNDS,
  extractTone,
  getCachedTone,
  loadPrefs,
  removeCachedTone,
  savePrefs,
  setCachedTone,
} from '../lib/appearance.ts'
import type { AccentTone, AppearancePrefs, BackgroundOption, ThemeMode } from '../lib/appearance.ts'
import { deleteStoredBackground, listStoredBackgrounds, putStoredBackground } from '../lib/backgroundStore.ts'
import type { StoredBackground } from '../lib/backgroundStore.ts'
import { createUuid } from '../lib/ids.ts'
import { usePointerLight } from '../hooks/usePointerLight.ts'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
const ACCEPTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm'])

function subscribeSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSystemTheme(): ThemeMode {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function toOption(row: StoredBackground, src: string): BackgroundOption {
  return { id: row.id, name: row.name, kind: row.kind, source: 'custom', src }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  usePointerLight()

  const [prefs, setPrefs] = useState<AppearancePrefs>(loadPrefs)
  const [customBackgrounds, setCustomBackgrounds] = useState<BackgroundOption[]>([])
  const [toneById, setToneById] = useState<Record<string, AccentTone>>({})
  const [failedIds, setFailedIds] = useState<Record<string, true>>({})
  const objectUrls = useRef(new Map<string, string>())

  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => 'dark' as ThemeMode)
  const theme: ThemeMode = prefs.theme ?? systemTheme

  // Cargar fondos propios guardados en este dispositivo.
  useEffect(() => {
    let active = true
    const urls = objectUrls.current
    listStoredBackgrounds()
      .then((rows) => {
        if (!active) return
        const options = rows.map((row) => {
          const url = URL.createObjectURL(row.blob)
          urls.set(row.id, url)
          return toOption(row, url)
        })
        setCustomBackgrounds(options)
      })
      .catch(() => {
        // Sin IndexedDB (modo privado estricto): solo se ocultan los fondos propios.
      })
    return () => {
      active = false
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const activeBackground = useMemo<BackgroundOption>(() => {
    const all = [...BUILTIN_BACKGROUNDS, ...PRESET_BACKGROUNDS, ...customBackgrounds]
    return all.find((option) => option.id === prefs.backgroundId) ?? BUILTIN_BACKGROUNDS[0]
  }, [customBackgrounds, prefs.backgroundId])

  const knownTone = activeBackground.tone ?? toneById[activeBackground.id] ?? getCachedTone(activeBackground.id)
  const needsAnalysis =
    activeBackground.kind !== 'gradient' && prefs.adaptColors && !knownTone && !failedIds[activeBackground.id]

  const activeTone: AccentTone = useMemo(() => {
    if (activeBackground.tone) return activeBackground.tone
    if (!prefs.adaptColors) return DEFAULT_TONE
    return knownTone ?? prefs.accent
  }, [activeBackground.tone, knownTone, prefs.accent, prefs.adaptColors])

  // Calcular el color dominante de imágenes/videos la primera vez que se usan.
  useEffect(() => {
    if (!needsAnalysis || !activeBackground.src || activeBackground.kind === 'gradient') return
    let active = true
    const { id, src, kind } = activeBackground
    void extractTone(src, kind).then((tone) => {
      if (!active) return
      if (tone) {
        setCachedTone(id, tone)
        setToneById((current) => ({ ...current, [id]: tone }))
      } else {
        setFailedIds((current) => ({ ...current, [id]: true }))
      }
    })
    return () => {
      active = false
    }
  }, [activeBackground, needsAnalysis])

  const activeDim = theme === 'light'
    ? (prefs.dimLight ?? DEFAULT_DIM_LIGHT)
    : (prefs.dimDark ?? DEFAULT_DIM_DARK)

  // Aplicar tema, acento y atenuación al documento.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.hasVideo = activeBackground.kind === 'video' ? 'true' : 'false'
    root.style.setProperty('--accent-h', String(activeTone.h))
    root.style.setProperty('--accent-c', String(activeTone.c))
    root.style.setProperty('--bg-dim', String(activeDim))
    root.style.removeProperty('--light-color')
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b0d14' : '#eef1f7')
  }, [theme, activeTone.h, activeTone.c, activeDim, activeBackground.kind])

  // Persistir preferencias (incluido el último acento para el script anti-parpadeo).
  useEffect(() => {
    savePrefs({ ...prefs, accent: activeTone })
  }, [prefs, activeTone])

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    const apply = () => {
      flushSync(() => {
        setPrefs((current) => {
          const nextDim = next === 'light'
            ? (current.dimLight ?? DEFAULT_DIM_LIGHT)
            : (current.dimDark ?? DEFAULT_DIM_DARK)
          return {
            ...current,
            theme: next,
            dim: nextDim,
          }
        })
      })
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduceMotion && typeof document.startViewTransition === 'function') {
      document.startViewTransition(apply)
    } else {
      apply()
    }
  }, [theme])

  const selectBackground = useCallback((id: string) => {
    setPrefs((current) => ({ ...current, backgroundId: id }))
  }, [])

  const setDim = useCallback((dim: number) => {
    const clamped = Math.min(MAX_DIM, Math.max(0, dim))
    setPrefs((current) => {
      const isLight = (current.theme ?? systemTheme) === 'light'
      return {
        ...current,
        dim: clamped,
        dimLight: isLight ? clamped : (current.dimLight ?? DEFAULT_DIM_LIGHT),
        dimDark: !isLight ? clamped : (current.dimDark ?? DEFAULT_DIM_DARK),
      }
    })
  }, [systemTheme])

  const setAdaptColors = useCallback((adaptColors: boolean) => {
    setPrefs((current) => ({ ...current, adaptColors }))
  }, [])

  const addCustomBackground = useCallback(async (file: File): Promise<AppearanceResult<BackgroundOption>> => {
    const isImage = ACCEPTED_IMAGE_TYPES.has(file.type)
    const isVideo = ACCEPTED_VIDEO_TYPES.has(file.type)
    if (!isImage && !isVideo) {
      return { ok: false, message: 'Formato no compatible. Usa JPG, PNG, WEBP, AVIF, GIF, MP4 o WEBM.' }
    }
    if (file.size > MAX_CUSTOM_BACKGROUND_BYTES) {
      return { ok: false, message: 'El archivo supera el límite de 80 MB.' }
    }
    const row: StoredBackground = {
      id: `custom:${createUuid()}`,
      name: file.name.replace(/\.[^.]+$/, '') || 'Mi fondo',
      kind: isVideo ? 'video' : 'image',
      mimeType: file.type,
      size: file.size,
      blob: file,
      createdAt: Date.now(),
    }
    try {
      await putStoredBackground(row)
    } catch {
      return { ok: false, message: 'No se pudo guardar el fondo en este dispositivo (¿almacenamiento lleno?).' }
    }
    const url = URL.createObjectURL(file)
    objectUrls.current.set(row.id, url)
    const option = toOption(row, url)
    setCustomBackgrounds((current) => [...current, option])
    setPrefs((current) => ({ ...current, backgroundId: option.id }))
    return { ok: true, data: option }
  }, [])

  const removeCustomBackground = useCallback(async (id: string): Promise<AppearanceResult<string>> => {
    try {
      await deleteStoredBackground(id)
    } catch {
      return { ok: false, message: 'No se pudo eliminar el fondo.' }
    }
    const url = objectUrls.current.get(id)
    if (url) URL.revokeObjectURL(url)
    objectUrls.current.delete(id)
    removeCachedTone(id)
    setCustomBackgrounds((current) => current.filter((option) => option.id !== id))
    setPrefs((current) => (current.backgroundId === id ? { ...current, backgroundId: DEFAULT_BACKGROUND_ID } : current))
    return { ok: true, data: id }
  }, [])

  const value = useMemo<AppearanceContextValue>(
    () => ({
      theme,
      toggleTheme,
      builtinBackgrounds: BUILTIN_BACKGROUNDS,
      presetBackgrounds: PRESET_BACKGROUNDS,
      customBackgrounds,
      activeBackground,
      selectBackground,
      dim: activeDim,
      setDim,
      adaptColors: prefs.adaptColors,
      setAdaptColors,
      addCustomBackground,
      removeCustomBackground,
      isAnalyzing: needsAnalysis,
    }),
    [
      theme,
      toggleTheme,
      customBackgrounds,
      activeBackground,
      selectBackground,
      activeDim,
      setDim,
      prefs.adaptColors,
      setAdaptColors,
      addCustomBackground,
      removeCustomBackground,
      needsAnalysis,
    ],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}
