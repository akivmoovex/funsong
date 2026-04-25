import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/AuthContext'
import { getAvatarOptionByKey } from '@/lib/avatarOptions'
import { PageShell, PageShellContent } from '@/components/ui'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'whitespace-nowrap rounded-full px-4 py-2 text-sm font-extrabold transition',
    isActive
      ? 'bg-white/25 text-white'
      : 'text-white/90 hover:bg-white/15'
  ].join(' ')

const mainNavItemClass = 'block rounded-xl px-3 py-2 text-left text-sm font-bold text-white/95 hover:bg-white/10'

export function Layout() {
  const { user, logout, ready } = useAuth()
  const nav = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const mobileWrapRef = useRef<HTMLDivElement | null>(null)
  const userMenuWrapRef = useRef<HTMLDivElement | null>(null)
  const isSignedIn = ready && !!user
  const isSuperAdmin = user?.role === 'super_admin'
  const isHost = user?.role === 'host'
  const avatarLetter = (user?.displayName || user?.email || '?').trim().slice(0, 1).toUpperCase()
  const avatar = getAvatarOptionByKey(user?.avatarKey)

  const closeMenus = useCallback(() => {
    setMobileOpen(false)
    setUserMenuOpen(false)
  }, [])

  const handleLogout = useCallback(() => {
    closeMenus()
    void (async () => {
      try {
        await logout()
      } finally {
        nav('/', { replace: true })
      }
    })()
  }, [closeMenus, logout, nav])

  useEffect(() => {
    if (!mobileOpen && !userMenuOpen) return
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (mobileWrapRef.current?.contains(t)) return
      if (userMenuWrapRef.current?.contains(t)) return
      closeMenus()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [closeMenus, mobileOpen, userMenuOpen])

  return (
    <PageShell mode="lobby">
      <header className="px-4 pb-2 pt-4 md:pb-2">
        <PageShellContent>
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
            <NavLink
              to="/"
              className="text-xl font-black tracking-tight text-white drop-shadow"
            >
              FunSong
            </NavLink>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative md:hidden" ref={mobileWrapRef}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    setMobileOpen((v) => !v)
                  }}
                  className="min-h-11 min-w-[4.5rem] touch-manipulation rounded-full bg-slate-900/30 px-3 text-xs font-extrabold"
                  aria-label="Open main menu"
                  aria-expanded={mobileOpen}
                >
                  ☰ Menu
                </button>
                {mobileOpen && (
                  <div
                    data-testid="mobile-main-menu"
                    className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/20 bg-slate-950/95 p-2 shadow-xl"
                  >
                    {!isSignedIn ? (
                      <div className="space-y-1 p-0.5">
                        <NavLink
                          to="/"
                          onClick={closeMenus}
                          className={({ isActive }) => mainNavItemClass + (isActive ? ' bg-white/20' : '')}
                          end
                        >
                          Home
                        </NavLink>
                        <NavLink
                          to="/join"
                          onClick={closeMenus}
                          className={({ isActive }) => mainNavItemClass + (isActive ? ' bg-white/20' : '')}
                        >
                          Join Party
                        </NavLink>
                        <NavLink
                          to="/login"
                          onClick={closeMenus}
                          className={({ isActive }) => mainNavItemClass + (isActive ? ' bg-white/20' : '')}
                        >
                          Login
                        </NavLink>
                      </div>
                    ) : isSuperAdmin ? (
                      <div className="space-y-1 p-0.5">
                        <NavLink
                          to="/"
                          onClick={closeMenus}
                          className={({ isActive }) => mainNavItemClass + (isActive ? ' bg-white/20' : '')}
                          end
                        >
                          Home
                        </NavLink>
                        <NavLink
                          to="/join"
                          onClick={closeMenus}
                          className={({ isActive }) => mainNavItemClass + (isActive ? ' bg-white/20' : '')}
                        >
                          Join Party
                        </NavLink>
                        <Link
                          to="/admin"
                          onClick={closeMenus}
                          className={mainNavItemClass}
                        >
                          Admin Dashboard
                        </Link>
                        <Link
                          to="/admin/songs"
                          onClick={closeMenus}
                          className={mainNavItemClass}
                        >
                          Songs
                        </Link>
                        <Link
                          to="/admin/parties"
                          onClick={closeMenus}
                          className={mainNavItemClass}
                        >
                          Parties
                        </Link>
                        <Link
                          to="/admin/settings"
                          onClick={closeMenus}
                          className={mainNavItemClass}
                        >
                          Settings
                        </Link>
                        <button
                          type="button"
                          data-testid="mobile-menu-logout"
                          onClick={handleLogout}
                          className="mt-0.5 block w-full rounded-xl bg-rose-500/20 px-3 py-2 text-left text-sm font-bold text-rose-100 hover:bg-rose-500/30"
                        >
                          Logout
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 p-0.5">
                        <NavLink
                          to="/"
                          onClick={closeMenus}
                          className={({ isActive }) => mainNavItemClass + (isActive ? ' bg-white/20' : '')}
                          end
                        >
                          Home
                        </NavLink>
                        <NavLink
                          to="/join"
                          onClick={closeMenus}
                          className={({ isActive }) => mainNavItemClass + (isActive ? ' bg-white/20' : '')}
                        >
                          Join Party
                        </NavLink>
                        {isHost && (
                          <Link
                            to="/host/dashboard"
                            onClick={closeMenus}
                            className={mainNavItemClass}
                          >
                            Host Dashboard
                          </Link>
                        )}
                        <button
                          type="button"
                          data-testid="mobile-menu-logout"
                          onClick={handleLogout}
                          className="mt-0.5 block w-full rounded-xl bg-rose-500/20 px-3 py-2 text-left text-sm font-bold text-rose-100 hover:bg-rose-500/30"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            {isSignedIn && (
              <div className="relative hidden md:block" ref={userMenuWrapRef}>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    setUserMenuOpen((v) => !v)
                  }}
                  className="min-h-11 min-w-[4.5rem] touch-manipulation rounded-full bg-slate-900/30 px-3 text-xs font-extrabold"
                  aria-label="Open user menu"
                  aria-expanded={userMenuOpen}
                >
                  ☰ Menu
                </button>
                {userMenuOpen && (
                  <div
                    data-testid="auth-burger-menu"
                    className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/20 bg-slate-950/95 p-2 shadow-xl"
                  >
                    <Link
                      to="/account/profile"
                      onClick={closeMenus}
                      className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                    >
                      <span
                        className={[
                          'inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-black',
                          avatar?.className || 'bg-fuchsia-500/25 text-fuchsia-100'
                        ].join(' ')}
                      >
                        {avatar?.chip || avatarLetter}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-white/95">
                          {user?.displayName || 'Your profile'}
                        </span>
                        <span className="block truncate text-xs text-white/65">{user?.email || ''}</span>
                      </span>
                    </Link>
                    <Link
                      to="/my-songs"
                      onClick={closeMenus}
                      className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                    >
                      My Songs
                    </Link>
                    {isHost && (
                      <>
                        <Link
                          to="/host/dashboard"
                          onClick={closeMenus}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                        >
                          Host Dashboard
                        </Link>
                        <Link
                          to="/host/parties/new"
                          onClick={closeMenus}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                        >
                          Create Party
                        </Link>
                      </>
                    )}
                    {isSuperAdmin && (
                      <>
                        <Link
                          to="/admin"
                          onClick={closeMenus}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                        >
                          Admin Dashboard
                        </Link>
                        <Link
                          to="/admin/songs"
                          onClick={closeMenus}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                        >
                          Songs
                        </Link>
                        <Link
                          to="/admin/parties"
                          onClick={closeMenus}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                        >
                          Parties
                        </Link>
                        <Link
                          to="/admin/settings"
                          onClick={closeMenus}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                        >
                          Settings
                        </Link>
                        <Link
                          to="/admin/password-reset-requests"
                          onClick={closeMenus}
                          className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                        >
                          Password resets
                        </Link>
                      </>
                    )}
                    <button
                      type="button"
                      data-testid="auth-menu-logout"
                      onClick={handleLogout}
                      className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-100 hover:bg-rose-500/20"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
          {ready && user && (
            <p className="mt-1 text-center text-xs text-white/80 sm:text-left">
              {user.displayName} · {user.email}
            </p>
          )}
          <nav
            className="mt-0 hidden w-full max-w-4xl flex-wrap justify-center gap-1 md:mt-3 md:flex"
            aria-label="Main navigation"
          >
            <NavLink to="/" className={linkClass} end>
              Home
            </NavLink>
            <NavLink to="/join" className={linkClass}>
              Join
            </NavLink>
            <NavLink to="/host/dashboard" className={linkClass}>
              Host
            </NavLink>
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
            <NavLink to="/login" className={linkClass}>
              Login
            </NavLink>
          </nav>
        </PageShellContent>
      </header>
      <PageShellContent className="flex-1 px-4 pb-10">
        <main className="w-full min-w-0">
          <Outlet />
        </main>
      </PageShellContent>
    </PageShell>
  )
}
