import { TriangleAlert } from 'lucide-react'
import { EnvConfigError } from '../../lib/envConfigError.ts'
import { Button } from '../ui/Button.tsx'
import { GlassPanel } from '../ui/GlassPanel.tsx'

interface EnvErrorScreenProps {
  error: unknown
}

const ENV_EXAMPLE = [
  'VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co',
  'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...',
].join('\n')

const CODE_CLASS = 'rounded bg-white/10 px-1 py-0.5 text-ink'

/** Pantalla de último recurso: no debe importar nada que dependa del cliente de Supabase. */
export function EnvErrorScreen({ error }: EnvErrorScreenProps) {
  const isEnvError = error instanceof EnvConfigError
  const details = isEnvError
    ? [...error.issues]
    : [error instanceof Error ? error.message : 'Error desconocido al iniciar la aplicación.']

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <GlassPanel
        as="section"
        variant="popover"
        padding="lg"
        role="alert"
        className="w-full max-w-lg animate-pop-in"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger">
            <TriangleAlert className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {isEnvError ? 'Configuración de entorno inválida' : 'No se pudo iniciar la aplicación'}
            </h1>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        </div>

        {isEnvError ? (
          <>
            <p className="mt-5 text-sm text-ink-muted">
              Crea un archivo <code className={CODE_CLASS}>.env</code> en la raíz del proyecto
              (puedes copiar <code className={CODE_CLASS}>.env.example</code>) con estas variables
              y reinicia el servidor de desarrollo:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-glass-border bg-black/30 p-3 text-xs text-ink">
              {ENV_EXAMPLE}
            </pre>
          </>
        ) : null}

        <Button className="mt-6" variant="primary" fullWidth onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </GlassPanel>
    </main>
  )
}
