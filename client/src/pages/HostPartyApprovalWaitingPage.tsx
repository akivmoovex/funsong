import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type WaitingStatusResponse = {
  request: {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    partyName: string
    eventDatetime: string | null
    location?: string | null
    rejectionReason?: string | null
    redirectPath?: string | null
  }
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function HostPartyApprovalWaitingPage() {
  const { partyId } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState<WaitingStatusResponse['request'] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [secondsToPoll, setSecondsToPoll] = useState(5)

  useEffect(() => {
    if (!partyId || !UUID_RE.test(partyId)) {
      setErr('invalid_id')
      return
    }
    let cancelled = false
    let timer = /** @type {number | null} */ (null)

    async function loadStatus() {
      try {
        const r = await fetch(`/api/host/party-requests/${encodeURIComponent(partyId)}/status`, {
          credentials: 'include'
        })
        const d = (await r.json().catch(() => ({}))) as
          | WaitingStatusResponse
          | { error?: string }
        if (!r.ok) {
          if (!cancelled) setErr((d as { error?: string }).error || 'load_failed')
          return
        }
        const req = (d as WaitingStatusResponse).request
        if (!req) {
          if (!cancelled) setErr('load_failed')
          return
        }
        if (cancelled) return
        setData(req)
        setErr(null)
        if (req.status === 'approved') {
          nav(req.redirectPath || `/host/parties/${partyId}/qr`, { replace: true })
          return
        }
        if (req.status === 'rejected' && req.redirectPath) {
          nav(req.redirectPath, { replace: true })
          return
        }
      } catch {
        if (!cancelled) setErr('network')
      }
    }

    void loadStatus()
    timer = window.setInterval(() => {
      void loadStatus()
    }, 5000)

    return () => {
      cancelled = true
      if (timer != null) window.clearInterval(timer)
    }
  }, [partyId, nav])

  useEffect(() => {
    if (!data || data.status !== 'pending') {
      return
    }
    setSecondsToPoll(5)
    const ticker = window.setInterval(() => {
      setSecondsToPoll((prev) => (prev <= 1 ? 5 : prev - 1))
    }, 1000)
    return () => {
      window.clearInterval(ticker)
    }
  }, [data?.status])

  const canShowWaiting = useMemo(() => data?.status === 'pending', [data?.status])

  if (!partyId || !UUID_RE.test(partyId)) {
    return (
      <div className="fs-card text-left text-sm text-white/80">Invalid party request id.</div>
    )
  }

  return (
    <div className="fs-card max-w-xl space-y-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-black">Party approval</h2>
        <Link to="/host/dashboard" className="text-sm font-bold text-fuchsia-300 hover:text-fuchsia-200">
          Back to dashboard
        </Link>
      </div>

      {err && (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          Could not load approval status ({err}).
        </p>
      )}

      {!data && !err && (
        <p className="text-sm text-white/80">Checking status…</p>
      )}

      {data && (
        <>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-white/60">Party</p>
            <p className="text-lg font-extrabold text-white">{data.partyName}</p>
            <p className="mt-1 text-sm text-white/80">{formatWhen(data.eventDatetime)}</p>
            {data.location ? <p className="text-sm text-white/75">Location: {data.location}</p> : null}
          </div>

          {canShowWaiting && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-300/25 text-2xl animate-[pulse_1.4s_ease-in-out_infinite]"
                >
                  ⏳
                </span>
                <div>
                  <p className="font-extrabold text-amber-100">Waiting for admin approval</p>
                  <p className="text-sm text-white/85">Checking again in {secondsToPoll} seconds...</p>
                </div>
              </div>
            </div>
          )}

          {data.status === 'rejected' && (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4">
              <p className="font-extrabold text-rose-100">Request rejected</p>
              <p className="mt-1 text-sm text-white/90">
                {data.rejectionReason?.trim() || 'No rejection reason was provided.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
