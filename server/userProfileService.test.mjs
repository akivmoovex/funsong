import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as usersRepo from './src/db/repos/usersRepo.mjs'
import { updateUserPassword, updateUserProfile } from './src/services/userProfileService.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    updateUserProfile: vi.fn(),
    updateUserPassword: vi.fn()
  }
})

const { updateUserProfile: updateUserProfileRepo, updateUserPassword: updateUserPasswordRepo } = usersRepo

describe('userProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid avatar key', async () => {
    await expect(
      updateUserProfile(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        { avatarKey: 'https://example.com/avatar.png' },
        /** @type {any} */ ({})
      )
    ).rejects.toMatchObject({ code: 'invalid_avatar_key' })
    expect(updateUserProfileRepo).not.toHaveBeenCalled()
  })

  it('profile fields can be updated', async () => {
    updateUserProfileRepo.mockResolvedValueOnce({ id: 'u1', first_name: 'A' })
    const out = await updateUserProfile(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        firstName: 'A',
        lastName: 'B',
        phoneNumber: '12345',
        avatarKey: 'spark-mic'
      },
      /** @type {any} */ ({})
    )
    expect(out).toEqual({ id: 'u1', first_name: 'A' })
    expect(updateUserProfileRepo).toHaveBeenCalledTimes(1)
  })

  it('updateUserPassword hashes and stores password', async () => {
    updateUserPasswordRepo.mockResolvedValueOnce({ id: 'u1' })
    const out = await updateUserPassword(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'very-secure-password',
      /** @type {any} */ ({})
    )
    expect(out).toEqual({ id: 'u1' })
    const args = updateUserPasswordRepo.mock.calls[0]
    expect(args[0]).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(String(args[1])).toMatch(/^\$2[abxy]\$/)
  })
})
