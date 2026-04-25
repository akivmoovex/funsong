import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

type Role = 'super_admin' | 'host'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  role: Role
  isActive: boolean
}

type AuthValue = {
  user: AuthUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const initial: AuthValue = {
  user: null,
  ready: false,
  async login() {
    throw new Error('Auth not mounted')
  },
  async logout() {
    return undefined
  },
  async refresh() {
    return undefined
  }
}

const Auth = createContext<AuthValue>(initial)

function parseUser(data: { user: unknown; reason?: string }): AuthUser | null {
  const u = data.user as Record<string, unknown> | null | undefined
  if (!u || !u.id || !u.email) {
    if (data.reason === 'inactive') {
      // caller may show a toast; session cleared on server
    }
    return null
  }
  return {
    id: String(u.id),
    email: String(u.email),
    displayName: String((u as { displayName?: string }).displayName),
    role: (u as { role: Role }).role,
    isActive: (u as { isActive?: boolean }).isActive !== false
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' })
    const d = (await r.json()) as { user: unknown; reason?: string }
    setUser(parseUser(d))
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    const d = (await r.json().catch(() => ({}))) as { user?: unknown; error?: string }
    if (!r.ok) {
      if (d.error === 'inactive' || (r as { status: number }).status === 403) {
        throw new Error('inactive')
      }
      throw new Error('invalid')
    }
    const out = parseUser({ user: d.user })
    if (out) setUser(out)
    if (!out) {
      void refresh()
    }
    if (out) return out
    throw new Error('invalid')
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, logout, refresh } satisfies AuthValue),
    [user, ready, login, logout, refresh]
  )
  return <Auth.Provider value={value}>{children}</Auth.Provider>
}

export function useAuth() {
  return useContext(Auth)
}
