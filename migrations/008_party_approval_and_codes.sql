-- Super-admin approval fields and public party codes for join URLs (not UUIDs)
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_party_requests_approved_by ON party_requests (approved_by);

ALTER TABLE party_sessions
  ADD COLUMN IF NOT EXISTS party_code text;
ALTER TABLE party_sessions
  ADD COLUMN IF NOT EXISTS join_token text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_party_sessions_party_code
  ON party_sessions (party_code) WHERE party_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_sessions_join_token
  ON party_sessions (join_token) WHERE join_token IS NOT NULL;

COMMENT ON COLUMN party_requests.approved_by IS 'Super admin who approved the request.';
COMMENT ON COLUMN party_requests.approved_at IS 'When the request was approved.';

COMMENT ON COLUMN party_sessions.party_code IS 'Short public id for /join/:partyCode (not a UUID).';
COMMENT ON COLUMN party_sessions.join_token IS 'Secret used for join validation; not the primary key.';
