import { useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import clsx from 'clsx'
import { Check, Film, ImageIcon, Palette, Trash2, Upload } from 'lucide-react'
import { useAppearance } from '../../hooks/useAppearance.ts'
import { useToast } from '../../hooks/useToast.ts'
import { MAX_DIM, tonePreview } from '../../lib/appearance.ts'
import type { BackgroundOption } from '../../lib/appearance.ts'
import { Button } from '../ui/Button.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Spinner } from '../ui/Spinner.tsx'

interface BackgroundModalProps {
  open: boolean
  onClose: () => void
}

function MediaThumb({ option }: { option: BackgroundOption }) {
  if (option.kind === 'video') {
    return (
      <video
        src={option.src}
        muted
        playsInline
        preload="metadata"
        className="size-full object-cover"
        onMouseEnter={(event) => { void event.currentTarget.play().catch(() => undefined) }}
        onMouseLeave={(event) => event.currentTarget.pause()}
      />
    )
  }
  return <img src={option.src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
}

interface OptionCardProps {
  option: BackgroundOption
  selected: boolean
  onSelect: () => void
  onRemove?: () => void
}

function OptionCard({ option, selected, onSelect, onRemove }: OptionCardProps) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={clsx(
          'group relative block aspect-video w-full overflow-hidden rounded-2xl border text-left',
          selected ? 'border-accent ring-2 ring-accent/50' : 'border-glass-border',
        )}
      >
        {option.kind === 'gradient' && option.tone ? (
          <span aria-hidden="true" className="block size-full" style={{ backgroundImage: tonePreview(option.tone) }} />
        ) : (
          <MediaThumb option={option} />
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-linear-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6 text-xs font-medium text-white">
          {option.kind === 'video' ? <Film aria-hidden="true" className="size-3.5 shrink-0" /> : null}
          {option.kind === 'image' ? <ImageIcon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
          <span className="truncate">{option.name}</span>
        </span>
        {selected ? (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent-strong text-white shadow-md">
            <Check aria-hidden="true" className="size-3.5" />
          </span>
        ) : null}
      </button>
      {onRemove ? (
        <IconButton
          label={`Eliminar fondo ${option.name}`}
          size="sm"
          variant="danger"
          onClick={onRemove}
          className="absolute left-2 top-2 size-8 bg-black/55 backdrop-blur-sm"
        >
          <Trash2 />
        </IconButton>
      ) : null}
    </div>
  )
}

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="mb-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{children}</h3>
      {hint ? <p className="mt-0.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export function BackgroundModal({ open, onClose }: BackgroundModalProps) {
  const {
    builtinBackgrounds,
    presetBackgrounds,
    customBackgrounds,
    activeBackground,
    selectBackground,
    dim,
    setDim,
    adaptColors,
    setAdaptColors,
    addCustomBackground,
    removeCustomBackground,
    isAnalyzing,
  } = useAppearance()
  const toast = useToast()
  const uid = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const isMedia = activeBackground.kind !== 'gradient'

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    const result = await addCustomBackground(file)
    setUploading(false)
    if (result.ok) toast.success(`“${result.data.name}” es tu nuevo fondo.`)
    else toast.error(result.message, 'No se pudo agregar el fondo')
  }

  const handleRemove = async (option: BackgroundOption) => {
    const result = await removeCustomBackground(option.id)
    if (!result.ok) toast.error(result.message)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Fondo de pantalla"
      description="Elige un ambiente. Los colores de la interfaz se adaptan al fondo."
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>Listo</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <section aria-labelledby={`${uid}-colors`}>
          <div id={`${uid}-colors`}>
            <SectionTitle>Degradados</SectionTitle>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {builtinBackgrounds.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={activeBackground.id === option.id}
                onSelect={() => selectBackground(option.id)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby={`${uid}-presets`}>
          <div id={`${uid}-presets`}>
            <SectionTitle hint="Imágenes y videos incluidos en la app.">Plantillas</SectionTitle>
          </div>
          {presetBackgrounds.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {presetBackgrounds.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={activeBackground.id === option.id}
                  onSelect={() => selectBackground(option.id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-glass-border px-4 py-3 text-xs text-ink-faint">
              Aún no hay plantillas. Copia imágenes (JPG, PNG, WEBP) o videos (MP4, WEBM) en la carpeta
              <code className="mx-1 rounded bg-glass-strong px-1 py-0.5 text-ink">src/assets/backgrounds/</code>
              y aparecerán aquí automáticamente.
            </p>
          )}
        </section>

        <section aria-labelledby={`${uid}-custom`}>
          <div className="flex items-end justify-between gap-3">
            <div id={`${uid}-custom`}>
              <SectionTitle hint="Se guardan solo en este dispositivo. Máx. 80 MB.">Mis fondos</SectionTitle>
            </div>
            <Button
              size="sm"
              loading={uploading}
              leadingIcon={<Upload aria-hidden="true" className="size-4" />}
              onClick={() => fileInputRef.current?.click()}
              className="mb-2.5"
            >
              Subir imagen o video
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => { void handleFile(event) }}
            />
          </div>
          {customBackgrounds.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {customBackgrounds.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={activeBackground.id === option.id}
                  onSelect={() => selectBackground(option.id)}
                  onRemove={() => { void handleRemove(option) }}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-faint">Todavía no has subido fondos propios.</p>
          )}
        </section>

        <section className="grid gap-4 rounded-2xl border border-glass-border bg-glass p-4 sm:grid-cols-2">
          <div className={clsx(!isMedia && 'opacity-50')}>
            <div className="flex items-center justify-between">
              <label htmlFor={`${uid}-dim`} className="text-sm font-medium text-ink">Atenuación del fondo</label>
              <span className="text-xs tabular-nums text-ink-muted">{Math.round(dim * 100)}%</span>
            </div>
            <input
              id={`${uid}-dim`}
              type="range"
              min={0}
              max={MAX_DIM * 100}
              step={5}
              value={Math.round(dim * 100)}
              disabled={!isMedia}
              onChange={(event) => setDim(Number(event.target.value) / 100)}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-xs text-ink-faint">Oscurece (o aclara en modo claro) la imagen para leer mejor.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={adaptColors}
              onChange={(event) => setAdaptColors(event.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Palette aria-hidden="true" className="size-4 text-accent" />
                Adaptar colores al fondo
                {isAnalyzing ? <Spinner size="sm" label="Analizando colores del fondo" /> : null}
              </span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                Toma el color dominante de la imagen o video para los acentos de la interfaz.
              </span>
            </span>
          </label>
        </section>
      </div>
    </Modal>
  )
}
