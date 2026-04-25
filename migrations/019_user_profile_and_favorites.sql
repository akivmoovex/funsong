-- User profile additive fields + favorite songs mapping.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS avatar_key text;

CREATE TABLE IF NOT EXISTS user_favorite_songs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_songs_song_id
  ON user_favorite_songs (song_id);
