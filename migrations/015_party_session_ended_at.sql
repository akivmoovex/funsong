-- When the host ends the party intentionally (V1: POST .../end-party)
ALTER TABLE party_sessions
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

COMMENT ON COLUMN party_sessions.ended_at IS 'Set when status becomes ended (host end party or future flows).';
