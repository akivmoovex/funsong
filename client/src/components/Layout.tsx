import { NavLink, Outlet } from 'react-router-dom'
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
            {ready && user && (
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
