-- In-app audio: stable URL + opaque storage key (not a filesystem path); MIME for stream.

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS audio_file_url text,
  ADD COLUMN IF NOT EXISTS audio_storage_key text,
  ADD COLUMN IF NOT EXISTS audio_mime_type text;

COMMENT ON COLUMN songs.audio_file_url IS 'Public app path to stream, e.g. /api/songs/{id}/audio';
COMMENT ON COLUMN songs.audio_storage_key IS 'Relative key under AUDIO_STORAGE_DIR (opaque), never a raw OS path in API JSON';
COMMENT ON COLUMN songs.audio_mime_type IS 'e.g. audio/mpeg for streaming';
