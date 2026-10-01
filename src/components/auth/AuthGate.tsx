import type { ReactNode } from 'react'
import { Hourglass } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.ts'
import { Spinner } from '../ui/Spinner.tsx'
import { AuthModal } from './AuthModal.tsx'

function SplashScreen() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex animate-fade-in flex-col items-center gap-5">
        <span className="glass-panel grid size-16 place-items-center">
          <Hourglass className="size-8 text-accent" aria-hidden="true" />
        </span>
        <Spinner label="Cargando tu sesión" />
      </div>
    </div>
  )
}

interface AuthGateProps {
  children: ReactNode
}

/** Solo monta la aplicación cuando hay sesión; sin sesión no se hace ninguna petición de datos. */
export function AuthGate({ children }: AuthGateProps) {
  const { status } = useAuth()

  if (status === 'loading') return <SplashScreen />
  if (status === 'unauthenticated') return <AuthModal />
  return <>{children}</>
}
