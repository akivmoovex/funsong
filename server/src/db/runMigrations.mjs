import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const SELECT_APPLIED = 'SELECT name FROM schema_migrations ORDER BY name'

export function listMigrationFileNames(fileNames) {
  return fileNames
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

export async function getAppliedMigrationsSet(pool) {
  try {
    const { rows } = await pool.query(SELECT_APPLIED)
    return new Set(rows.map((r) => r.name))
  } catch (e) {
    const err = /** @type {{ code?: string; message?: string }} */ (e)
    if (err.code === '42P01') {
      return new Set()
    }
    const m = (err.message || '').toLowerCase()
    if (m.includes('schema_migrations') && m.includes('does not exist')) {
      return new Set()
    }
    throw e
  }
}

async function applyOneMigrationInTransaction(pool, name, sql) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function runMigrationsFromDir(
  pool,
  migrationsDir,
  fs = { readdir, readFile }
) {
  const all = listMigrationFileNames(await fs.readdir(migrationsDir))
  const applied = await getAppliedMigrationsSet(pool)

  for (const name of all) {
    if (applied.has(name)) {
      continue
    }
    const full = path.join(migrationsDir, name)
    const sql = await fs.readFile(full, 'utf8')
    await applyOneMigrationInTransaction(pool, name, sql)
    applied.add(name)
  }
}
