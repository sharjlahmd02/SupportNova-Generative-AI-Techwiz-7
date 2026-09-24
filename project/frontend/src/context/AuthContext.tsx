import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { getHomePath } from '../lib/roles'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  homePath: string
  login: (username: string, password: string) => Promise<User>
  register: (username: string, email: string, password: string, role?: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function readStoredUser(): User | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStoredUser())
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }, [])

  const persistSession = useCallback((nextToken: string) => {
    setToken(nextToken)
    localStorage.setItem('token', nextToken)
  }, [])

  const persistUser = useCallback((nextUser: User) => {
    setUser(nextUser)
    localStorage.setItem('user', JSON.stringify(nextUser))
  }, [])

  const fetchMe = useCallback(
    async (currentToken: string): Promise<User> => {
      const response = await api.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      })
      persistUser(response.data)
      return response.data
    },
    [persistUser],
  )

  // Re-validate a restored session before rendering protected routes.
  useEffect(() => {
    let cancelled = false

    const restore = async () => {
      const storedToken = localStorage.getItem('token')
      if (!storedToken) {
        setIsLoading(false)
        return
      }
      try {
        await fetchMe(storedToken)
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status
        // Only drop the session when the server rejects the token; a network blip
        // should not log the user out of a still-valid session.
        if (status === 401 || status === 403) logout()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [fetchMe, logout])

  const login = useCallback(
    async (username: string, password: string): Promise<User> => {
      try {
        const response = await api.post<{ access_token: string }>('/auth/login', {
          username,
          password,
        })
        persistSession(response.data.access_token)
        return await fetchMe(response.data.access_token)
      } catch (error) {
        throw new Error(getErrorMessage(error, 'Login failed. Please try again.'))
      }
    },
    [fetchMe, persistSession],
  )

  const register = useCallback(
    async (username: string, email: string, password: string, role = 'customer'): Promise<User> => {
      try {
        const response = await api.post<{ access_token: string }>('/auth/register', {
          username,
          email,
          password,
          role,
        })
        persistSession(response.data.access_token)
        return await fetchMe(response.data.access_token)
      } catch (error) {
        throw new Error(getErrorMessage(error, 'Registration failed. Please try again.'))
      }
    },
    [fetchMe, persistSession],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        homePath: getHomePath(user?.role),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
