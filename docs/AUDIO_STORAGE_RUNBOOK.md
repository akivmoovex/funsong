# Audio storage: operations runbook (Hostinger / production)

This document covers **in-app MP3** storage: files uploaded through `POST /api/admin/songs/:songId/audio`, stored on disk, and referenced by an **opaque** key in Postgres (`songs.audio_storage_key`). The app only exposes **`/api/songs/{id}/audio`** to browsers (after session checks). **Raw server paths must never** appear in API JSON or the client.

## Recommended Hostinger path

- Use a directory **outside** the public site root (not under `public_html` or your document root), so no static rule can map URLs directly to MP3 files.
- **Example (Linux):** `/home/<account>/funsong-audio` or `/home/<account>/data/funsong-audio`
- In your host’s environment panel, set:
  - `AUDIO_STORAGE_DIR=/home/<account>/funsong-audio` (must be **absolute**; required when `NODE_ENV=production` / `npm start`).

## Permissions

- The **Linux user** that runs Node (the process for `npm start`) must be able to:
  - `mkdir` and write under `AUDIO_STORAGE_DIR` (uploads create `songs/<lowercase-uuid>/…`).
  - Read all files it wrote (streaming).
- Avoid `777`. Prefer a dedicated directory owned by that user (e.g. `chown` to the app user) with `0750` on the root and `0640` for files (the uploader already writes with `0o640` when possible).
- The web server (Apache/Nginx) user does **not** need read access to this path if the app is the only component serving audio via `GET /api/songs/.../audio`.

## Disk quota

- Each upload is capped by `MAX_AUDIO_UPLOAD_MB` (default 15). Plan for **sum of all song files** (and growth) to stay under your account disk limit; the app does not auto-prune on quota errors.
- Monitor free space; a full disk can cause failed uploads and confusing 5xx responses.

## Backup

- **Database + files together:** `audio_storage_key` in Postgres points at a relative object path under `AUDIO_STORAGE_DIR`. Backing up the DB without the files (or the reverse) leaves **orphans** (DB rows with no file, or files with no row).
- Include `AUDIO_STORAGE_DIR` in the same schedule as your DB (or restore both from the same point in time when fixing corruption).

## How to remove a song’s in-app audio file (manual / ops)

1. **In the app (preferred if available):** Re-upload replaces the on-disk file and DB fields; to clear audio entirely you may use admin flows that clear audio fields, or the steps below.
2. **On the server (manual):**
   - Find the song’s `audio_storage_key` in the database, e.g. `songs/<uuid>/<32-hex-chars>.mp3` (this is a **storage key**, not a full path).
   - Build the absolute path: `path = AUDIO_STORAGE_DIR` + `audio_storage_key` (with normal path joining).
   - `rm` that file only; then clear DB columns for that row if you need the app to show “no audio”: `audio_file_url`, `audio_storage_key`, `audio_mime_type` (via SQL or a future admin tool). **Do not** paste host paths into GitHub or tickets; use the opaque key and env name only.

## How to restore an audio backup

1. Stop the app or make uploads read-only to avoid race conditions during restore.
2. Restore the **Postgres** backup (or a consistent subset of `songs` rows).
3. Restore the **file tree** under the **same** `AUDIO_STORAGE_DIR` (or a new path if you also update `AUDIO_STORAGE_DIR` in env and re-copy all blobs).
4. Ensure ownership/permissions allow the Node user to read files.
5. Start the app and spot-check a stream: `GET /api/songs/{id}/audio` (authenticated).

## What not to commit to GitHub

- **`.env`**, or any file containing `DATABASE_URL`, `SESSION_SECRET`, or real `AUDIO_STORAGE_DIR` host paths.
- **Uploaded MP3s** and the contents of `data/audio` (or your custom `AUDIO_STORAGE_DIR`). Keep these on the server or in backups only, not in the repository.
- Do not add server-side symlinks in the repo that point production audio into a clone.

## App safety (reference)

- Uploads: **only** `.mp3` extension, **only** `audio/mpeg` / `audio/mp3`, in-memory + buffer checks for likely MP3. Stored names are **random** (`<32 hex>.mp3` under `songs/<song-uuid>/`).
- Keys from the database are matched with a **strict** pattern; paths are **resolved and confined** to `AUDIO_STORAGE_DIR` to prevent directory traversal.
- `mapSongRow` and public JSON **do not** return `audio_storage_key`; clients see **`/api/songs/.../audio`** only.

## Related env vars

| Variable | Role |
|----------|------|
| `AUDIO_STORAGE_DIR` | **Required in production** — absolute path to the storage root. |
| `MAX_AUDIO_UPLOAD_MB` | Max upload size (capped in code, default 15). |

See also: root **README** (Hostinger + MP3 section) and **`.env.example`**.
