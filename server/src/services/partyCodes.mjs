import { randomBytes, randomInt } from 'node:crypto'

const CH = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz' // no 0 O I l 1

/**
 * @param {import('pg').PoolClient} client
 * @param {string} [exclude]
 * @returns {Promise<string>}
 */
export async function generateUniquePartyCode(client, exclude) {
  for (let a = 0; a < 20; a++) {
    const code = randomPartyCodeOnce()
    if (exclude && code === exclude) continue
    const r = await client.query('SELECT 1 FROM party_sessions WHERE party_code = $1::text', [code])
    if (r.rowCount === 0) return code
  }
  throw new Error('could_not_alloc_party_code')
}

function randomPartyCodeOnce() {
  let s = ''
  for (let i = 0; i < 10; i++) {
    s += CH[randomInt(CH.length)]
  }
  return s
}

/**
 * Opaque join secret (not shown in the path).
 * @returns {string}
 */
export function generateJoinToken() {
  return randomBytes(32).toString('base64url')
}
