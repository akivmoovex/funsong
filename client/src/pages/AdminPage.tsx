import { Link } from 'react-router-dom'

export function AdminPage() {
  return (
    <div className="space-y-4 text-left">
      <h2 className="text-2xl font-black text-white">Admin dashboard</h2>
      <p className="text-sm text-white/80">
        Super admin tools: monitor private parties, keep hosts and guests safe, and manage the song library.
      </p>
      <div className="fs-card-lobby border-2 border-cyan-200/40 p-4">
        <h3 className="text-lg font-black text-cyan-100">Party monitoring</h3>
        <p className="mt-1 text-sm text-white/90">
          Monitor active and approved parties, review host/session details, and disable a party
          when needed.
        </p>
        <Link
          to="/admin/parties"
          className="mt-3 inline-flex min-h-[3.5rem] w-full touch-manipulation items-center justify-center rounded-2xl bg-cyan-400 px-4 text-center text-lg font-extrabold text-slate-900 no-underline shadow-lg transition active:scale-[0.99] sm:w-auto"
        >
          Open party monitor
        </Link>
      </div>
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
        <h3 className="text-lg font-black text-amber-100">Legacy manual reviews</h3>
        <p className="mt-1 text-sm text-white/90">
          New host-created parties are auto-approved. This queue is only for historical/manual
          entries that still need review.
        </p>
        <Link
          to="/admin/party-requests"
          className="mt-3 inline-flex min-h-[3rem] touch-manipulation items-center justify-center rounded-2xl border-2 border-amber-200/50 bg-amber-500/10 px-4 text-center text-base font-extrabold text-amber-100 no-underline"
        >
          Open legacy review queue
        </Link>
      </div>
    </div>
  )
}
