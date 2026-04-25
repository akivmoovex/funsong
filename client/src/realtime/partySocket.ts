import { io, type Socket } from 'socket.io-client'

export type PartySocketRole = 'guest' | 'host' | 'admin'

export type CreatePartySocketOptions = {
  /** Party session id (UUID from `party_sessions.id`) */
  partySessionId: string
  role: PartySocketRole
  /** Opaque guest token; required for `guest` (same as `fs_guest` cookie) */
  guestToken?: string
  /**
   * Base URL for the API (e.g. `http://127.0.0.1:3000` or same-origin in dev).
   * Default: `undefined` (current origin; Vite proxies `/socket.io` to the server).
   */
  url?: string
  withCredentials?: boolean
}

/**
 * Connects to the party Socket.IO namespace with the same path as the server (`/socket.io`).
 * Send `auth` with `partySessionId` and `role` (and `guestToken` for guests).
 */
export function createPartySocket(o: CreatePartySocketOptions): Socket {
  return io(o.url, {
    path: '/socket.io',
    withCredentials: o.withCredentials !== false,
    autoConnect: true,
    auth: {
      partySessionId: o.partySessionId,
      role: o.role,
      ...(o.role === 'guest' && o.guestToken ? { guestToken: o.guestToken } : {})
    }
  })
}
