# FunSong V1 — Staging manual QA

This script is for **non-technical testers** and **QA leads** validating the existing V1 product on a **staging** environment (or local `npm run dev`). It does not require reading code.

**How to use:** complete steps in order. Mark **Pass/Fail** in the last column. If something fails, note the step number, device, and what you saw (screenshot helps).

---

## 1. Staging environment (before testing)

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 1.1 | Open the staging site (or `http://localhost:5173` if your team uses local dev with `npm run dev`). | Home page loads with “Party mode” and buttons: Host / Join / Super admin / Sign in. | |
| 1.2 | Open `https://<staging-host>/health` in a browser (or `http://localhost:3000/health` if API is local). | JSON: `{"status":"ok"}`. | |
| 1.3 | Ask your developer to confirm `GET /health/db` returns `database.ok: true` on staging. | Database is reachable (developer checklist). | |

---

## 2. One-time test data setup (developer or DBA)

These steps prepare users and content **once per staging reset**. Passwords must be kept private; do not paste real secrets into this document.

### 2.1 Environment and database

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 2.1.1 | From the app repo: `cp .env.example .env`, set `DATABASE_URL` and (for production-style server) `SESSION_SECRET`. | `.env` present; app can connect to Postgres. | |
| 2.1.2 | Run `npm run db:migrate`. | Command ends with success; no “Migration failed”. | |

### 2.2 Super admin (seed script)

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 2.2.1 | Set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` in the environment and run `npm run db:seed`. | Message like “Created super admin user.” (email is not printed). | |
| 2.2.2 | Note the email and password in your team’s **private** password store only. | You can use them in §3. | |

### 2.3 Host user (not created by seed)

V1 has **no** self-service host registration. Create a **host** user in the database (one-time per staging).

1. Generate a bcrypt hash (from repo root, Node 18+):

   ```bash
   node -e "import('bcryptjs').then(m => console.log(m.default.hashSync('YOUR_HOST_PASSWORD', 12)))"
   ```

2. In `psql` (or your SQL client), run (replace values):

   ```sql
   INSERT INTO users (email, password_hash, display_name, role)
   VALUES (
     'host.staging@yourdomain.test',
     'PASTE_BCRYPT_HASH_HERE',
     'Staging Host',
     'host'
   );
   ```

3. Store the host email and password securely.

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 2.3.1 | Host user exists with `role = host`. | Host can log in (see §3.2). | |

### 2.4 Song with MP3 and lyrics (super admin in UI)

After you can log in as super admin (§3.1), in the app:

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 2.4.1 | **Admin** → **Open song library** → create a new song; fill title; save. | Song appears in list; you can open **Edit** and **Lyrics**. | |
| 2.4.2 | On the song edit page, upload a **valid `.mp3`** (small test file is fine). | Upload succeeds; audio URL or status shows attached file. | |
| 2.4.3 | Open **Lyrics** for that song; add at least two **line numbers** with text in **English**, **Hindi**, and **Hebrew** fields (use test words you can recognize, e.g. `Test EN 1`, Hindi script, `בדיקה` for Hebrew). | Lines save; preview if available shows text. | |
| 2.4.4 | **Publish** the song (or ensure it is published and not blocked) so hosts can add it. | Song is eligible for party playlist (per product rules). | |

### 2.5 Party request and approval (creates the “party” and join code)

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 2.5.1 | Log in as **host** → start a new party request; submit required fields; confirm private-use where asked. | Request appears as **pending** on host dashboard. | |
| 2.5.2 | Log in as **super admin** → **Review pending requests** → **approve** that request. | Request shows **approved**; host sees join link / QR when the room is ready. | |
| 2.5.3 | On the host’s party detail page, copy the **join link** or note the **party code** in the URL (`/join/<code>`). | You have a code to use for guest steps. | |

---

## 3. Core flow — single browser (happy path)

Use one browser; stay logged in as the right role where noted.

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 3.1 | **Super admin login:** open **Sign in**; use super admin email/password. | You reach the **Admin dashboard**; **Song library** and **Party requests** are available. | |
| 3.2 | **Sign out** (or use a private window). **Host login:** use host email/password. | You reach **Host** dashboard; can open **Request a new party** and list of parties. | |
| 3.3 | While the party is still **pending** (if you can reset one): open the host’s party detail page. | **No** working guest QR / join link until admin approves (message explains “not available yet” or similar). | |
| 3.4 | After **approval** (from §2.5): host party detail shows **join link** and **QR** (or link to full-size QR). | QR or link opens the guest **join** path. | |
| 3.5 | **Guest (incognito):** open join URL; enter a display name; choose **English**; join. | You land in the **party** room (lobby/karaoke). | |
| 3.6 | As **host** (other tab or after navigating): open **Edit playlist** for that party; **add** the test song; **start** the song. | Guests see the active song / lyrics area when connected (may need socket; see multi-device). | |
| 3.7 | As **guest:** request **control** (if the UI offers it); as **host**, **approve** control. | The approved guest is shown as the controller (“on the mic” or similar). | |
| 3.8 | As **controller guest:** use **next / previous** line controls. | Line text updates for everyone in sync. | |
| 3.9 | As a **second guest** (or same guest after release): try lyrics control **without** being controller. | Control is **denied** or no effect; no unauthorized line change. | |
| 3.10 | As **host:** **take back control** or end control per UI. | Controller clears; host can drive or end the song. | |
| 3.11 | As **host:** **end the song** (or finish track) per UI. | Song ends; state returns to idle / next song as designed. | |
| 3.12 | **Super admin** → **View parties** → open the live party → **Disable party**. | Party status shows disabled. | |
| 3.13 | **Guest (incognito):** try the old join URL again. | Join is **blocked** with an “unavailable” / disabled message. | |
| 3.14 | If a guest was **in the room** when disabled, behavior should match product: kicked or error (socket). | No further lyric/control for that party. | |

---

## 4. Multi-device (recommended)

Use the **same staging URL** on all devices (replace localhost with your staging hostname when not local).

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 4.1 | **Host: laptop** — log in as host; keep party playlist / control screen open. | Host can start song and see status. | |
| 4.2 | **Guest: phone 1** — open join link; join; keep karaoke screen open. | Connects; sees room; lyrics sync when host starts song. | |
| 4.3 | **Guest: phone 2** — join with a **different** name. | Both guests count in the room; lyrics stay in sync. | |
| 4.4 | On phone 1, request control; approve from laptop. | Phone 1 can advance lines; phone 2 cannot (unless also controller). | |

**Local dev note:** phone must reach your computer’s IP (same Wi‑Fi); use `http://<LAN-IP>:5173` and ensure the API is reachable (Vite proxy to port 3000). Staging with HTTPS avoids mixed-content issues with phones.

