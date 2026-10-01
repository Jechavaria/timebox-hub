import { AuthGate } from './components/auth/AuthGate.tsx'
import { AppShell } from './components/layout/AppShell.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { ToastProvider } from './context/ToastProvider.tsx'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthGate>
          <AppShell />
        </AuthGate>
      </AuthProvider>
    </ToastProvider>
  )
}
