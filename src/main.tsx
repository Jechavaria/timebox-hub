import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { EnvErrorScreen } from './components/auth/EnvErrorScreen.tsx'

const container = document.getElementById('root')
if (!container) {
  throw new Error('No se encontró el contenedor #root en index.html')
}

const root = createRoot(container)

// App se importa de forma dinámica: si faltan variables de entorno, lib/supabase.ts falla al evaluarse
// y un import estático impediría renderizar la pantalla de error.
import('./App.tsx')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    console.error('No se pudo iniciar TimeBox Hub:', error)
    root.render(
      <StrictMode>
        <EnvErrorScreen error={error} />
      </StrictMode>,
    )
  })
