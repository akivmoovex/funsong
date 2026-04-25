-- Preserve guest attribution for approved song suggestions.
ALTER TABLE party_playlist_items
  ADD COLUMN IF NOT EXISTS requested_by_guest_id uuid
  REFERENCES party_guests (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_party_playlist_requested_by_guest
  ON party_playlist_items (requested_by_guest_id);
