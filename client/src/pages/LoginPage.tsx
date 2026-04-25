import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/AuthContext'
import { useDelayedBusy } from '@/components/busy/BusyOverlayProvider'

const FAILED_LOGIN_KEY = 'funsong.login.failedCount'

export function LoginPage() {
  const { login, user, ready } = useAuth()
  const { runBusy } = useDelayedBusy()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failedCount, setFailedCount] = useState(() => {
    const raw = window.sessionStorage.getItem(FAILED_LOGIN_KEY)
    const n = Number.parseInt(String(raw || '0'), 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  })
  const next = search.get('next') || '/'

  if (ready && user) {
    // Logged in; return to where they were going, or home
    return (
      <div className="fs-card space-y-3 text-left">
        <h2 className="text-2xl font-black">You are in</h2>
        <p className="text-sm text-white/80">Use the nav or go back to your page.</p>
        <Link to={next} className="fs-button fs-button--lime w-full text-center no-underline">
          Continue
        </Link>
      </div>
    )
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    void runBusy(
      async () => {
        try {
          await login(email, password)
          window.sessionStorage.removeItem(FAILED_LOGIN_KEY)
          setFailedCount(0)
          if (search.get('next')) {
            void navigate(String(search.get('next') || ''), { replace: true })
          } else {
            void navigate('/', { replace: true })
          }
        } catch (c) {
          const m = typeof c === 'string' ? c : (c as { message?: string })?.message
          const nextFailed = failedCount + 1
          window.sessionStorage.setItem(FAILED_LOGIN_KEY, String(nextFailed))
          setFailedCount(nextFailed)
          if (m === 'inactive') {
            setErr('This account is inactive. Contact a super admin.')
          } else {
            setErr('Check your email and password, then try again.')
          }
        } finally {
          setBusy(false)
        }
      },
      { message: 'Logging in…' }
    )
  }

  return (
    <div className="fs-card space-y-4 text-left">
      <h2 className="text-2xl font-black">Log in</h2>
      <p className="text-sm text-white/80">Hosts and super admins only.</p>
      {search.get('reason') === 'inactive' && (
        <p className="text-sm text-amber-200">Your account is inactive.</p>
      )}
      {err && <p className="text-sm font-bold text-amber-200">{err}</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="email" className="text-xs font-bold text-white/70">
            Email
          </label>
          <input
            id="email"
            className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
            name="email"
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="text-xs font-bold text-white/70">
            Password
          </label>
          <input
            id="password"
            className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
            name="password"
            type="password"
            value={password}
            required
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="fs-button fs-button--lime w-full disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-sm text-white/70">
        New host?{' '}
        <Link to="/signup" className="font-bold text-fuchsia-200 hover:text-fuchsia-100">
          Sign up
        </Link>
      </p>
      {failedCount >= 3 && (
        <p className="text-sm text-white/75">
          Forgot your password?{' '}
          <Link to="/forgot-password" className="font-bold text-cyan-200 hover:text-cyan-100">
            Request reset help
          </Link>
        </p>
      )}
      <p className="text-center text-xs text-white/50">
        Session cookie is HTTP-only and SameSite=Lax. For stricter cross-site
        forms, add a server-issued CSRF token later.
      </p>
    </div>
  )
}