---

## 5. English / Hindi / Hebrew lyrics display

Run these on at least one **phone** and one **desktop** window for comparison.

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 5.1 | New guest; on join, select **English**. | Main line uses English text; falls back to other languages only if English empty (per line). | |
| 5.2 | New session or new guest; select **Hindi**. | Hindi line shows; Devanagari readable; layout not clipped. | |
| 5.3 | New session or new guest; select **Hebrew**. | Hebrew line shows; text direction feels right (right-to-left); characters not reversed or garbled. | |

---

## 6. Mobile layout (spot check)

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 6.1 | On a phone, open **home**, **join**, **party room**, and **host dashboard** (if you log in as host on mobile). | No horizontal scroll on main content; buttons tappable; text not overlapping. | |
| 6.2 | In the **karaoke** area, rotate portrait ↔ landscape. | Main line and controls remain usable. | |

---

## 7. “Party full” (optional spot check)

Not required for every run. With developer help, temporarily set `max_guests` very low in DB **or** use 31+ guest joins on a test party to assert capacity (V1 default cap is 30 **connected** phones).

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 7.1 | When the room is at capacity, a new phone tries to join. | “Party’s full” or similar; cannot join. | |

---

## 8. No public song library (quick check)

| Step | What to do | Expected result | Pass/Fail |
|------|------------|-----------------|-----------|
| 8.1 | While **signed out**, open `/songs` on the site. | **Not** a public catalog: “not found” or intentional dead-end. | |
| 8.2 | While **signed out**, call `/api/admin/songs` (developer: browser network or curl). | **401** unauthorized, not a JSON list of songs. | |

---

## 9. Automated tests (for developers, before/after release)

| Command | Expected |
|---------|----------|
| `npm test` | All tests pass (exit code 0). |
| `npm run build` | Vite build completes; `client/dist` created. |

---

## 10. Manual-only checks (not replaced by `npm test`)

- Subjective **readability** of the karaoke line (font size, contrast) in a dark room.
- **Bluetooth / speaker** latency and echo (out of app scope but affects perceived sync).
- **PWA** install and offline shell (production build only; see main README).
- **Real** MP3 and rights compliance (use only licensed test files in staging).

---

## Appendix — Flow map (what exists in V1)

| Flow | Main routes / entry |
|------|----------------------|
| Super admin login | `/login` → `/admin` |
| Host login | `/login` → `/host/dashboard` |
| Host party request | `/host/parties/new` |
| Admin approval | `/admin/party-requests` |
| QR / join link | Host: `/host/parties/:id` and `/host/parties/:id/qr` when approved |
| Guest join | `/join/:partyCode` |
| Guest room | `/party/:partyCode` (karaoke) |
| Guest browse songs | `/party/:partyCode/playlist` |
| Host playlist | `/host/parties/:partyId/playlist` |
| Admin disable party | `/admin/parties/:partyId` |

**Shortcut:** `http://<site>/host` should redirect to **`/host/dashboard`** (or login first).

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| QA | | | |
| Product / Owner | | | |
