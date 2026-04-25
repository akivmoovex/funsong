# Super admin password reset

Use this when login fails because the seeded super admin password is unknown or outdated, and the `users` table already contains the super admin account.

## Required environment variables

- `DATABASE_URL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Do not commit real values. Set them in Hostinger environment variables or a private server `.env`.

## Command

From the repository root:

```bash
npm run db:reset-super-admin-password
```

## Behavior and safety

- Finds user by `SUPER_ADMIN_EMAIL`.
- Refuses reset if user exists but role is not `super_admin`.
- Hashes `SUPER_ADMIN_PASSWORD` with the same auth hash method used by login (`bcrypt`, rounds 12).
- Updates `password_hash`.
- Forces `is_active = true`.
- Updates `updated_at = now()` when `users.updated_at` exists.
- Never prints the password, password hash, or `DATABASE_URL`.

If no user exists for that email, the script prints:

`Super admin user not found. Run npm run db:seed first.`
