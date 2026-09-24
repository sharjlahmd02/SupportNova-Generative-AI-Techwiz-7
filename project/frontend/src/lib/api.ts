import axios from 'axios'

const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? ''

// Strip a trailing slash and any accidental `/api` suffix so we never build `/api/api`.
const origin = configured.replace(/\/+$/, '').replace(/\/api$/, '')

/**
 * In development the Vite proxy forwards `/api` to the backend when no base URL is set,
 * so leaving `VITE_API_BASE_URL` empty also avoids CORS entirely.
 */
export const api = axios.create({
  baseURL: origin ? `${origin}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
})

const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/register']

const isPublicEndpoint = (url?: string) =>
  PUBLIC_ENDPOINTS.some((path) => (url ?? '').startsWith(path))

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    // Failed logins must reach the form so the user can see why they were rejected.
    if (status === 401 && !isPublicEndpoint(error.config?.url)) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?reason=expired')
      }
    }
    return Promise.reject(error)
  },
)
