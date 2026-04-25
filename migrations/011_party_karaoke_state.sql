-- Active song, playlist item status, and current lyric line for party karaoke.

DO $e$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_playlist_item_status') THEN
    CREATE TYPE party_playlist_item_status AS ENUM ('pending', 'active', 'finished');
  END IF;
END
$e$;

ALTER TABLE party_playlist_items
  ADD COLUMN IF NOT EXISTS item_status party_playlist_item_status NOT NULL DEFAULT 'pending';

ALTER TABLE party_sessions
  ADD COLUMN IF NOT EXISTS active_song_id uuid REFERENCES songs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_playlist_item_id uuid REFERENCES party_playlist_items (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_line_number integer NOT NULL DEFAULT 1 CHECK (current_line_number >= 0);

CREATE INDEX IF NOT EXISTS idx_party_sessions_active_song_id ON party_sessions (active_song_id)
  WHERE active_song_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_party_playlist_items_item_status ON party_playlist_items (session_id, item_status);

COMMENT ON COLUMN party_sessions.current_line_number IS
  'Matches lyric_lines.line_number for the line shown; set to 1 on start (or first line number if lyrics differ).';
COMMENT ON COLUMN party_playlist_items.item_status IS
  'Which playlist row is the current karaoke track (one active at a time per session).';
