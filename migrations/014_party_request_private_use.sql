-- Host private-use confirmation for party requests (copyright / use responsibility)
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS private_use_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE party_requests
  ADD COLUMN IF NOT EXISTS private_use_confirmed_at timestamptz;

COMMENT ON COLUMN party_requests.private_use_confirmed IS
  'Host confirmed private friends/family event and FunSong non-ownership of original songs.';
COMMENT ON COLUMN party_requests.private_use_confirmed_at IS
  'When the host submitted the private-use confirmation (if true).';
