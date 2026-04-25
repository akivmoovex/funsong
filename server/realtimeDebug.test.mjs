import { afterEach, describe, expect, it, vi } from 'vitest'
import { logRealtimeEvent } from './src/services/realtimeDebug.mjs'

describe('realtime debug logging', () => {
  afterEach(() => {
    delete process.env.REALTIME_DEBUG
    vi.restoreAllMocks()
  })

  it('does not log when REALTIME_DEBUG is not true', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    logRealtimeEvent('playlist:updated', { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
    expect(info).not.toHaveBeenCalled()
  })

  it('logs compact structured payload when REALTIME_DEBUG=true', () => {
    process.env.REALTIME_DEBUG = 'true'
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    logRealtimeEvent('control:approved', {
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      count: 2
    })
    expect(info).toHaveBeenCalledWith(
      '[realtime:debug]',
      expect.objectContaining({
        event: 'control:approved',
        sessionId: 'aaaaaaaa',
        requestId: 'bbbbbbbb',
        count: 2
      })
    )
  })
})

