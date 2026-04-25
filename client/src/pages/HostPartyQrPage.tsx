import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type QrMeta = {
  partyCode: string
  joinPath: string
  joinUrl: string
}

export function HostPartyQrPage() {
  const { partyId } = useParams()
  const [meta, setMeta] = useState<QrMeta | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copyHint, setCopyHint] = useState<string | null>(null)

  useEffect(() => {
    if (!partyId || !UUID_RE.test(partyId)) {
      return
    }
    let cancel = false
    setLoading(true)
    setLoadError(null)
    setMeta(null)
    void (async () => {
      try {
        const r = await fetch(
          `/api/host/parties/${encodeURIComponent(partyId)}/qr?format=json`,
          { credentials: 'include' }
        )
        const d = (await r.json().catch(() => ({}))) as {
          partyCode?: string
          joinPath?: string
          joinUrl?: string
          error?: string
        }
        if (cancel) {
          return
        }
        if (!r.ok || !d.partyCode?.trim()) {
          setLoadError('party_code_unavailable')
          return
        }
        setMeta({
          partyCode: d.partyCode.trim(),
          joinPath: d.joinPath || `/join/${encodeURIComponent(d.partyCode.trim())}`,
          joinUrl: d.joinUrl || ''
        })
      } catch {
        if (!cancel) {
          setLoadError('network')
        }
      } finally {
        if (!cancel) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [partyId])

  const onCopyCode = useCallback(() => {
    if (!meta?.partyCode) {
      return
    }
    void (async () => {
      try {
        await navigator.clipboard.writeText(meta.partyCode)
        setCopyHint('Copied')
        window.setTimeout(() => setCopyHint(null), 2000)
      } catch {
        setCopyHint("Couldn't copy — select the code to copy it.")
        window.setTimeout(() => setCopyHint(null), 4000)
      }
    })()
  }, [meta?.partyCode])

  if (!partyId || !UUID_RE.test(partyId)) {
    return (
      <div className="fs-card text-left text-sm text-white/80">Invalid party id.</div>
    )
  }

  const src = `/api/host/parties/${encodeURIComponent(partyId)}/qr`

  return (
    <div className="fs-card mx-auto w-full max-w-md space-y-4 text-left">
      <h2 className="text-center text-2xl font-black sm:text-left">Party QR</h2>
      <p className="text-sm text-white/80">
        Guests open this code on their phone. The QR and link use your public join path only — not your
        account.
      </p>

      {loading && (
        <p className="text-sm text-white/70" role="status">
          Loading party code…
        </p>
      )}

      {!loading && loadError && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {loadError === 'network'
            ? "Could not load the party code. Check your connection and try again."
            : 'The party code is not available yet. The party may still be preparing — refresh in a moment, or check party details.'}
        </p>
      )}

      {!loading && meta && (
        <div className="space-y-2">
          <p className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            <span className="text-white/90">Party Code: </span>
            <span
              className="font-mono text-fuchsia-200"
              data-testid="qr-party-code-value"
            >
              {meta.partyCode}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="qr-copy-party-code"
              onClick={onCopyCode}
              className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/15"
            >
              Copy code
            </button>
            {copyHint && (
              <span className="text-xs text-emerald-300" role="status">
                {copyHint}
              </span>
            )}
          </div>
        </div>
      )}

      {meta?.joinUrl ? (
        <p className="min-w-0 break-all text-sm">
          <span className="font-bold text-white/80">Join link: </span>
          <a
            href={meta.joinUrl}
            className="font-mono text-fuchsia-200 underline decoration-fuchsia-500/50 underline-offset-2 hover:text-fuchsia-100"
            data-testid="qr-join-link"
          >
            {meta.joinUrl}
          </a>
        </p>
      ) : !loading && meta && !meta.joinUrl ? (
        <p className="text-sm text-white/60">
          Join path:{' '}
          <span className="font-mono text-fuchsia-200" data-testid="qr-join-path">
            {meta.joinPath}
          </span>
        </p>
      ) : null}

      {meta && (
        <div className="mx-auto w-fit max-w-full rounded-2xl border border-white/10 bg-white p-3 sm:mx-0 sm:p-4">
          <img
            data-testid="qr-png-image"
            src={src}
            alt="QR code to join the party"
            className="h-64 w-64 max-w-full object-contain"
          />
        </div>
      )}
      {meta && (
        <p className="text-xs text-white/50">
          If the QR does not show, refresh in a moment.
        </p>
      )}
      <Link
        to={`/host/parties/${partyId}`}
        className="inline-block font-bold text-fuchsia-300 hover:text-fuchsia-200"
      >
        Back to party details
      </Link>
    </div>
  )
}
