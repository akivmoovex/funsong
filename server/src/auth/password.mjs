import bcrypt from 'bcryptjs'

const ROUNDS = 12

export function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), ROUNDS)
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false
  return bcrypt.compare(String(plain), String(hash))
}
