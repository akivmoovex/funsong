import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/AuthContext'
import { PageShell, PageShellContent } from '@/components/ui'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'whitespace-nowrap rounded-full px-4 py-2 text-sm font-extrabold transition',
    isActive
      ? 'bg-white/25 text-white'
      : 'text-white/90 hover:bg-white/15'
  ].join(' ')

export function Layout() {
  const { user, logout, ready } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isSuperAdmin = ready && user?.role === 'super_admin'

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [menuOpen])

  return (
    <PageShell mode="lobby">
      <header className="px-4 pb-2 pt-4">
        <PageShellContent>
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
            <NavLink
              to="/"
              className="text-xl font-black tracking-tight text-white drop-shadow"
            >
              FunSong
            </NavLink>
            {ready && user && !isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  void logout()
                }}
                className="min-h-11 min-w-[4.5rem] touch-manipulation rounded-full bg-slate-900/30 px-3 text-xs font-extrabold"
              >
                Log out
              </button>
            )}
            {isSuperAdmin && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="min-h-11 min-w-[4.5rem] touch-manipulation rounded-full bg-slate-900/30 px-3 text-xs font-extrabold"
                  aria-label="Open admin menu"
                  aria-expanded={menuOpen}
                >
                  ☰ Menu
                </button>
                {menuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-white/20 bg-slate-950/95 p-2 shadow-xl">
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/admin/songs"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                    >
                      Songs
                    </Link>
                    <Link
                      to="/admin/parties"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                    >
                      Parties
                    </Link>
                    <Link
                      to="/admin/settings"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-bold text-white/95 hover:bg-white/10"
                    >
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        void logout()
                      }}
                      className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-100 hover:bg-rose-500/20"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {ready && user && (
            <p className="mt-1 text-center text-xs text-white/80 sm:text-left">
              {user.displayName} · {user.email}
            </p>
          )}
          <nav className="mt-3 flex max-w-4xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-1">
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
