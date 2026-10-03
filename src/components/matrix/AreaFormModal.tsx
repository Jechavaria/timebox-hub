import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Palette } from 'lucide-react'
import { DEFAULT_AREA_COLOR } from '../../lib/constants.ts'
import type { Area, AreaInsert, MutationResult } from '../../types/domain.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'

interface AreaFormModalProps {
  open: boolean
  area?: Area | null
  onClose: () => void
  onSave: (input: Pick<AreaInsert, 'name'> & Partial<Pick<AreaInsert, 'color'>>) => Promise<MutationResult<Area>>
}

export function AreaFormModal({ open, area = null, onClose, onSave }: AreaFormModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_AREA_COLOR)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const uid = useId()
  const nameId = `${uid}-name`
  const colorId = `${uid}-color`

  useEffect(() => {
    if (!open) return
    setName(area?.name ?? '')
    setColor(area?.color ?? DEFAULT_AREA_COLOR)
    setError(null)
  }, [open, area?.id, area?.name, area?.color])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName || cleanName.length > 60) {
      setError('El nombre debe tener entre 1 y 60 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await onSave({ name: cleanName, color })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={area ? 'Editar ámbito' : 'Nuevo ámbito'}
      description="Organiza tareas según las áreas de tu vida."
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form={`${uid}-form`} variant="primary" loading={saving}>
            <Check aria-hidden="true" className="size-4" />
            Guardar
          </Button>
        </div>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-ink">Nombre</label>
          <input
            id={nameId}
            data-autofocus
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Por ejemplo, Trabajo o Salud"
            aria-invalid={Boolean(error)}
            className="glass-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={colorId} className="text-sm font-medium text-ink">Color</label>
          <div className="flex items-center gap-3">
            <input
              id={colorId}
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Color del ámbito"
              className="size-12 cursor-pointer rounded-xl border border-glass-border bg-glass p-1"
            />
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <Palette aria-hidden="true" className="size-4" />
              {color.toUpperCase()}
            </span>
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  )
}
