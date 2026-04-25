# FunSong (V1 foundation)

Private Hindi karaoke party PWA. This repo is a **Node (Express) + Vite (React) + Tailwind** stack with a PWA plugin and a `/health` JSON check for process monitors.

## Requirements

- Node **20+** (required for the current `workbox-build` / PWA toolchain; `package.json` `engines` matches this)
- **npm** (or compatible; scripts assume npm at the repo root)

## Environment Variables

- **Local development** — create `.env` or `.env.local` in the **repo root** (same directory as `package.json`). `dotenv` loads them when you run the server or scripts. `npm start` for a production-style run still uses `NODE_ENV=production` from the `start` script. Do **not** commit real values.
- **Hostinger production** — set variables in **hPanel → your site → Node.js** (or **Advanced → Environment Variables**), not only in a file on disk, unless your workflow syncs a private `.env` on the server. The running process must see `DATABASE_URL`, `SESSION_SECRET`, and `AUDIO_STORAGE_DIR` (see [Hostinger (Node) — production deployment](#hostinger-node--production-deployment)).
- **Never commit** a real `DATABASE_URL`, `SESSION_SECRET`, or `SUPER_ADMIN_PASSWORD` to GitHub. The repository only ships [`.env.example`](.env.example) with placeholders.
- **Supabase** — use a PostgreSQL URI and include **`sslmode=require`** in the query string for typical cloud connections. Get the value from the Supabase dashboard (see [Supabase connection string](#supabase-connection-string) below).
- **`SESSION_SECRET`** — long, random, and **unique per environment** (generate with a password manager or `openssl rand -base64 48`). Rotating it invalidates existing sessions.
- **After changing** Hostinger environment variables, **rebuild / redeploy** the Node app in hPanel (or restart the process) so the new values are picked up, then run migrations and smoke checks as needed.

### Hostinger `DATABASE_URL` setup

1. Open **Hostinger hPanel**.
2. Open the website’s **Node.js** app (or **Websites → Manage → Node.js**).
3. Open **Environment variables** (or **Settings & Redeploy** / **Edit** where env vars are defined).
4. Add **`DATABASE_URL`** with your **Supabase PostgreSQL** connection string (see below). Do not paste it into public tickets or commit it to the repo.
5. Add **`SESSION_SECRET`** (long random string).
6. Add **`NODE_ENV`** = `production` (or rely on the host + `npm start`, which already sets it).
7. Add **`APP_BASE_URL`** = your public site origin, e.g. `https://funsong.org` (no trailing slash; used for your own runbooks and any future app features that need the canonical URL).
8. Add **`AUDIO_STORAGE_DIR`** = an **absolute** path on the server **outside** `public_html` (see [docs/AUDIO_STORAGE_RUNBOOK.md](docs/AUDIO_STORAGE_RUNBOOK.md)).
9. **Save** and **redeploy** / **restart** the application.
10. On the server (SSH or hPanel terminal): `npm run db:migrate` with the same `DATABASE_URL` in the environment.
11. If needed: `npm run db:seed` for the super admin (one-time; see `.env.example`).
12. Verify **`GET /health`** and **`GET /health/db`** on your public origin.

### Supabase connection string

- In the Supabase project: **Project Settings → Database → Connection string** (URI). Prefer the **connection pooling** (pooler) URL when the docs recommend it for your runtime.
- The string must be valid for **PostgreSQL** (`postgresql://` or `postgres://`). For managed hosting, add **`?sslmode=require`** if it is not already in the URL.

**Shape only (placeholders; not a real password, project ref, host, or secret):**

`DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require`

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
   - A production-style run (`npm start`) **requires** non-empty `DATABASE_URL`, `SESSION_SECRET`, and an **absolute** `AUDIO_STORAGE_DIR` — the server exits on startup with a `FATAL` line if any are missing (see **Hostinger** and [docs/AUDIO_STORAGE_RUNBOOK.md](docs/AUDIO_STORAGE_RUNBOOK.md)).
   - For a production `npm start` build, `NODE_ENV=production` is set by the `start` script; Hostinger or your process manager can still set `PORT`.
   - **Rate limits** (see below): defaults apply without configuration; use `TRUST_PROXY=1` on production hosts behind a reverse proxy so per-IP limits use the real client.

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
- [docs/AUDIO_STORAGE_RUNBOOK.md](docs/AUDIO_STORAGE_RUNBOOK.md) — on-disk MP3 path, permissions, backup, and what not to commit.
- [docs/HOSTINGER_DEPLOYMENT_CHECKLIST.md](docs/HOSTINGER_DEPLOYMENT_CHECKLIST.md) — clone/build/migrate/seed/start, env checklist, health checks, first admin/host/guest smokes, rollback, common issues.

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
| `npm run audit:security` | Run `npm audit` only (optional; see **Security audit policy for V1**). **Not** part of `build` or `start`. |

## Security audit policy for V1

- **`npm run build` and `npm start` do not run `npm audit`.** Install and `postinstall` do not run it either. Deployment on Hostinger (or elsewhere) should **succeed** when `npm install` and `npm run build` complete; treat **`npm run audit:security`** as a **separate** security/compliance step, not a gate on shipping the built app.
- **Current `npm audit` may still report** findings in the **Vite 5** and **Workbox** / **`serialize-javascript`** (terser) **dev and build** dependency chains. These are **tracked build-tooling risks** (e.g. dev server / bundler advisories) and are **not** treated as blockers for a successful production **runtime** until a planned upgrade path is executed. **Runtime** concerns (e.g. Express, Postgres) are addressed on their own; do not confuse bundler advisories with live API exposure without reviewing each advisory.
- **`npm audit fix --force` is not used in this repo** by default: it can pull **major** versions (e.g. Vite 6) and **break** the PWA build. Upgrades are done in a **controlled** way with tests and a full build.
- **Planned fix path:** a **controlled migration to Vite 6** (and a compatible **vite-plugin-pwa** / Workbox line) when ready, with full `npm test` and `npm run build` validation. Until then, run **`npm run audit:security`** periodically in CI or locally and **record** any accepted risk for your org’s policy.

### Hostinger: build vs audit

- Use **Node 20+** (see `package.json` `engines`). **Recommended build command** (e.g. in hPanel or deploy script):  
  `npm install && npm run build`  
  (use `npm ci` instead of `npm install` in CI when using a fresh clone with a committed lockfile).
- **Recommended start command:** `npm start` (after env vars and `client/dist` exist).
- **Do not** add `npm audit` to the same step as the production build or start **unless** your team explicitly wants deploys to **fail** on current dev-tooling advisories. For most teams, run **`npm run audit:security`** on a schedule or in a **non-blocking** job.

## Hostinger (Node) — production deployment

**Step-by-step and smoke test checklist:** [docs/HOSTINGER_DEPLOYMENT_CHECKLIST.md](docs/HOSTINGER_DEPLOYMENT_CHECKLIST.md) (env checklist, `GET /health` / `GET /health/db`, first admin, host, guest+QR, rollback, troubleshooting).

Use this order on the server (or in CI) after cloning the repo. **In production, `DATABASE_URL`, `SESSION_SECRET`, and `AUDIO_STORAGE_DIR` (absolute) are required** — the process **exits immediately** with a clear `FATAL` message if any is missing or invalid when `NODE_ENV=production` (as set by `npm start`). Details: [docs/AUDIO_STORAGE_RUNBOOK.md](docs/AUDIO_STORAGE_RUNBOOK.md).

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
| `AUDIO_STORAGE_DIR` | Yes (production) | **Absolute** path, outside the public site root. Optional in local dev; defaults to `<repo>/data/audio` when unset. **Required** for `npm start` — see [docs/AUDIO_STORAGE_RUNBOOK.md](docs/AUDIO_STORAGE_RUNBOOK.md) |
| `MAX_AUDIO_UPLOAD_MB` | No | Default `15` |
| `SUPER_ADMIN_*` | Only for `db:seed` | Not read by the API at runtime for normal operation |
| `RATE_LIMIT_LOGIN_WINDOW_MINUTES`, `RATE_LIMIT_LOGIN_MAX` | No | Default **15** min window, **20** max POSTs to `/api/auth/login` and `/login` (stricter) |
| `RATE_LIMIT_JOIN_WINDOW_MINUTES`, `RATE_LIMIT_JOIN_MAX` | No | Default **1** min, **60** max for `POST /api/join/:partyCode`, `POST /api/party/.../request-control`, and `.../request-song` (moderate; shared counter name per IP for join and guest actions) |
| `RATE_LIMIT_*_WINDOW_MS` | No | If set, overrides the minute window for the matching bucket (e.g. tests) |
| `RATE_LIMIT_BYPASS` | No | `1` disables limits; `0` forces limits even when test tooling sets `VITEST` (used by dedicated limit tests) |

- **Rate limit response:** `429` with `{"error":"rate_limited","message":"Too many attempts. Please try again shortly."}` and a `Retry-After` header (seconds). The server does not log request bodies (passwords stay out of logs).
- Ensure `client/dist` exists before running `npm start` in production (step 3). If the directory is missing, the SPA and static assets will 404 in production.
- The server **does not** log `DATABASE_URL`, `SESSION_SECRET`, or `SUPER_ADMIN_PASSWORD`.

### MP3 / audio storage (production)

Full operations guide: **[docs/AUDIO_STORAGE_RUNBOOK.md](docs/AUDIO_STORAGE_RUNBOOK.md)** (path, permissions, disk quota, backup, manual delete/restore, what not to commit).

- **Upload API:** `POST /api/admin/songs/:songId/audio` (multipart field `file`), **super admin** session only. The SPA route is under `/admin/songs/:id/edit`; the JSON API is always under `/api/…`. Only **`.mp3`**, **MPEG/MP3** MIME, random filenames on disk, buffer sniff for likely MP3.
- **Stream API:** `GET /api/songs/:songId/audio` — same-origin, **session cookie** required. **Super admins** can preview any song that has a file. **Hosts** can stream only songs that are **published** and **not** `blocked` (same rule as the party song list). The response is `Content-Disposition: inline` (in-browser playback, not a forced file download in Express).
- **On disk:** files live under a single controlled directory (local dev default **`<repo>/data/audio`**; production: **set `AUDIO_STORAGE_DIR`** to an absolute path), in subfolders `songs/<lowercase-uuid>/…mp3`. The database stores an **opaque storage key**; **it is not returned in song JSON** (`mapSongRow`). The client only ever sees a **path-style URL** like `/api/songs/{id}/audio` — never a raw server filesystem path.
- **Set `AUDIO_STORAGE_DIR` on Hostinger** to an **absolute, writable** directory **outside** the public document root (e.g. a folder under the hosting account’s home, not `public_html`). The Node process user must be able to create directories and read/write there. `MAX_AUDIO_UPLOAD_MB` caps upload size (default 15; see `.env.example`). Run **`npm run db:migrate`** after deploy so the `005_song_audio_storage` columns exist.
- **Back up** `AUDIO_STORAGE_DIR` with the database; a restore without the files will leave songs pointing at missing objects.
