import { createReadStream, promises as fsp } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { absolutePathForStorageKey } from './paths.mjs'

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} storageKey
 * @param {string} mime
 */
export async function streamAudioFileToResponse(req, res, storageKey, mime) {
  const abs = absolutePathForStorageKey(storageKey)
  const st = await fsp.stat(abs)
  if (!st.isFile()) {
    return res.status(404).end()
  }
  const fileSize = st.size
  const m = (/** @type {string} */ (req.headers.range) || '')
    .replace(/^bytes=/, '')
    .match(/^(\d*)-(\d*)/i)
  const ct = mime || 'audio/mpeg'
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', ct)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Disposition', 'inline')

  if (m) {
    const s = m[1] ? parseInt(m[1], 10) : 0
    const e = m[2] ? parseInt(m[2], 10) : fileSize - 1
    const end = Math.min(e, fileSize - 1)
    const start = Math.min(s, end)
    if (start < 0 || end < start) {
      res.status(416).end()
      return
    }
    const chunk = end - start + 1
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
    res.setHeader('Content-Length', String(chunk))
    const stream = createReadStream(abs, { start, end })
    res.on('close', () => stream.destroy())
    return pipeline(stream, res)
  }
  res.setHeader('Content-Length', String(fileSize))
  const stream = createReadStream(abs)
  res.on('close', () => stream.destroy())
  return pipeline(stream, res)
}
