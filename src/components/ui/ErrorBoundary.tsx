import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from './Button.tsx'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó un error no controlado:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[14rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-ink">
          <AlertCircle className="size-8 text-danger" />
          <div className="max-w-md">
            <h3 className="text-sm font-semibold text-danger">Ocurrió un problema inesperado</h3>
            <p className="mt-1 text-xs text-ink-muted">
              {this.state.error?.message || 'Se produjo un error al procesar este elemento.'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={this.handleReset} className="mt-1">
            <RotateCcw className="size-3.5" />
            Reintentar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
