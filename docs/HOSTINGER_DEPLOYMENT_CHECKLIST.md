# Hostinger — deployment and smoke test (FunSong V1)

Use this after each deploy or when validating a new environment. It complements [PRODUCTION_DB_SETUP.md](PRODUCTION_DB_SETUP.md) (first-time Supabase/Postgres: migrate + super admin seed), [QA_STAGING_V1.md](QA_STAGING_V1.md) (deeper manual QA), and [AUDIO_STORAGE_RUNBOOK.md](AUDIO_STORAGE_RUNBOOK.md) (on-disk audio).

**Prereqs:** Node **20+** (matches `package.json` `engines`), **npm**, **Git**, PostgreSQL reachable from the app (e.g. Supabase or Hostinger DB). **Hostinger may install production `dependencies` only** before the build. **Vite, Tailwind, PWA, TypeScript, and related build packages, plus `react` / `react-dom` / `react-router-dom` for the client bundle, are in `dependencies`** in `package.json` so `npm run build` works after a production-style install. **Test** tooling (e.g. **vitest**, **supertest**) stays in **devDependencies**; use **`npm install --include=dev`** if you need to run `npm test` on the server. **Do not** require `npm audit` to pass in the same step as the production build unless you accept deploys failing on current dev-tooling advisories; use **`npm run audit:security`** separately (see README → **Security audit policy for V1**).

---

## 1. Deployment steps (run in order on the server)

| # | Action | Command / note |
|---|--------|----------------|
| 1 | **Get code** — first time clone, or deploy update with pull. | `git clone <repo-url> && cd funsong` or `cd funsong && git pull` |
| 2 | **Install and build (hPanel Build command)** | `npm install && npm run build` (or `npm ci && npm run build` with a lockfile). Vite and client build packages are in **`dependencies`**, so a production-only **install** still has what `npm run build` needs. If your panel supports it, `npm install --include=dev && npm run build` is fine too (also installs test devDependencies). |
| 3 | **Environment** | Copy from [.env.example](../.env.example): create `.env` in the app root *or* set the same keys in the Hostinger Node **environment** panel. Never commit real `.env`. |
| 4 | **If you split #2, build the frontend** | `npm run build` → outputs to `client/dist/`. If the build is skipped, the SPA and static assets **404** in production. |
| 5 | **Migrations** | `npm run db:migrate` (alias for `node server/scripts/migrate.mjs`) — needs `DATABASE_URL` set. **Empty Supabase = no users table** until this succeeds. See [PRODUCTION_DB_SETUP.md](PRODUCTION_DB_SETUP.md) for order and table verification. |
| 6 | **Migration verification** | `npm run db:check` (alias for `node server/scripts/checkMigrations.mjs`). Fails fast if required migrations are missing (for example: `021_party_playlist_requested_by_guest.sql`). |
| 7 | **Super admin (once per env or after DB reset)** | Set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` in env (see [.env.example](../.env.example)), then `npm run db:seed` (alias for `node server/scripts/seedSuperAdmin.mjs`). If seed says **users table not found**, run **step 5** first. |
| 8 | **Start / restart the Node app** | `npm start` which runs: `NODE_ENV=production node server/src/index.mjs`. Restart the process after env or code changes (use Hostinger’s Node manager or your process manager). |
| 9 | **Process manager** | Ensure the app is bound to the public port the reverse proxy uses (default app `PORT` is **3000**; proxy must forward HTTPS → Node). Set `TRUST_PROXY=1` if the proxy terminates TLS. |

**Exact production start (from [package.json](../package.json)):** `npm start` → `NODE_ENV=production` + `node server/src/index.mjs`.

---

## 2. Required environment variables (checklist)

Check these before relying on the site in production. Copy this table; tick in your runbook when satisfied.

| Variable | Required for `npm start`? | Notes |
|----------|----------------------------|--------|
| `DATABASE_URL` | **Yes** | Non-empty PostgreSQL connection string. Startup **FATAL** if missing in production. |
| `SESSION_SECRET` | **Yes** | Long random string for `express-session`. **FATAL** if missing. |
| `AUDIO_STORAGE_DIR` | **Yes** | **Absolute** path, writable, outside `public_html` / public web root. **FATAL** if missing or not absolute. See [AUDIO_STORAGE_RUNBOOK.md](AUDIO_STORAGE_RUNBOOK.md). |
| `PORT` | No | Default `3000`. |
| `TRUST_PROXY` | **Often yes** behind a reverse proxy | e.g. `1` so `req.ip` and **secure** session cookies are correct. |
| `SUPER_ADMIN_*` | For `db:seed` only | Not read for normal app behavior after seed. |
| `PARTY_SOCKET_CORS` / `CORS` | If cross-origin | Same-site Hostinger + Node on one hostname often needs nothing extra. |
| `FORCE_INSECURE_COOKIE` | **Avoid in production** | Only for broken HTTP-only tests; not for real HTTPS. |
| `REALTIME_DEBUG` | Optional | Set `REALTIME_DEBUG=true` temporarily for structured socket transition logs (`playlist:updated`, `guests:updated`, `party:ended`, `party:expired`, control/song request transitions). Keep unset in normal production use. |

**Optional:** `MAX_AUDIO_UPLOAD_MB`, `RATE_LIMIT_*` — see root [README](../README.md) and `.env.example`.

---

## 3. Health checks (automated / curl)

Run against your **public origin** (same host users use), or `https://127.0.0.1:PORT` over SSH with port forward.

