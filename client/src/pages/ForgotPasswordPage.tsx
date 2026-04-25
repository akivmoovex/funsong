import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setDone(false)
    void fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then(async (r) => {
        await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error('submit_failed')
        }
        setDone(true)
      })
      .catch(() => {
        setErr('Could not submit right now. Please try again in a moment.')
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="fs-card space-y-4 text-left">
      <h2 className="text-2xl font-black">Forgot password</h2>
      <p className="text-sm text-white/80">
        Enter your account email. If this account exists, password reset instructions will be provided.
      </p>
      {done && (
        <p className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          If this account exists, password reset instructions will be provided.
        </p>
      )}
      {err && <p className="text-sm font-bold text-amber-200">{err}</p>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="forgot-email" className="text-xs font-bold text-white/70">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            required
            className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="fs-button fs-button--cyan w-full disabled:opacity-60"
        >
          {busy ? 'Submitting...' : 'Request password reset'}
        </button>
      </form>
      <p className="text-sm text-white/70">
        Back to{' '}
        <Link to="/login" className="font-bold text-fuchsia-200 hover:text-fuchsia-100">
          login
        </Link>
      </p>
    </div>
  )
}
