-- Global app-level settings (party limits, auto-close window, etc.)

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  value_type text NOT NULL DEFAULT 'string',
  description text,
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings (updated_at DESC);

COMMENT ON TABLE app_settings IS 'Global key-value settings for runtime behavior.';
COMMENT ON COLUMN app_settings.value_type IS
  'Type hint for value parsing (e.g. string, integer, boolean).';

INSERT INTO app_settings (key, value, value_type, description)
VALUES
  ('max_party_guests', '30', 'integer', 'Maximum number of guests allowed in a party.'),
  ('max_playlist_songs', '10', 'integer', 'Maximum number of songs allowed in a party playlist.'),
  ('party_auto_close_minutes', '300', 'integer', 'Minutes before open parties auto-close.')
ON CONFLICT (key) DO NOTHING;
