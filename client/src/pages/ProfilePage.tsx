import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/AuthContext'
import { AVATAR_OPTIONS, getAvatarOptionByKey } from '@/lib/avatarOptions'

type ProfilePayload = {
  firstName: string
  lastName: string
  phoneNumber: string
  email: string
  avatarKey: string
}

function messageForError(code: string | null) {
  if (code === 'email_required') return 'Email is required.'
  if (code === 'email_invalid') return 'Enter a valid email address.'
  if (code === 'email_taken') return 'That email is already in use.'
  if (code === 'invalid_phone_number') return 'Phone number format is invalid.'
  if (code === 'invalid_avatar_key') return 'Please choose one of the built-in avatars.'
  if (code === 'current_password_invalid') return 'Current password is incorrect.'
  if (code === 'password_too_short') return 'New password must be at least 8 characters.'
  if (code === 'password_mismatch') return 'New password confirmation does not match.'
  if (code === 'network') return 'Network error. Please try again.'
  return 'Could not save profile.'
}

export function ProfilePage() {
  const { user, refresh } = useAuth()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [avatarKeys, setAvatarKeys] = useState<string[]>([])
  const [form, setForm] = useState<ProfilePayload>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    avatarKey: ''
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setErr(null)
      const r = await fetch('/api/account/profile', { credentials: 'include' })
      const d = (await r.json().catch(() => ({}))) as {
        profile?: Partial<ProfilePayload>
        avatarOptions?: string[]
      }
      if (!r.ok) {
        if (!cancelled) {
          setErr('network')
          setLoading(false)
        }
        return
      }
      if (!cancelled) {
        setForm({
          firstName: String(d.profile?.firstName ?? ''),
          lastName: String(d.profile?.lastName ?? ''),
          phoneNumber: String(d.profile?.phoneNumber ?? ''),
          email: String(d.profile?.email ?? ''),
          avatarKey: String(d.profile?.avatarKey ?? '')
        })
        setAvatarKeys(Array.isArray(d.avatarOptions) ? d.avatarOptions : [])
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const avatarOptions = useMemo(() => {
    const filtered = AVATAR_OPTIONS.filter((a) => avatarKeys.includes(a.key))
    if (filtered.length > 0) return filtered
    return AVATAR_OPTIONS
  }, [avatarKeys])
  const selectedAvatar = getAvatarOptionByKey(form.avatarKey)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setOk(null)
    void fetch('/api/account/profile', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phoneNumber: form.phoneNumber,
        email: form.email,
        avatarKey: form.avatarKey || null,
        currentPassword,
        newPassword,
        confirmNewPassword
      })
    })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as {
          error?: string
          profile?: Partial<ProfilePayload>
        }
        if (!r.ok) {
          throw new Error(d.error || 'unknown')
        }
        setForm((prev) => ({
          ...prev,
          firstName: String(d.profile?.firstName ?? prev.firstName),
          lastName: String(d.profile?.lastName ?? prev.lastName),
          phoneNumber: String(d.profile?.phoneNumber ?? prev.phoneNumber),
          email: String(d.profile?.email ?? prev.email),
          avatarKey: String(d.profile?.avatarKey ?? prev.avatarKey)
        }))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
        setOk('Profile saved.')
        return refresh()
      })
      .catch((x: unknown) => {
        const m = x instanceof Error ? x.message : 'network'
        setErr(m || 'network')
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <section className="rounded-3xl border border-white/15 bg-slate-900/35 p-6 text-white shadow-xl">
      <h1 className="text-2xl font-black text-amber-100">Your Profile</h1>
      <p className="mt-2 text-sm text-white/80">
        Update your account details and avatar. Roles and account activation are managed by admin tools.
      </p>
      {loading && <p className="mt-4 text-sm text-white/70">Loading profile...</p>}
      {!loading && (
        <form onSubmit={onSubmit} className="mt-4 space-y-5">
          {err && <p className="text-sm font-bold text-amber-200">{messageForError(err)}</p>}
          {ok && <p className="text-sm font-bold text-lime-200">{ok}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="first-name" className="text-xs font-bold text-white/70">
                First name
              </label>
              <input
                id="first-name"
                className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="last-name" className="text-xs font-bold text-white/70">
                Last name
              </label>
              <input
                id="last-name"
                className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="text-xs font-bold text-white/70">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="phone-number" className="text-xs font-bold text-white/70">
              Phone number (optional)
            </label>
            <input
              id="phone-number"
              className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
              value={form.phoneNumber}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              placeholder="+1 555 0101"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-white/70">Avatar</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {avatarOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, avatarKey: opt.key }))}
                  className={[
                    'rounded-2xl border px-3 py-2 text-left transition',
                    form.avatarKey === opt.key
                      ? 'border-amber-300 bg-amber-300/20'
                      : 'border-white/20 bg-white/5 hover:bg-white/10'
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={[
                        'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black',
                        opt.className
                      ].join(' ')}
                    >
                      {opt.chip}
                    </span>
                    <span className="text-xs font-bold text-white/90">{opt.label}</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, avatarKey: '' }))}
              className="mt-2 text-xs font-bold text-white/70 hover:text-white"
            >
              Clear avatar
            </button>
            {selectedAvatar && (
              <p className="mt-1 text-xs text-white/70">Selected: {selectedAvatar.label}</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/30 p-4">
            <h2 className="text-sm font-black text-cyan-100">Change password</h2>
            <p className="mt-1 text-xs text-white/65">
              Leave blank to keep your existing password.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="current-password" className="text-xs font-bold text-white/70">
                  Current password
                </label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="new-password" className="text-xs font-bold text-white/70">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="text-xs font-bold text-white/70">
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-slate-900"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="fs-button fs-button--lime w-full disabled:opacity-60"
            disabled={busy}
          >
            {busy ? 'Saving...' : 'Save profile'}
          </button>
          <p className="text-xs text-white/60">
            Signed in as {user?.displayName || 'User'} ({user?.role || 'host'}).
          </p>
        </form>
      )}
    </section>
  )
}
