import {
  addFavoriteSong as addFavoriteSongRepo,
  isFavoriteSong as isFavoriteSongRepo,
  listFavoriteSongs as listFavoriteSongsRepo,
  removeFavoriteSong as removeFavoriteSongRepo
} from '../db/repos/userFavoriteSongsRepo.mjs'

/**
 * @param {string} userId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listFavoriteSongs(userId, p) {
  return listFavoriteSongsRepo(userId, p)
}

/**
 * @param {string} userId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function addFavoriteSong(userId, songId, p) {
  return addFavoriteSongRepo(userId, songId, p)
}

/**
 * @param {string} userId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function removeFavoriteSong(userId, songId, p) {
  return removeFavoriteSongRepo(userId, songId, p)
}

/**
 * @param {string} userId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function isFavoriteSong(userId, songId, p) {
  return isFavoriteSongRepo(userId, songId, p)
}
