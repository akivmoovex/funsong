import 'dotenv/config'
import { getPool } from '../src/db/pool.mjs'
import { getAppliedMigrationsSet, getMissingRequiredMigrations } from '../src/db/runMigrations.mjs'

const REQUIRED = ['021_party_playlist_requested_by_guest.sql']

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Set it in .env or the environment (see .env.example).')
    process.exit(1)
  }
  const pool = getPool()
  if (!pool) {
    console.error('No database pool (DATABASE_URL missing or invalid).')
    process.exit(1)
  }
  try {
    const applied = await getAppliedMigrationsSet(pool)
    const missing = getMissingRequiredMigrations(applied, REQUIRED)
    if (missing.length > 0) {
      for (const m of missing) {
        console.error(`Missing required migration: ${m}`)
      }
      process.exit(1)
    }
    console.log(`[funsong] Migration check passed (${REQUIRED.length} required migration${REQUIRED.length === 1 ? '' : 's'}).`)
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Migration check failed:', m)
    process.exit(1)
  } finally {
    await pool.end()
  }
  process.exit(0)
}

await main()

