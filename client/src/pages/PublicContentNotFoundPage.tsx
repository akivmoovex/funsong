import { Link } from 'react-router-dom'

/**
 * Intentional dead-end: no public song/lyric catalog. Host/admin flows use /admin and /host.
 */
export function PublicContentNotFoundPage() {
  return (
    <div className="fs-card max-w-md space-y-3 text-left">
      <h1 className="text-2xl font-black">Not found</h1>
      <p className="text-sm text-white/80">
        There is no public music or lyrics directory here. Songs are available only in private
        party flows after approval.
      </p>
      <Link
        to="/"
        className="inline-block text-sm font-bold text-fuchsia-300 hover:text-fuchsia-200"
      >
        ← Home
      </Link>
    </div>
  )
}
