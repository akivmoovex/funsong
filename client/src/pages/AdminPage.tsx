import { Link } from 'react-router-dom'

export function AdminPage() {
  return (
    <div className="space-y-4 text-left">
      <h2 className="text-2xl font-black text-white">Admin dashboard</h2>
      <p className="text-sm text-white/80">
        Super admin tools: manage the private song library (for approved parties only) and
        party access.
      </p>
      <div className="fs-card-lobby border-2 border-amber-200/40 p-4">
        <h3 className="text-lg font-black text-amber-100">Song library</h3>
        <p className="mt-1 text-sm text-white/90">
          Create, edit, publish, and tag tracks. Only published songs with
          rights that are not <span className="font-extrabold">blocked</span>{' '}
          appear in host party pickers.
        </p>
        <Link
          to="/admin/songs"
          className="mt-3 inline-flex min-h-[3.5rem] w-full touch-manipulation items-center justify-center rounded-2xl bg-lime-400 px-4 text-center text-lg font-extrabold text-slate-900 no-underline shadow-lg transition active:scale-[0.99] sm:w-auto"
        >
          Open song library
        </Link>
      </div>
      <div className="fs-card-lobby border-2 border-amber-200/40 p-4">
        <h3 className="text-lg font-black text-amber-100">Party requests & sessions</h3>
        <p className="mt-1 text-sm text-white/90">
          Approve or reject host requests, create join codes, and disable live parties.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/admin/party-requests"
            className="inline-flex min-h-[3rem] flex-1 touch-manipulation items-center justify-center rounded-2xl border-2 border-amber-200/50 bg-amber-500/10 px-4 text-center text-base font-extrabold text-amber-100 no-underline"
          >
            Review pending requests
          </Link>
          <Link
            to="/admin/parties"
            className="inline-flex min-h-[3rem] flex-1 touch-manipulation items-center justify-center rounded-2xl border-2 border-white/20 bg-white/5 px-4 text-center text-base font-extrabold text-white/90 no-underline"
          >
            View parties
          </Link>
        </div>
      </div>
    </div>
  )
}
