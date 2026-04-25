-- FunSong V1: enums, tables, foreign keys, updated_at triggers.
-- Idempotent: uses IF NOT EXISTS for extension only; other objects assume first run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --- Enum types -------------------------------------------------------------
DO $init$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('super_admin', 'host');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_request_status') THEN
    CREATE TYPE party_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_session_status') THEN
    CREATE TYPE party_session_status AS ENUM ('approved', 'active', 'ended', 'disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'playback_status') THEN
    CREATE TYPE playback_status AS ENUM ('idle', 'playing', 'paused', 'finished');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lyric_language') THEN
    CREATE TYPE lyric_language AS ENUM ('english', 'hindi', 'hebrew');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'song_status') THEN
    CREATE TYPE song_status AS ENUM ('draft', 'published', 'disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rights_status') THEN
    CREATE TYPE rights_status AS ENUM (
      'private_instrumental',
      'owned_by_app',
      'permission_pending',
      'licensed',
      'blocked'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'control_request_status') THEN
    CREATE TYPE control_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$init$;

-- --- users ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(trim(email)) > 0),
  password_hash text,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  role user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
  ON users (lower((email)));

-- --- songs -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  status song_status NOT NULL DEFAULT 'draft',
  rights_status rights_status NOT NULL DEFAULT 'private_instrumental',
  instrumental_audio_path text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_songs_created_by ON songs (created_by);
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs (status);

-- --- song_tags ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS song_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (length(trim(tag)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_song_tags_song_lower_tag
  ON song_tags (song_id, lower((tag)));

CREATE INDEX IF NOT EXISTS idx_song_tags_song_id ON song_tags (song_id);

-- --- lyric_lines ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lyric_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
  line_index integer NOT NULL CHECK (line_index >= 0),
  language lyric_language NOT NULL,
  line_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lyric_line_slot UNIQUE (song_id, line_index, language)
);

CREATE INDEX IF NOT EXISTS idx_lyric_lines_song_id ON lyric_lines (song_id);
CREATE INDEX IF NOT EXISTS idx_lyric_lines_song_line ON lyric_lines (song_id, line_index);

-- --- party_requests ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS party_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status party_request_status NOT NULL DEFAULT 'pending',
  message text,
  reviewed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_party_requests_host_id ON party_requests (host_id);
CREATE INDEX IF NOT EXISTS idx_party_requests_status ON party_requests (status);

-- --- party_sessions (no FK to party_guests yet) -------------------------------
CREATE TABLE IF NOT EXISTS party_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_request_id uuid NOT NULL REFERENCES party_requests (id) ON DELETE RESTRICT,
  host_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status party_session_status NOT NULL DEFAULT 'approved',
  playback_status playback_status NOT NULL DEFAULT 'idle',
  max_guests integer NOT NULL DEFAULT 30 CHECK (max_guests >= 1 AND max_guests <= 100),
  title text,
  join_code text UNIQUE,
  current_controller_party_guest_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_party_session_request UNIQUE (party_request_id)
);

CREATE INDEX IF NOT EXISTS idx_party_sessions_host_id ON party_sessions (host_id);
CREATE INDEX IF NOT EXISTS idx_party_sessions_status ON party_sessions (status);

-- --- party_guests ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS party_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES party_sessions (id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  language_preference lyric_language NOT NULL,
  is_connected boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_party_guests_session_id ON party_guests (session_id);

-- link controller to guest (after party_guests exists)
ALTER TABLE party_sessions
  DROP CONSTRAINT IF EXISTS fk_party_sessions_controller,
  ADD CONSTRAINT fk_party_sessions_controller
    FOREIGN KEY (current_controller_party_guest_id)
    REFERENCES party_guests (id)
    ON DELETE SET NULL;

-- --- party_playlist_items ---------------------------------------------------
CREATE TABLE IF NOT EXISTS party_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES party_sessions (id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs (id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_party_playlist_position UNIQUE (session_id, position)
);

CREATE INDEX IF NOT EXISTS idx_playlist_session ON party_playlist_items (session_id);
CREATE INDEX IF NOT EXISTS idx_playlist_song ON party_playlist_items (song_id);

-- --- control_requests --------------------------------------------------------
CREATE TABLE IF NOT EXISTS control_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES party_sessions (id) ON DELETE CASCADE,
  party_guest_id uuid NOT NULL REFERENCES party_guests (id) ON DELETE CASCADE,
  status control_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_requests_session ON control_requests (session_id);
CREATE INDEX IF NOT EXISTS idx_control_requests_guest ON control_requests (party_guest_id);
CREATE INDEX IF NOT EXISTS idx_control_requests_status ON control_requests (status);

-- --- party_events -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS party_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES party_sessions (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_by_party_guest_id uuid REFERENCES party_guests (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_party_events_session_id ON party_events (session_id);
CREATE INDEX IF NOT EXISTS idx_party_events_type ON party_events (event_type);

-- --- updated_at helper ------------------------------------------------------
CREATE OR REPLACE FUNCTION funsong_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --- updated_at triggers (relevant tables) -----------------------------------
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();

DROP TRIGGER IF EXISTS trg_songs_updated_at ON songs;
CREATE TRIGGER trg_songs_updated_at
BEFORE UPDATE ON songs FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();

DROP TRIGGER IF EXISTS trg_lyric_lines_updated_at ON lyric_lines;
CREATE TRIGGER trg_lyric_lines_updated_at
BEFORE UPDATE ON lyric_lines FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();

DROP TRIGGER IF EXISTS trg_party_requests_updated_at ON party_requests;
CREATE TRIGGER trg_party_requests_updated_at
BEFORE UPDATE ON party_requests FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();

DROP TRIGGER IF EXISTS trg_party_sessions_updated_at ON party_sessions;
CREATE TRIGGER trg_party_sessions_updated_at
BEFORE UPDATE ON party_sessions FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();

DROP TRIGGER IF EXISTS trg_party_guests_updated_at ON party_guests;
CREATE TRIGGER trg_party_guests_updated_at
BEFORE UPDATE ON party_guests FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();

DROP TRIGGER IF EXISTS trg_playlist_items_updated_at ON party_playlist_items;
CREATE TRIGGER trg_playlist_items_updated_at
BEFORE UPDATE ON party_playlist_items FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();

DROP TRIGGER IF EXISTS trg_control_requests_updated_at ON control_requests;
CREATE TRIGGER trg_control_requests_updated_at
BEFORE UPDATE ON control_requests FOR EACH ROW
EXECUTE PROCEDURE funsong_set_updated_at();
