import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GitCompare, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../lib/errors'
import { getHomePath } from '../lib/roles'
import { Alert, Button, Input } from '../components/ui'

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'GenAI interpretation',
    text: 'Gemini structures every complaint: category, urgency, department, response.',
  },
  {
    icon: GitCompare,
    title: 'Independent Python verification',
    text: 'A deterministic rule engine re-derives the answer and flags any mismatch.',
  },
  {
    icon: ShieldCheck,
    title: 'Nothing ships unverified',
    text: 'Disagreements land in a human review queue with a full audit trail.',
  },
]

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const sessionNotice =
    searchParams.get('reason') === 'expired'
      ? 'Your session expired. Please sign in again.'
      : ''

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = isRegister
        ? await register(username, email, password)
        : await login(username, password)
      navigate(getHomePath(user.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Authentication failed'))
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegister((current) => !current)
    setError('')
  }

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-700 p-10 text-white lg:flex lg:flex-col">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #fff 0, transparent 45%), radial-gradient(circle at 80% 70%, #c7d2fe 0, transparent 50%)',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-white/15 ring-1 ring-white/25">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight">SupportNova</span>
          </Link>
        </div>

        <div className="relative mt-auto max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Complaint intelligence you can actually trust.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-100">
            Every GenAI recommendation is re-checked by a deterministic Python rule engine before it
            reaches a customer.
          </p>

          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-relaxed text-brand-100">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-brand-200/80">
          SupportNova · Generative AI PowerPlay
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-7 lg:hidden">
            <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
              <span className="grid size-8 place-items-center rounded-md bg-brand-600 text-white">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              SupportNova
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-ink">
            {isRegister ? 'Create your account' : 'Sign in to SupportNova'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isRegister
              ? 'Register to start submitting and tracking complaints.'
              : 'Use your demo credentials, or register as a customer.'}
          </p>

          <div className="mt-5 space-y-3">
            {sessionNotice && <Alert tone="info">{sessionNotice}</Alert>}
            {error && <Alert tone="error" title="Sign-in failed">{error}</Alert>}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {isRegister && (
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            )}

            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="e.g. admin"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="font-medium text-brand-600 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