| Endpoint | Expected (success) |
|----------|-------------------|
| `GET /health` | JSON: `{"status":"ok"}` (no DB). |
| `GET /health/db` | `database.configured: true` and `database.ok: true` when Postgres is reachable. If `DATABASE_URL` is not set, `database.configured` is `false` and a `message` explains. If the DB is misconfigured, `database.ok` is `false` and `message` may contain the driver error. |

**Examples:**

```bash
curl -sS "https://YOUR-DOMAIN/health"
curl -sS "https://YOUR-DOMAIN/health/db"
```

**Smoke:** If `/health` fails, the process is not listening or the proxy is wrong. If `/health` works but `/health/db` shows `ok: false`, fix `DATABASE_URL`, firewall, or allowlisting (e.g. Supabase IP or SSL mode).

---

## 4. First super admin login (smoke)

1. Confirm `db:seed` completed once with your intended `SUPER_ADMIN_EMAIL` / password.
2. In a browser, open the site (HTTPS).
3. Use **Sign in** (or the flow that posts to `POST /api/auth/login` / `POST /login` per app UI).
4. **Expected:** Session established; you can reach **admin** / super-admin areas (e.g. **Song library**, **Review party requests** per your build).

**Failure:** 401, redirect loop, or `FATAL` on server — check `SESSION_SECRET`, `DATABASE_URL`, and **HTTPS** + `TRUST_PROXY` + secure cookies (see [§9](#9-common-hostinger-issues--fixes)).

---

## 3b. Temporary realtime debug logging

When investigating live sync issues, you can temporarily enable structured realtime logs:

```bash
REALTIME_DEBUG=true npm start
```

This logs event transitions such as `playlist:updated`, `guests:updated`, `party:ended`, `party:expired`, `control:requested`, `control:approved`, `song:requested`, and `song:approved` with session/request short IDs and counts only (no tokens/secrets). Disable after diagnostics to reduce log noise.

---

## 5. First host flow (smoke)

V1 has **no** public host self-registration. After DB is up:

1. **Create a host user** in Postgres (role `host`) with a bcrypt `password_hash`, e.g. using the one-liner in [QA_STAGING_V1.md](QA_STAGING_V1.md) (§2.3).
2. **Sign in** with that host email and password.
3. **Expected:** Host dashboard; ability to **request a new party** (or see existing flow).

**Smoke minimum:** host can open host-only routes after login (use browser dev tools → Network: same-origin, cookie sent).

---

## 6. First guest + QR / join code flow (smoke)

1. As **host:** submit a party request (and complete any in-app private-use / consent step).
2. As **super admin:** open **Review pending requests** and **approve** the request.
3. As **host:** open the party; confirm **join link** and **QR** (or link to full-size QR) is shown per product UI.
4. **Guest (private/incognito):** open join URL (e.g. `/join/<partyCode>`) or scan QR into the join page; enter a display name; join.
5. **Expected:** Guest reaches the **party** room (lobby / session), not 404 or 403 from missing approval.

Deeper line-by-line QA: [QA_STAGING_V1.md](QA_STAGING_V1.md).

---

## 7. Rollback notes

| Situation | What to do |
|-----------|------------|
| **Bad deploy (code only)** | `git checkout <known-good-tag-or-branch>`, `npm install` if `package.json` changed, `npm run build`, restart `npm start`. Migrations that already ran are **not** auto-reverted — avoid destructive migrations; add forward fixes instead if needed. |
| **Bad migration** | Do **not** delete `DATABASE_URL` users’ data without a plan. Roll forward with a fix migration, or restore DB from backup taken **before** the bad migration, then align code. |
| **Client-only issue** | Revert with previous `client/dist` only if you keep a tarball; normal path is `git` revert + `npm run build` again. |
| **Config mistake** | Restore previous `.env` (from secure backup) or panel values; restart Node. **Never** commit `.env` to Git. |

Keep **database** and **AUDIO_STORAGE_DIR** backups aligned per [AUDIO_STORAGE_RUNBOOK.md](AUDIO_STORAGE_RUNBOOK.md).

---

## 7b. “Deployment failed” but `npm run build` succeeded

The repo build path is correct: Vite writes to **`client/dist`**, and Express serves **`client/dist`**. A **red** deploy in hPanel with **no `npm ERR!` in the build log** is often **not** a Vite or static-path bug.

0. **`sh: line 1: vite: command not found` during the build** — you are on an **older** `package.json` (before Vite and build packages were in **`dependencies`**) *or* `node_modules` is empty/corrupt. **Update** to a commit where `vite` is a **`dependency`**, then `npm install && npm run build` from a clean install. (See [README – Hostinger: build vs audit](../README.md#hostinger-build-vs-audit).)
1. **`npm audit` in the pipeline** — `npm audit` exits **1** when vulnerabilities are reported. If Hostinger or GitHub runs `npm install && npm audit && npm run build` (or similar), the job **fails after a successful build**. **Fix:** use `npm install && npm run build` for the build step only; run **`npm run audit:security`** in a separate, non-blocking job (see README → **Security audit policy for V1**).
2. **Start or health check without env** — if the platform runs **`npm start`** (or a health check that hits the app) **before** `DATABASE_URL`, `SESSION_SECRET`, and `AUDIO_STORAGE_DIR` are set, the process **exits immediately** with `FATAL: …`. **Fix:** set all required env vars in hPanel, then start; ensure the process **cwd** is the **repository root** (where `client/dist` and `package.json` live).
3. **Node older than 20** — `package.json` requires **Node 20+**. **Fix:** set Node **20** or **22** in the Hostinger Node.js settings.

Check server logs for **`[funsong] Node v…`** and **`FATAL:`** lines to distinguish audit vs env vs Node.

## 8. Common Hostinger issues & fixes

| Symptom | Likely cause | What to check |
|--------|---------------|---------------|
| `sh: line 1: vite: command not found` | **Stale deploy or bad `node_modules`** | Current repo: **vite** and build helpers are in **`dependencies`**. `npm install` from a clean state and run **`npm run build`**. If this persists, confirm `node_modules/.bin/vite` exists and you are on the **latest** `package.json` / lockfile. |
| `SyntaxError` / ESM / missing APIs | **Wrong Node version** | `node -v` — select Node **20+** in the panel. `engines` in [package.json](../package.json) is `>=20.0.0`. |
| `FATAL` on start / immediate exit | **Missing env** | `DATABASE_URL`, `SESSION_SECRET`, and absolute `AUDIO_STORAGE_DIR` for production. |
| 500 on upload or 500 when streaming audio | **Unwritable `AUDIO_STORAGE_DIR`** | Directory exists, owned by the Node user, not under `public_html` if you require isolation. See [AUDIO_STORAGE_RUNBOOK.md](AUDIO_STORAGE_RUNBOOK.md) (permissions). |
| `/health/db` `ok: false` or `ECONNREFUSED` / `timeout` / SSL errors | **Supabase or DB blocked/misformed** | Connection string, `?sslmode=require` if required, allow **outbound 5432** (or use pooler host on Supabase), **region** and credentials correct, IP allowlist in Supabase if you use it. |
| **Logged in but “not signed in”** on next request; auth loop | **HTTPS + proxy + cookies** | `TRUST_PROXY=1` behind a reverse proxy; `SESSION_SECRET` stable; in production, cookies are **secure** (HTTPS only) unless you incorrectly use plain HTTP. See `FORCE_INSECURE_COOKIE` only for local HTTP experiments — not for production. |
| Static assets 404 | **No build** or wrong cwd | `npm run build` and ensure `client/dist` exists in the same tree as the running process. |
| 413 on MP3 upload | **Max size** | `MAX_AUDIO_UPLOAD_MB` in env (default 15). |

---

## 9. Post-deploy one-liner (CI-friendly)

If your pipeline can run on the same host (with env):

```bash
cd funsong && npm install && npm run build && npm run db:migrate && npm test
```

(`npm test` needs **devDependencies** [vitest, etc.]. If the pipeline uses **only** `npm install --omit=dev`, add **`npm install --include=dev`** before `npm test`, or run tests in a different job with a full dev install.)

(Adjust: run tests before or after `start` per your policy; do **not** run `db:seed` in CI unless intentional.)

**Manual:** After `npm start`, confirm `curl` health (§3), then run §4–§6 once per environment or after each risky change.

---

## 10. Related links

- [README — Hostinger section](../README.md#hostinger-node--production-deployment)
- [docs/PRODUCTION_DB_SETUP.md](PRODUCTION_DB_SETUP.md) — first-time database and super admin
- [docs/AUDIO_STORAGE_RUNBOOK.md](AUDIO_STORAGE_RUNBOOK.md)
- [docs/QA_STAGING_V1.md](QA_STAGING_V1.md)
