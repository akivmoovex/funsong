-- Add missing simplified party creation field(s) without duplicating existing equivalents.
-- `event_datetime` already exists (007), and consent equivalents already exist as
-- `private_use_confirmed` + `private_use_confirmed_at` (014).
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN party_requests.location IS
  'Host-provided party location for private event planning and admin visibility.';
