import { AuthGate } from './components/auth/AuthGate.tsx'
import { AppShell } from './components/layout/AppShell.tsx'
import { BackgroundLayer } from './components/layout/BackgroundLayer.tsx'
import { AppearanceProvider } from './context/AppearanceProvider.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { ToastProvider } from './context/ToastProvider.tsx'

export default function App() {
  return (
    <AppearanceProvider>
      <BackgroundLayer />
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <AppShell />
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </AppearanceProvider>
  )
}
