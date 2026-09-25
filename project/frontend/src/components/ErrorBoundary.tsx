import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.assign('/')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
        <div className="w-full max-w-lg rounded-lg border border-danger-border bg-surface p-6 shadow-card">
          <span className="grid size-11 place-items-center rounded-full bg-danger-bg text-danger">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink">Something went wrong in the interface</h1>
          <p className="mt-1 text-sm text-muted">
            The page could not be rendered. Reloading usually fixes it.
          </p>
          <p className="mt-3 rounded-md bg-danger-bg px-3 py-2 font-mono text-xs text-danger">
            {error.message}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reload application
          </button>
        </div>
      </div>
    )
  }
}
