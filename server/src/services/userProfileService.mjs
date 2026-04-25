import { hashPassword } from '../auth/password.mjs'
import { isBuiltInAvatarKey } from '../constants/avatarKeys.mjs'
import {
  updateUserProfile as updateUserProfileRepo,
  updateUserPassword as updateUserPasswordRepo
} from '../db/repos/usersRepo.mjs'

/**
 * @param {string} userId
 * @param {{
 *  firstName?: string | null
 *  lastName?: string | null
 *  phoneNumber?: string | null
 *  email?: string | null
 *  avatarKey?: string | null
 * }} profile
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function updateUserProfile(userId, profile, p) {
  if (Object.prototype.hasOwnProperty.call(profile, 'avatarKey')) {
    const avatarKey = profile.avatarKey
    if (avatarKey != null && String(avatarKey).trim() !== '' && !isBuiltInAvatarKey(avatarKey)) {
      const e = new Error('invalid_avatar_key')
      // @ts-ignore internal testing/route code
      e.code = 'invalid_avatar_key'
      throw e
    }
  }
  return updateUserProfileRepo(userId, profile, p)
}

/**
 * @param {string} userId
 * @param {string} plainPassword
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function updateUserPassword(userId, plainPassword, p) {
  const raw = String(plainPassword || '')
  if (raw.length < 8) {
    const e = new Error('password_too_short')
    // @ts-ignore internal testing/route code
    e.code = 'password_too_short'
    throw e
  }
  const passwordHash = hashPassword(raw)
  return updateUserPasswordRepo(userId, passwordHash, p)
}
