import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function labelForError(code: string | null) {
  if (code === 'name_required') return 'Name is required.'
  if (code === 'email_invalid') return 'Enter a valid email address.'
  if (code === 'password_too_short') return 'Password must be at least 8 characters.'
  if (code === 'password_mismatch') return 'Passwords do not match.'
  if (code === 'email_taken') return 'That email is already registered.'
  if (code === 'network') return 'Network error. Please try again.'
  return 'Could not create account. Please try again.'
}

export function SignupPage() {
  const nav = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    void fetch('/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        email,
        password,
        confirmPassword
      })
    })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        if (!r.ok) {
          throw new Error(d.error || 'signup_failed')
        }
        return r
      })
      .then(() => nav('/host/dashboard?signup=success', { replace: true }))
      .catch((e: { message?: string } | string) => {
        const m = typeof e === 'string' ? e : e?.message || 'signup_failed'
        setErr(m)
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="fs-card space-y-4 text-left">
      <h2 className="text-2xl font-black">Host sign up</h2>
      <p className="text-sm text-white/80">Create a host account to manage your private party.</p>
      {err && <p className="text-sm font-bold text-amber-200">{labelForError(err)}</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="display-name" className="text-xs font-bold text-white/70">
            Name
          </label>
          <input
            id="display-name"
            className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
            name="displayName"
            value={displayName}
            required
            autoComplete="name"
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
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
            minLength={8}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="text-xs font-bold text-white/70">
            Confirm password
          </label>
          <input
            id="confirm-password"
            className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            required
            minLength={8}
            autoComplete="new-password"
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="fs-button fs-button--lime w-full disabled:opacity-60"
        >
          {busy ? 'Creating account…' : 'Create host account'}
        </button>
      </form>
      <p className="text-sm text-white/70">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-fuchsia-200 hover:text-fuchsia-100">
          Log in
        </Link>
      </p>
    </div>
  )
}
