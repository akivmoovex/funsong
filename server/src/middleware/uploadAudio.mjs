import multer from 'multer'

export function getMaxAudioBytes() {
  const n = Number(process.env.MAX_AUDIO_UPLOAD_MB)
  const mb =
    Number.isFinite(n) && n > 0
      ? Math.min(200, n)
      : 15
  return Math.floor(mb * 1024 * 1024)
}

/**
 * @returns {import('multer').Multer} fresh instance (respects current MAX_AUDIO_UPLOAD_MB in tests)
 */
export function getAudioUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: getMaxAudioBytes(), files: 1, fields: 20 },
    fileFilter(_req, file, cb) {
      const name = (file.originalname || '').toLowerCase()
      if (!name.endsWith('.mp3')) {
        const e = new Error('invalid_file_ext')
        e.code = 'EXT'
        return cb(e, false)
      }
      const m = (file.mimetype || '').toLowerCase().split(';')[0].trim()
      if (m !== 'audio/mpeg' && m !== 'audio/mp3') {
        const e = new Error('invalid_file_mime')
        e.code = 'MIME'
        return cb(e, false)
      }
      return cb(null, true)
    }
  })
}

/**
 * @param {unknown} err
 * @param {import('express').Response} res
 * @returns {boolean} if handled
 */
export function sendMulterError(err, res) {
  if (!err) {
    return false
  }
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'file_too_large' })
    return true
  }
  if (err.code === 'EXT' || err.code === 'MIME') {
    res.status(400).json({ error: 'invalid_audio_type' })
    return true
  }
  if (err.message === 'invalid_file_mime' || err.message === 'invalid_file_ext') {
    res.status(400).json({ error: 'invalid_audio_type' })
    return true
  }
  return false
}
