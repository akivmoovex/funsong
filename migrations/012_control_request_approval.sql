-- Who approved a control request and when; used for host approval flow.

ALTER TABLE control_requests
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_control_requests_approved_by ON control_requests (approved_by_user_id)
  WHERE approved_by_user_id IS NOT NULL;

COMMENT ON COLUMN control_requests.approved_by_user_id IS 'Host (or super admin) who approved; null for pending/rejected.';
