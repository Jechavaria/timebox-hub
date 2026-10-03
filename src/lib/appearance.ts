/**
 * Apariencia: tema claro/oscuro, fondos (degradados, plantillas y archivos propios)
 * y extracción del color de acento a partir de una imagen o video.
 */

export type ThemeMode = 'light' | 'dark'
export type BackgroundKind = 'gradient' | 'image' | 'video'
export type BackgroundSource = 'builtin' | 'preset' | 'custom'

export interface AccentTone {
  /** Tono OKLCH en grados (0-360). */
  h: number
  /** Croma OKLCH (0.02-0.18). */
  c: number
}

export interface BackgroundOption {
  id: string
  name: string
  kind: BackgroundKind
  source: BackgroundSource
  /** URL del archivo (solo image/video). */
  src?: string
  /** Tono fijo (degradados). Para imágenes/videos se calcula en tiempo de ejecución. */
  tone?: AccentTone
}

export interface AppearancePrefs {
  /** null = seguir la preferencia del sistema. */
  theme: ThemeMode | null
  backgroundId: string
  /** Atenuación del fondo multimedia, 0 a 0.85. */
  dim: number
  adaptColors: boolean
  /** Último acento aplicado; lo usa el script inline de index.html para evitar parpadeos. */
  accent: AccentTone
}

export const APPEARANCE_STORAGE_KEY = 'timebox_appearance'
const TONE_CACHE_KEY = 'timebox_bg_tone_cache'

export const DEFAULT_TONE: AccentTone = { h: 277, c: 0.14 }
export const MAX_DIM = 0.85
export const MAX_CUSTOM_BACKGROUND_BYTES = 80 * 1024 * 1024

export const BUILTIN_BACKGROUNDS: readonly BackgroundOption[] = [
  { id: 'builtin:aurora', name: 'Aurora índigo', kind: 'gradient', source: 'builtin', tone: { h: 277, c: 0.14 } },
  { id: 'builtin:ocean', name: 'Océano profundo', kind: 'gradient', source: 'builtin', tone: { h: 232, c: 0.13 } },
  { id: 'builtin:forest', name: 'Bosque nocturno', kind: 'gradient', source: 'builtin', tone: { h: 162, c: 0.11 } },
  { id: 'builtin:wine', name: 'Vino tinto', kind: 'gradient', source: 'builtin', tone: { h: 355, c: 0.13 } },
  { id: 'builtin:amber', name: 'Ámbar tenue', kind: 'gradient', source: 'builtin', tone: { h: 62, c: 0.12 } },
  { id: 'builtin:graphite', name: 'Grafito', kind: 'gradient', source: 'builtin', tone: { h: 255, c: 0.035 } },
]

export const DEFAULT_BACKGROUND_ID = BUILTIN_BACKGROUNDS[0].id

export const DEFAULT_PREFS: AppearancePrefs = {
  theme: null,
  backgroundId: DEFAULT_BACKGROUND_ID,
  dim: 0.45,
  adaptColors: true,
  accent: DEFAULT_TONE,
}

/*
 * Plantillas: cualquier imagen o video colocado en src/assets/backgrounds/ aparece
 * automáticamente en el selector (el nombre se toma del archivo).
 */
const presetModules = import.meta.glob('../assets/backgrounds/*.{jpg,jpeg,png,webp,avif,gif,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm'])

function prettifyFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Fondo'
}

export const PRESET_BACKGROUNDS: readonly BackgroundOption[] = Object.entries(presetModules)
  .map(([path, url]) => {
    const fileName = path.split('/').pop() ?? path
    const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
    return {
      id: `preset:${fileName}`,
      name: prettifyFileName(fileName),
      kind: VIDEO_EXTENSIONS.has(extension) ? 'video' : 'image',
      source: 'preset',
      src: url,
    } satisfies BackgroundOption
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))

export function isValidTone(value: unknown): value is AccentTone {
  if (!value || typeof value !== 'object') return false
  const tone = value as Record<string, unknown>
  return typeof tone.h === 'number' && typeof tone.c === 'number' && Number.isFinite(tone.h) && Number.isFinite(tone.c)
}

export function loadPrefs(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : null,
      backgroundId: typeof parsed.backgroundId === 'string' ? parsed.backgroundId : DEFAULT_BACKGROUND_ID,
      dim: typeof parsed.dim === 'number' ? Math.min(MAX_DIM, Math.max(0, parsed.dim)) : DEFAULT_PREFS.dim,
      adaptColors: typeof parsed.adaptColors === 'boolean' ? parsed.adaptColors : true,
      accent: isValidTone(parsed.accent) ? parsed.accent : DEFAULT_TONE,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: AppearancePrefs): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Almacenamiento lleno o bloqueado: la preferencia solo dura esta sesión.
  }
}

function loadToneCache(): Record<string, AccentTone> {
  try {
    const raw = localStorage.getItem(TONE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, AccentTone>) : {}
  } catch {
    return {}
  }
}

