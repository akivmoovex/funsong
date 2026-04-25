import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../src/db/pool.mjs'
import { runMigrationsFromDir } from '../src/db/runMigrations.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '../../migrations')

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
    console.log('[funsong] Migrations: starting')
    await runMigrationsFromDir(pool, migrationsDir)
    console.log('[funsong] Migrations: completed successfully')
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Migration failed:', m)
    process.exit(1)
  } finally {
    await pool.end()
  }
  process.exit(0)
}

await main()
