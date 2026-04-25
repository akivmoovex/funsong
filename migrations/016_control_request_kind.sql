-- Distinguish control requests from song requests in shared table.
ALTER TABLE control_requests
  ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'control'
  CHECK (request_kind IN ('control', 'song'));

CREATE INDEX IF NOT EXISTS idx_control_requests_request_kind
  ON control_requests (request_kind);
