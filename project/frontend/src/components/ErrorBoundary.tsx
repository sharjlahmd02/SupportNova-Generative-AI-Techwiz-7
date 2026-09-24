import { Component, ErrorInfo, ReactNode } from 'react'

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
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="alert alert-error">
          <strong>Something went wrong in the interface.</strong>
          <p style={{ marginTop: '0.5rem' }}>{error.message}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={this.handleReload}>
          Reload application
        </button>
      </div>
    )
  }
}
