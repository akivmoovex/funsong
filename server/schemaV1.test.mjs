import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('migrations/002_funsong_v1_core.sql', () => {
  it('declares the V1 core tables and enums (static check)', async () => {
    const p = fileURLToPath(
      new URL('../migrations/002_funsong_v1_core.sql', import.meta.url)
    )
    const sql = await readFile(p, 'utf8')
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS users/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS songs/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS song_tags/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS lyric_lines/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS party_requests/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS party_sessions/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS party_guests/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS party_playlist_items/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS control_requests/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS party_events/i)
    expect(sql).toMatch(/user_role|CREATE TYPE user_role/si)
    expect(sql).toMatch(/max_guests.*30/si)
    expect(sql).toMatch(/default 30|DEFAULT 30/si)
  })
})
