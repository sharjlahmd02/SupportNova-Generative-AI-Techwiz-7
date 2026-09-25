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
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 15%, rgba(255,255,255,0.35) 0, transparent 45%), radial-gradient(circle at 85% 75%, rgba(255,255,255,0.10) 0, transparent 55%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-ink"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-white ring-1 ring-white/30">
              <ShieldCheck className="size-5 text-ink" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight">SupportNova</span>
          </Link>
        </div>

        <div className="relative mt-auto max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight">
            Complaint intelligence you can actually trust.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Every GenAI recommendation is re-checked by a deterministic Python rule engine before it
            reaches a customer.
          </p>

          <ul className="mt-9 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/20">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/60">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-11 text-xs text-white/45">
          SupportNova · Generative AI PowerPlay
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center bg-surface p-5 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight text-ink">
              <span className="grid size-9 place-items-center rounded-lg bg-ink text-white">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              SupportNova
            </span>
          </div>

          <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">
            {isRegister ? 'Create your account' : 'Sign in to SupportNova'}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
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
              className="font-semibold text-ink underline underline-offset-4 decoration-1 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 rounded-sm"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
