-- Host-facing party request fields and admin rejection reason
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS party_name text NOT NULL DEFAULT 'Party';
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS event_datetime timestamptz;
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS expected_guests integer;
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE party_requests
  DROP CONSTRAINT IF EXISTS ck_party_requests_expected_guests,
  ADD CONSTRAINT ck_party_requests_expected_guests
    CHECK (expected_guests IS NULL OR (expected_guests >= 1 AND expected_guests <= 2000));

COMMENT ON COLUMN party_requests.rejection_reason IS 'Set by admin when request is rejected; shown to the host.';
