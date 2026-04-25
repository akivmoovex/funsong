-- Allow the host to let the approved guest controller stream the active track (one-device rule in the app).

ALTER TABLE party_sessions
  ADD COLUMN IF NOT EXISTS controller_audio_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN party_sessions.controller_audio_enabled IS
  'When true, the current approved controller may use /api/party/.../active-song-audio and audio socket controls.';
