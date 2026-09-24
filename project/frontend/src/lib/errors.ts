const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was rejected by the server.',
  401: 'You are not signed in. Please log in again.',
  403: 'You do not have permission to do that.',
  404: 'The requested resource was not found.',
  409: 'That conflicts with existing data.',
  413: 'The uploaded file is too large.',
  415: 'That file type is not supported.',
  422: 'Some fields are invalid. Please check the form and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server hit an unexpected error. Please try again.',
  502: 'The AI service is unavailable right now. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'The server took too long to respond. Please try again.',
}

interface FieldError {
  loc?: unknown[]
  msg?: string
}

function formatFieldErrors(errors: FieldError[]): string {
  const messages = errors
    .map((error) => {
      const path = (error.loc ?? [])
        .filter((part) => part !== 'body')
        .map(String)
        .join('.')
      const message = error.msg ?? 'is invalid'
      return path ? `${path} ${message}` : message
    })
    .filter(Boolean)
  return messages.join('; ')
}

/**
 * Turns anything thrown by the API layer into a message that is safe to render.
 * Handles FastAPI's `detail` as a string, as a Pydantic error list, or as an object.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error === null || error === undefined) return fallback

  const maybeAxios = error as {
    isAxiosError?: boolean
    code?: string
    request?: unknown
    response?: { status?: number; data?: unknown }
  }

  if (maybeAxios.isAxiosError || maybeAxios.response !== undefined || maybeAxios.request !== undefined) {
    if (!maybeAxios.response) {
      if (maybeAxios.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
      if (maybeAxios.request) return 'Cannot reach the server. Is the backend running on port 8000?'
      return fallback
    }

    const status = maybeAxios.response.status
    const body = maybeAxios.response.data as Record<string, unknown> | string | undefined
    const statusMessage = status !== undefined ? STATUS_MESSAGES[status] : undefined

    if (typeof body === 'string') {
      const trimmed = body.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return getErrorMessage({ response: { status, data: JSON.parse(trimmed) } }, statusMessage ?? fallback)
        } catch {
          /* fall through to the status message */
        }
      }
      return trimmed || statusMessage || fallback
    }

    if (body && typeof body === 'object') {
      const detail = body.detail

      if (typeof detail === 'string' && detail.trim()) return detail.trim()

      if (Array.isArray(detail)) {
        const joined = formatFieldErrors(detail as FieldError[])
        if (joined) return joined
      }

      if (detail && typeof detail === 'object') {
        const nested = detail as { message?: unknown; errors?: unknown }
        if (typeof nested.message === 'string' && nested.message.trim()) {
          const sub = Array.isArray(nested.errors)
            ? formatFieldErrors(nested.errors as FieldError[])
            : ''
          return sub ? `${nested.message}: ${sub}` : nested.message
        }
        const joined = formatFieldErrors(detail as FieldError[])
        if (joined) return joined
      }

      if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()
    }

    return statusMessage ?? fallback
  }

  if (error instanceof Error && error.message) return error.message

  if (typeof error === 'string' && error.trim()) return error.trim()

  return fallback
}