export function getCachedTone(id: string): AccentTone | null {
  const tone = loadToneCache()[id]
  return isValidTone(tone) ? tone : null
}

export function setCachedTone(id: string, tone: AccentTone): void {
  try {
    const cache = loadToneCache()
    cache[id] = tone
    localStorage.setItem(TONE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignorar: solo es una caché.
  }
}

export function removeCachedTone(id: string): void {
  try {
    const cache = loadToneCache()
    delete cache[id]
    localStorage.setItem(TONE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignorar.
  }
}

/* ---------- Extracción de color ---------- */

function srgbToLinear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** Convierte sRGB (0-255) a OKLCH. */
export function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.sqrt(A * A + B * B)
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

const SAMPLE_SIZE = 64
const HUE_BINS = 36

/** Analiza los píxeles y devuelve el tono dominante más vívido. */
function toneFromPixels(data: Uint8ClampedArray): AccentTone {
  const binWeight = new Float64Array(HUE_BINS)
  const binSin = new Float64Array(HUE_BINS)
  const binCos = new Float64Array(HUE_BINS)
  const binChroma = new Float64Array(HUE_BINS)
  let totalWeight = 0
  let pixelCount = 0

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 128) continue
    pixelCount += 1
    const { l, c, h } = rgbToOklch(data[index], data[index + 1], data[index + 2])
    if (l < 0.12 || l > 0.96 || c < 0.025) continue
    const weight = c * c * (1 - Math.abs(l - 0.6))
    const bin = Math.floor(h / (360 / HUE_BINS)) % HUE_BINS
    const radians = (h * Math.PI) / 180
    binWeight[bin] += weight
    binSin[bin] += Math.sin(radians) * weight
    binCos[bin] += Math.cos(radians) * weight
    binChroma[bin] += c * weight
    totalWeight += weight
  }

  if (pixelCount === 0 || totalWeight < pixelCount * 0.0004) {
    // Imagen casi monocromática: acento neutro y discreto.
    return { h: DEFAULT_TONE.h, c: 0.035 }
  }

  // Ventana de 3 bins con mayor peso.
  let bestBin = 0
  let bestScore = -1
  for (let bin = 0; bin < HUE_BINS; bin += 1) {
    const score =
      binWeight[(bin + HUE_BINS - 1) % HUE_BINS] + binWeight[bin] * 1.5 + binWeight[(bin + 1) % HUE_BINS]
    if (score > bestScore) {
      bestScore = score
      bestBin = bin
    }
  }

  let sin = 0
  let cos = 0
  let chroma = 0
  let weight = 0
  for (const offset of [-1, 0, 1]) {
    const bin = (bestBin + offset + HUE_BINS) % HUE_BINS
    sin += binSin[bin]
    cos += binCos[bin]
    chroma += binChroma[bin]
    weight += binWeight[bin]
  }

  const hue = ((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360
  const avgChroma = weight > 0 ? chroma / weight : DEFAULT_TONE.c
  return { h: Math.round(hue), c: Math.round(Math.min(0.17, Math.max(0.06, avgChroma * 0.9)) * 1000) / 1000 }
}

function drawToCanvas(source: CanvasImageSource): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D no disponible')
  context.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  return context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  await image.decode()
  return image
}

function loadVideoFrame(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const timeout = window.setTimeout(() => reject(new Error('Tiempo de espera agotado')), 15000)
    const fail = () => {
      window.clearTimeout(timeout)
      reject(new Error('No se pudo leer el video'))
    }
    video.addEventListener('error', fail, { once: true })
    video.addEventListener(
      'loadeddata',
      () => {
        const target = Number.isFinite(video.duration) ? Math.min(1.5, video.duration / 3) : 0
        video.addEventListener(
          'seeked',
          () => {
            window.clearTimeout(timeout)
            resolve(video)
          },
          { once: true },
        )
        video.currentTime = target
      },
      { once: true },
    )
    video.src = src
  })
}

/** Calcula el tono de acento de una imagen o video. Devuelve null si no se puede analizar. */
export async function extractTone(src: string, kind: 'image' | 'video'): Promise<AccentTone | null> {
  try {
    if (kind === 'image') {
      const image = await loadImage(src)
      return toneFromPixels(drawToCanvas(image))
    }
    const video = await loadVideoFrame(src)
    const tone = toneFromPixels(drawToCanvas(video))
    video.removeAttribute('src')
    video.load()
    return tone
  } catch {
    return null
  }
}

/** Degradado de vista previa para una muestra de color. */
export function tonePreview(tone: AccentTone): string {
  const c = Math.max(tone.c, 0.03)
  return `radial-gradient(circle at 20% 15%, oklch(0.55 ${c + 0.03} ${tone.h}) 0%, transparent 60%), radial-gradient(circle at 90% 30%, oklch(0.45 ${c} ${tone.h + 55}) 0%, transparent 55%), linear-gradient(160deg, oklch(0.24 ${c * 0.5} ${tone.h}), oklch(0.15 ${c * 0.35} ${tone.h + 45}))`
}
