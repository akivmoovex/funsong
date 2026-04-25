# FunSong (V1 foundation)

Private Hindi karaoke party PWA. This repo is a **Node (Express) + Vite (React) + Tailwind** stack with a PWA plugin and a `/health` JSON check for process monitors.

## Requirements

- Node **18.18+** (use **20+** on production hosts such as Hostinger if available)
- **npm** (or compatible; scripts assume npm at the repo root)

## Local setup

1. **Clone and install**

   ```bash
   cd funsong
   npm install
   ```

2. **Environment (optional for most local dev; required for `npm start`)**

   ```bash
   cp .env.example .env
   ```

   - `PORT` (default `3000`) is used by the API server. Vite runs on `5173` in dev and proxies `GET /health` to the API.
   - A production-style run (`npm start`) **requires** non-empty `DATABASE_URL` and `SESSION_SECRET` — the server exits on startup with a `FATAL` line if they are missing (see **Hostinger** section).
   - For a production `npm start` build, `NODE_ENV=production` is set by the `start` script; Hostinger or your process manager can still set `PORT`.

3. **Run in development**

   ```bash
   npm run dev
   ```

   - React app: <http://localhost:5173>
   - API: <http://localhost:3000> (Express; includes `GET /health` → `{"status":"ok"}`)

4. **Production build (what Hostinger runs after `npm run build`)**

   ```bash
   npm run build
   npm start
   ```

   - Serves the Vite `client/dist` from Express on `PORT` in production.

5. **Tests**

   ```bash
   npm test
   ```

   Staging **manual** QA (non-technical checklist, multi-device, languages): see [docs/QA_STAGING_V1.md](docs/QA_STAGING_V1.md).

## Project layout (high level)

- `server/` — Express; `server/src/index.mjs` is the process entry, `server/src/app.mjs` exports `createApp()`.
- `client/` — Vite + React + Tailwind; build output in `client/dist/`.
- `client/public/` — static assets and PWA-related files included in the Vite public dir.

## PWA (Progressive Web App)

FunSong is installable and offline-capable for the **app shell** (static JS/CSS/HTML, icons, and manifest) via [VitePWA](https://vite-pwa-org.netlify.app/) (`client/vite.config.ts`).

- **`client/public/manifest.json`** is the source of truth for the web app manifest; the build reuses it in the PWA plugin so metadata stays single-sourced. Placeholder PWA marks are in **`pwa-192.svg`** and **`pwa-512.svg`**; replace with production PNG/SVGs when you have final brand assets.
- **Service worker** is registered from `client/src/main.tsx` **only in production** (`import.meta.env.PROD`). In development, the PWA dev server integration is **disabled** (`devOptions.enabled: false`), so there is no service worker registration and the Vite dev server, HMR, and API proxy work normally.
- **Workbox** precaches the built app shell. **`/api/*`**, **`/health`**, and **`/health/db`** use `NetworkOnly` (they are never used for “live party” or session data from the precache). Navigations use `NetworkFirst` with a short timeout so the SPA is less likely to get stuck on stale shell content while the API is never served from aggressive static caches in those routes.

After `npm run build`, open `client/dist/`, or run `npm start` and use DevTools **Application** → **Manifest** and **Service workers** to verify.

## Scripts

| Script        | What it does                                      |
|---------------|--------------------------------------------------|
| `npm run dev` | API with `node --watch` + Vite dev (with proxy)  |
| `npm run build` | Vite client production build to `client/dist`   |
| `npm start`   | `NODE_ENV=production` + `node server/src/index.mjs` |
| `npm test`    | Vitest (server `/health` + client smoke test)   |

## Hostinger (Node) — production deployment

Use this order on the server (or in CI) after cloning the repo. **In production, `DATABASE_URL` and `SESSION_SECRET` are required** — the process **exits immediately** with a clear `FATAL` message if either is missing when `NODE_ENV=production` (as set by `npm start`).

1. **Install dependencies** (from the repo root, including devDependencies — they are required for the Vite build):
   ```bash
   npm install
   ```
2. **Copy environment** — set variables in a `.env` file or the host panel (see **Required in production** below and `.env.example`). Do not log secrets; seed and migrate scripts only print high-level success or `Migration failed: <message>`.
3. **Build the client** — output goes to `client/dist/`; Express serves it when `npm start` runs:
   ```bash
   npm run build
   ```
4. **Run database migrations** (with `DATABASE_URL` set):
   ```bash
   npm run db:migrate
   ```
5. **Seed the super admin** (once per environment, or to rotate credentials) — set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_NAME`, then:
   ```bash
   npm run db:seed
   ```
6. **Start the server** — uses `package.json` `start` script (`NODE_ENV=production` + `node server/src/index.mjs`), binds `0.0.0.0`, listens on `PORT` (default `3000`):
   ```bash
   npm start
   ```
7. **Verify** — `GET /health` returns `{"status":"ok"}`; `GET /health/db` reports `database.configured` and a live `SELECT` for Postgres connectivity.

**Production start command (exactly):** `npm start` → `NODE_ENV=production node server/src/index.mjs`.

| Variable | Required in production | Notes |
|----------|------------------------|--------|
| `DATABASE_URL` | Yes | PostgreSQL URI; `getPool()` returns `null` without it (dev can skip; prod startup fails) |
| `SESSION_SECRET` | Yes | Long random string for `express-session` |
| `PORT` | No | Default `3000` |
| `TRUST_PROXY` | Often `1` behind a reverse proxy | So secure cookies and client IP are correct |
| `AUDIO_STORAGE_DIR` | No | See **MP3 / audio storage** below; default `<repo>/data/audio` |
| `MAX_AUDIO_UPLOAD_MB` | No | Default `15` |
| `SUPER_ADMIN_*` | Only for `db:seed` | Not read by the API at runtime for normal operation |

- Ensure `client/dist` exists before running `npm start` in production (step 3). If the directory is missing, the SPA and static assets will 404 in production.
- The server **does not** log `DATABASE_URL`, `SESSION_SECRET`, or `SUPER_ADMIN_PASSWORD`.

### MP3 / audio storage (production)

- **Upload API:** `POST /api/admin/songs/:songId/audio` (multipart field `file`), **super admin** session only. The SPA route is under `/admin/songs/:id/edit`; the JSON API is always under `/api/…`.
- **Stream API:** `GET /api/songs/:songId/audio` — same-origin, **session cookie** required. **Super admins** can preview any song that has a file. **Hosts** can stream only songs that are **published** and **not** `blocked` (same rule as the party song list). The response is `Content-Disposition: inline` (in-browser playback, not a forced file download in Express).
- **On disk:** files live under a single controlled directory, default **`<repo>/data/audio`**, in subfolders `songs/<lowercase-uuid>/…mp3`. The database stores an **opaque storage key** (e.g. `songs/…/….mp3`), not a host path. The client only ever sees a **path-style URL** like `/api/songs/{id}/audio` — never a filesystem path.
- **Set `AUDIO_STORAGE_DIR` on Hostinger** to an **absolute, writable** directory **outside** the public document root (e.g. a folder under the hosting account’s home, not `public_html`). The Node process user must be able to create directories and read/write there. `MAX_AUDIO_UPLOAD_MB` caps upload size (default 15; see `.env.example`). Run **`npm run db:migrate`** after deploy so the `005_song_audio_storage` columns exist.
- **Back up** `AUDIO_STORAGE_DIR` with the database; a restore without the files will leave songs pointing at missing objects.
