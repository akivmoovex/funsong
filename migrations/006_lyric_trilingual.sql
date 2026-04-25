-- Trilingual one row per logical line: line_number, optional timing, en/hi/he text.

DROP TRIGGER IF EXISTS trg_lyric_lines_updated_at ON lyric_lines;
DROP TABLE IF EXISTS lyric_lines;

CREATE TABLE lyric_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  line_number integer NOT NULL CHECK (line_number >= 0),
  start_time_seconds double precision,
  end_time_seconds double precision,
  text_english text NOT NULL DEFAULT '',
  text_hindi text NOT NULL DEFAULT '',
  text_hebrew text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lyric_song_line_number UNIQUE (song_id, line_number),
  CONSTRAINT chk_lyric_line_text_one_lang_min
  CHECK (
    char_length(btrim(COALESCE(text_english, ''))) > 0
    OR char_length(btrim(COALESCE(text_hindi, ''))) > 0
    OR char_length(btrim(COALESCE(text_hebrew, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_lyric_lines_song_id ON lyric_lines (song_id);
CREATE INDEX IF NOT EXISTS idx_lyric_lines_song_line ON lyric_lines (song_id, line_number);

DROP TRIGGER IF EXISTS trg_lyric_lines_updated_at ON lyric_lines;
CREATE TRIGGER trg_lyric_lines_updated_at
BEFORE UPDATE ON lyric_lines FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();
