-- First migration: tracking table for applied SQL migrations. Idempotent: safe to re-run
-- when applied_at row exists, the file is skipped by the migration runner.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
