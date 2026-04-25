CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status_requested_at
  ON password_reset_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email
  ON password_reset_requests (lower(email));
