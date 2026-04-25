-- One song per party playlist; guest song requests
ALTER TABLE party_playlist_items
  DROP CONSTRAINT IF EXISTS uq_party_playlist_session_song;
ALTER TABLE party_playlist_items
  ADD CONSTRAINT uq_party_playlist_session_song UNIQUE (session_id, song_id);

ALTER TABLE control_requests
  ADD COLUMN IF NOT EXISTS song_id uuid REFERENCES songs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_control_requests_song_id ON control_requests (song_id);

COMMENT ON COLUMN control_requests.song_id IS 'When set, guest requested this song from the party playlist.';
