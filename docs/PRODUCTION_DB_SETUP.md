# Production database setup (Supabase / PostgreSQL)

Use this the **first time** you point FunSong at a new empty database, or after resetting the database. The app does **not** create tables on startup; you must run **migrations** and then **seed** the first super admin.

**Exact commands (from the repository root, same as [package.json](../package.json)):**

- **Migrations:** `npm run db:migrate` (runs `node server/scripts/migrate.mjs`)
- **Super admin seed:** `npm run db:seed` (runs `node server/scripts/seedSuperAdmin.mjs`)

Do **not** put real `DATABASE_URL`, `SESSION_SECRET`, or `SUPER_ADMIN_PASSWORD` in Git. Set them in **Hostinger → Node.js → Environment variables** (or a private `.env` on the server that is never committed).

---

## 1. Set `DATABASE_URL` on the host

1. In **Supabase**: **Project Settings → Database → Connection string (URI)**. Use the **direct** or **pooler** string as your deployment needs; append **`?sslmode=require`** if it is not already in the string.
2. In **Hostinger hPanel** (or your process manager), add **`DATABASE_URL`** with that value. Redeploy or restart the Node app if the panel requires it so the process sees the new variable.
3. Ensure your database allows connections from the Hostinger server (Supabase: default is often “allow all” for the pooler; use the project’s network settings if you restrict by IP).

---

## 2. Confirm the app can reach Postgres

With **`npm start`** running and `DATABASE_URL` set:

- **`GET /health`** — should return `{"status":"ok"}`.
- **`GET /health/db`** — should show `database.configured: true` and `database.ok: true` when the connection works.

If `/health/db` is not OK, fix the connection string, SSL, or firewall before running migrations.

---

## Troubleshooting: `self-signed certificate in certificate chain`

In some managed-host + pooled Postgres combinations (including some Hostinger + Supabase pooler setups), Node/pg may fail with:

`Error: self-signed certificate in certificate chain`

If that happens:

1. Keep `DATABASE_URL` as the Supabase URI and keep `sslmode=require` in it.
2. In **Hostinger → Node.js → Environment variables**, set:
   - `PGSSL_REJECT_UNAUTHORIZED=false` (exact spelling, all caps, no spaces)
3. Redeploy or restart the Node app so the environment change is applied.
4. Check startup logs for a safe diagnostic line:
   - `[funsong] DB SSL mode: rejectUnauthorized=false; PGSSL_REJECT_UNAUTHORIZED env set: true`
5. Recheck `GET /health/db`, then rerun `npm run db:migrate` / `npm run db:seed` as needed.

If the key is misspelled (for example mixed-case or with spaces), override is not applied and SSL stays at default verification behavior.

Use this override only when you hit the certificate-chain error; default behavior keeps certificate verification on.

---

## 3. Run migrations

On the **server** (SSH, hPanel **terminal**, or a one-off deploy job), from the app directory with the same `DATABASE_URL` in the environment:

```bash
npm run db:migrate
```

**Expected (success):** logs include `[funsong] Migrations: starting` and `[funsong] Migrations: completed successfully`. A non-zero exit or `Migration failed:` means the database was not fully migrated — fix the error and rerun (migrations are idempotent for already-applied files).

---

## 4. Verify tables in Supabase

In the Supabase **SQL Editor** (or any PostgreSQL client), run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see app tables (including **`users`**, **`schema_migrations`**, and others from the `migrations/` folder). If **no** `users` table appears, **do not** run the seed until migrations succeed.

---

## 5. Set super admin environment variables

In Hostinger (or the shell environment for a one-off seed), set **all three** (values are your choice; use a strong password):

- **`SUPER_ADMIN_EMAIL`**
- **`SUPER_ADMIN_PASSWORD`**
- **`SUPER_ADMIN_NAME`**

These are only used by **`npm run db:seed`**, not for normal app routing. See [.env.example](../.env.example) for placeholder shape.

---

## 6. Run the super admin seed

```bash
npm run db:seed
```

**Expected (success):** logs include `[funsong] Super admin seed: starting` and `[funsong] Super admin seed: completed successfully`. **Passwords are never printed.**

If the **`users`** table does not exist, the script exits with:

`Users table not found. Run npm run db:migrate first.`

---

## 7. Verify the super admin user

In the Supabase **SQL Editor**:

```sql
SELECT email, role, is_active, created_at
FROM users
ORDER BY created_at DESC;
```

You should see a row with `role` **`super_admin`** and the email you set.

---

## 8. Log in in the browser

1. Open **`/login?next=%2Fadmin`** (or your site’s sign-in page that posts to the same auth API).
2. Sign in with **`SUPER_ADMIN_EMAIL`** and **`SUPER_ADMIN_PASSWORD`**.

**HTTPS** and **`SESSION_SECRET`** (and often **`TRUST_PROXY=1`** behind a reverse proxy) are required for cookies to work in production — see [HOSTINGER_DEPLOYMENT_CHECKLIST.md](HOSTINGER_DEPLOYMENT_CHECKLIST.md).

---

## Reference

| Step        | Command              | Script on disk                 |
|------------|----------------------|---------------------------------|
| Migrations | `npm run db:migrate` | `server/scripts/migrate.mjs`   |
| Seed admin | `npm run db:seed`    | `server/scripts/seedSuperAdmin.mjs` |

**Related:** [README — Hostinger (Node) — production deployment](../README.md#hostinger-node--production-deployment), [HOSTINGER_DEPLOYMENT_CHECKLIST.md](HOSTINGER_DEPLOYMENT_CHECKLIST.md).
