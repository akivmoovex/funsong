# Hostinger — deployment and smoke test (FunSong V1)

Use this after each deploy or when validating a new environment. It complements [QA_STAGING_V1.md](QA_STAGING_V1.md) (deeper manual QA) and [AUDIO_STORAGE_RUNBOOK.md](AUDIO_STORAGE_RUNBOOK.md) (on-disk audio).

**Prereqs:** Node **18.18+** (20+ recommended on Hostinger), **npm**, **Git**, PostgreSQL reachable from the app (e.g. Supabase or Hostinger DB). **devDependencies** are required for `npm run build` (Vite lives there).

---

## 1. Deployment steps (run in order on the server)

| # | Action | Command / note |
|---|--------|----------------|
| 1 | **Get code** — first time clone, or deploy update with pull. | `git clone <repo-url> && cd funsong` or `cd funsong && git pull` |
| 2 | **Install dependencies** (from repo root) | `npm install` |
| 3 | **Environment** | Copy from [.env.example](../.env.example): create `.env` in the app root *or* set the same keys in the Hostinger Node **environment** panel. Never commit real `.env`. |
| 4 | **Build frontend** | `npm run build` → outputs to `client/dist/`. If this step is skipped, the SPA and static assets **404** in production. |
| 5 | **Migrations** | `npm run db:migrate` — needs `DATABASE_URL` set. Must succeed with no unhandled `Migration failed`. |
| 6 | **Super admin (once per env or after DB reset)** | Set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` (see .env.example), then `npm run db:seed`. |
| 7 | **Start / restart the Node app** | `npm start` which runs: `NODE_ENV=production node server/src/index.mjs`. Restart the process after env or code changes (use Hostinger’s Node manager or your process manager). |
| 8 | **Process manager** | Ensure the app is bound to the public port the reverse proxy uses (default app `PORT` is **3000**; proxy must forward HTTPS → Node). Set `TRUST_PROXY=1` if the proxy terminates TLS. |

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

## 8. Common Hostinger issues & fixes

| Symptom | Likely cause | What to check |
|--------|---------------|---------------|
| `SyntaxError` / ESM / missing APIs | **Wrong Node version** | `node -v` → 18.18+; select Node 20+ in the panel if offered. `engines` in [package.json](../package.json) is `>=18.18`. |
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

(Adjust: run tests before or after `start` per your policy; do **not** run `db:seed` in CI unless intentional.)

**Manual:** After `npm start`, confirm `curl` health (§3), then run §4–§6 once per environment or after each risky change.

---

## 10. Related links

- [README — Hostinger section](../README.md#hostinger-node--production-deployment)
- [docs/AUDIO_STORAGE_RUNBOOK.md](AUDIO_STORAGE_RUNBOOK.md)
- [docs/QA_STAGING_V1.md](QA_STAGING_V1.md)
