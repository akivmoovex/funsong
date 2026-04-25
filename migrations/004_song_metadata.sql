-- Optional metadata + difficulty for admin song library

DO $d$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'song_difficulty') THEN
    CREATE TYPE song_difficulty AS ENUM ('easy', 'medium', 'hard', 'expert');
  END IF;
END
$d$;

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS movie_name text,
  ADD COLUMN IF NOT EXISTS original_artist text,
  ADD COLUMN IF NOT EXISTS composer text,
  ADD COLUMN IF NOT EXISTS lyricist text,
  ADD COLUMN IF NOT EXISTS year smallint,
  ADD COLUMN IF NOT EXISTS difficulty song_difficulty,
  ADD COLUMN IF NOT EXISTS is_default_suggestion boolean NOT NULL DEFAULT false;

DO $y$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_year_chk') THEN
    ALTER TABLE songs
      ADD CONSTRAINT songs_year_chk
      CHECK (year IS NULL OR (year >= 1000 AND year <= 3000));
  END IF;
END
$y$;

CREATE INDEX IF NOT EXISTS idx_songs_selectable
  ON songs (status, rights_status, is_default_suggestion, title)
  WHERE status = 'published' AND rights_status IS DISTINCT FROM 'blocked';
