import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/AuthContext'

type Props = {
  children: React.ReactNode
  need: 'host' | 'super_admin'
}

export function ProtectedRoute({ children, need }: Props) {
  const { user, ready } = useAuth()
  const { pathname, search } = useLocation()
  if (!ready) {
    return (
      <div className="fs-card text-center text-sm">Checking your session…</div>
    )
  }
  if (!user) {
    const next = encodeURIComponent(pathname + (search || ''))
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (need === 'host') {
    if (user.role === 'host' || user.role === 'super_admin') {
      return <>{children}</>
    }
    return <Navigate to="/?error=forbidden" replace />
  }
  if (need === 'super_admin' && user.role === 'super_admin') {
    return <>{children}</>
  }
  if (need === 'super_admin') {
    return <Navigate to="/?error=forbidden" replace />
  }
  return <>{children}</>
}
