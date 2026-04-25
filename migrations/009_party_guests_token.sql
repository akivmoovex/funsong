-- Opaque token for unauthenticated party guests (HTTP-only cookie)
ALTER TABLE party_guests
  ADD COLUMN IF NOT EXISTS guest_token text;

UPDATE party_guests
  SET guest_token = encode(gen_random_bytes(32), 'hex')
  WHERE guest_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_party_guests_guest_token
  ON party_guests (guest_token) WHERE guest_token IS NOT NULL;

ALTER TABLE party_guests
  ALTER COLUMN guest_token SET NOT NULL;
