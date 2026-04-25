/**
 * @param {Buffer} buf
 * @returns {boolean} likely MPEG / MP3 / ID3
 */
export function isLikelyMp3Buffer(buf) {
  if (!buf || buf.length < 4) {
    return false
  }
  // ID3 tag
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return true
  }
  // Frame sync: 0xFF 0xE* or common MP3
  for (let i = 0; i < Math.min(buf.length - 1, 16_000); i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      return true
    }
  }
  return false
}
