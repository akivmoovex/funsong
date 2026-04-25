# Live Party V1 QA Checklist

Use this checklist for end-to-end manual verification of the live party flow.

Legend:
- Pass/Fail: fill with `PASS` or `FAIL`
- Notes: include bug details, browser/device, and party code/session

| # | Scenario | Expected Result | Pass/Fail | Notes |
|---|---|---|---|---|
| 1 | Host/admin logs in | Login succeeds and lands on host/admin area |  |  |
| 2 | Host/admin creates or opens party | Party details open without errors |  |  |
| 3 | Host/admin shows QR code | QR and join code are visible |  |  |
| 4 | Guest 1 joins from phone | Guest 1 enters lobby successfully |  |  |
| 5 | Guest 2 joins from separate browser with different name | Guest 2 enters same party successfully |  |  |
| 6 | Host/admin sees both guests | Count and guest cards show both names |  |  |
| 7 | Guests see Kahoot-style lobby | Lobby cards, status, and party info render |  |  |
| 8 | Host/admin starts party | Session status becomes `active` |  |  |
| 9 | Host/admin adds song to playlist | Song appears in host queue |  |  |
| 10 | Both guests see song in playlist | Guests see the same song/order |  |  |
| 11 | Guest requests new song | Request is accepted and pending |  |  |
| 12 | Host/admin approves song request | Request moves to approved |  |  |
| 13 | Approved song appears in playlist for all | Host + guests see updated queue |  |  |
| 14 | Guest requests control to sing | Control request created as pending |  |  |
| 15 | Host/admin approves control | Controller becomes selected guest |  |  |
| 16 | Guest singer sees Previous/Next/Finish | Controller-only controls are visible |  |  |
| 17 | Other guest does not see controls | Non-controller has no lyric controls |  |  |
| 18 | Singer taps Next | Current line advances by one |  |  |
| 19 | Host and all guests update to same lyric block | All clients show same current line number |  |  |
| 20 | Singer taps Previous | Current line decrements (not below first) |  |  |
| 21 | Host and all guests update to same lyric block | All clients stay synchronized |  |  |
| 22 | Host takes back control | Controller clears and guest loses controls |  |  |
| 23 | Guest loses control | Former controller controls disappear immediately |  |  |
| 24 | Host gives control again or controls lyrics | Host can approve new controller or operate directly |  |  |
| 25 | Singer clicks Finish Song | Song ends immediately |  |  |
| 26 | Song marked completed | Active playlist item status becomes completed |  |  |
| 27 | Control returns to host/admin | Controller is cleared; host can continue |  |  |
| 28 | Host/admin can start another song | Next song starts cleanly |  |  |
| 29 | Portrait mode works | Karaoke layout displays correctly in portrait |  |  |
| 30 | Landscape mode shows unsupported message | Rotate-to-portrait message appears |  |  |
| 31 | New host signs up from `/signup` | Host account is created and redirected to dashboard |  |  |
| 32 | Duplicate signup email is blocked | Error shown and account not created |  |  |
| 33 | New host logs in from `/login` | Login succeeds and host dashboard loads |  |  |
| 34 | Host creates party with name/location/consent (no event date in UI) | Party is created successfully; server sets timestamps |  |  |
| 35 | Host tries to create party without consent | Create is blocked with validation error |  |  |
| 36 | Host tries to create party without location | Create is blocked with validation error |  |  |
| 37 | Newly created party status | Party is immediately `approved` (no normal admin approval wait) |  |  |
| 38 | Newly created party QR availability | Join link and QR appear immediately on host detail/QR pages |  |  |
| 39 | Guest joins newly created party via QR/link | Guest enters lobby successfully |  |  |
| 40 | Admin monitor shows newly created party | Party appears in admin parties list/details |  |  |
| 41 | Admin disables party | Party status becomes `disabled` |  |  |
| 42 | Guest join after disable | Join is blocked with not-joinable response |  |  |
| 43 | Existing super admin login | Super admin login still works on `/api/auth/login` |  |  |
| 44 | Host access to admin route/API | Host is denied super-admin routes/APIs |  |  |
| 45 | Existing song/playlist/karaoke flow | Core live-party playlist + karaoke flow still works |  |  |

## 49B-49H Final QA Scenarios

| # | Scenario | Expected Result | Pass/Fail | Notes |
|---|---|---|---|---|
| 46 | Host creates party request | Request is created successfully |  |  |
| 47 | Host waiting screen | Host lands on waiting page route after create |  |  |
| 48 | Waiting auto-refresh | Status checks continue every ~5s and countdown updates |  |  |
| 49 | Admin approval redirect | Approved request redirects host to QR/detail page |  |  |
| 50 | Guest queue sync | Guest lobby shows all queued songs (not truncated) |  |  |
| 51 | No active song copy | Guest sees "Stage is open / There is no song on the main screen yet." |  |  |
| 52 | End party realtime sync | Lobby + guest playlist switch to ended screen immediately |  |  |
| 53 | Join after ended | New join attempts are blocked |  |  |
| 54 | Super admin burger menu | Menu shows Dashboard/Songs/Parties/Settings/Logout |  |  |
| 55 | Settings save | Settings page loads and saves all 3 values |  |  |
| 56 | New max guests applied | New party session uses updated max guest limit |  |  |
| 57 | New max songs applied | Queue add and song-request approval block at cap |  |  |
| 58 | Queue full copy | Host sees exact message "Song queue is full." |  |  |
| 59 | Auto-close timeout | Approved/active party auto-closes after configured timeout |  |  |
| 60 | Auto-close guest state | Guests receive ended state and interactions are blocked |  |  |

## Quick Regression Notes

- Verify control requests and song requests remain separated in host panels.
- Verify taking back control does not reject/erase pending song requests.
- Verify a pending song request does not block a guest from requesting control.
- Verify new host party creation does not require manual admin approval.
- Verify admin legacy review queue is optional/manual, not required for normal host parties.

## 50B-50G Signed-In User QA Scenarios

| # | Scenario | Expected Result | Pass/Fail | Notes |
|---|---|---|---|---|
| 61 | New host signs up | Account is created and session starts |  |  |
| 62 | Signup success popup appears | Dialog shows with 5-second border countdown |  |  |
| 63 | Popup close behavior | Auto-close after 5s or manual close keeps user on dashboard |  |  |
| 64 | Authenticated burger menu | Menu appears only when signed in |  |  |
| 65 | Menu profile item | First row shows avatar chip, display name, and email |  |  |
| 66 | Profile route open | Profile item navigates to `/account/profile` |  |  |
| 67 | Profile edit save | First/last/phone/email/avatar persist successfully |  |  |
| 68 | Profile email uniqueness | Duplicate email update is blocked |  |  |
| 69 | Profile avatar validation | Invalid avatar key is rejected |  |  |
| 70 | Password change (wrong current) | Change is rejected |  |  |
| 71 | Password change (correct current) | Password updates and next login uses new password |  |  |
| 72 | Logout flow | Logout remains last menu item and returns to homepage |  |  |
| 73 | My Songs empty state | Friendly empty message shown before favorites |  |  |
| 74 | Favorite song add | Host can favorite from authenticated song cards |  |  |
| 75 | Favorite appears in My Songs | Added favorite appears only for current user |  |  |
| 76 | Practice open | `Play / Practice` opens practice route for favorite |  |  |
| 77 | Practice karaoke reuse | Existing karaoke audio component is reused (no party socket) |  |  |
| 78 | Practice lyric modes | 2-line/4-line modes both work |  |  |
| 79 | Practice language toggle | English/Hindi/Hebrew lyric selection works |  |  |
| 80 | Favorite remove | Removing favorite updates My Songs list immediately |  |  |
| 81 | Failed login attempts 1-2 | Forgot-password link remains hidden |  |  |
| 82 | Failed login attempt 3 | Forgot-password link becomes visible |  |  |
| 83 | Forgot-password submit | Neutral response always shown (existing/non-existing email) |  |  |
| 84 | Super admin reset queue | Super admin can open pending password reset requests page |  |  |
| 85 | Host admin access guard | Host cannot access super-admin pages/APIs |  |  |

## 51B–51H Final QA Scenarios (host queue, join, leave, suggestions)

Run DB migrations before this pass (includes `021_party_playlist_requested_by_guest.sql` for guest-requested queue labels).

Automation note: this repository currently ships an integration fallback (`npm run test:e2e`) using Vitest + supertest (`server/livePartyReleaseHardening.e2e.test.mjs`). Full browser E2E (Playwright/Cypress with multiple real browser contexts and websocket timing) is deferred to keep release hardening non-invasive.

| # | Scenario | Expected Result | Pass/Fail | Notes |
|---|----------|-----------------|-----------|-------|
| 86 | Homepage join code form | “Join Party” section with code field and submit appears on `/` |  |  |
| 87 | Homepage valid code | Submitting a valid code navigates to `/join/:code` (trimmed) |  |  |
| 88 | Guest join via QR/link | `/join/:partyCode` join flow still works as before |  |  |
| 89 | Guest leave party | Leave succeeds, cookie cleared, guest lands on home |  |  |
| 90 | Host presence after guest leave | `guests:updated` lowers count; departed guest not in connected list |  |  |
| 91 | Host queue add two songs | Both appear in order |  |  |
| 92 | Host reorder (move up) | Order updates immediately |  |  |
| 93 | Reorder persistence | Same order after ~1s and after full page refresh |  |  |
| 94 | Guest queue order | Guest lobby/playlist pages match host order |  |  |
| 95 | Host start party | Session becomes `active` |  |  |
| 96 | Host start first song | Lyrics area shows current lines (or explicit no-lyrics message) |  |  |
| 97 | Guest lyrics | Guest lobby shows same lyric state / no-lyrics message |  |  |
| 98 | Guest request control | Pending control request created; host panel lists it |  |  |
| 99 | Host approve control | Controller becomes that guest; guest gets on-screen controls when applicable |  |  |
| 100 | Guest available songs | Authenticated guest can open list (published, non-blocked only) |  |  |
| 101 | Guest lyric preview | Preview loads lines for chosen language |  |  |
| 102 | Guest suggest song | Suggestion appears on host with guest name + time |  |  |
| 103 | Host approve suggestion | Song enters queue with “Requested by (guest name)” |  |  |
| 104 | All clients queue sync | Host + guests see `playlist:updated` / refresh consistent |  |  |
| 105 | Host end party | Guests see ended UI; joins blocked |  |  |
| 106 | Playlist refresh after end | If `playlist:updated` runs while party is ended, lobby shows ended state (playlist API `403 not_available`) |  |  |
| 107 | Super admin | Existing super-admin login and guarded routes unchanged |  |  |
| 108 | Profile / My Songs / signup | Existing account flows still work |  |  |

## 53B–53H: Logout, mobile nav, busy overlay, party create, QR, join code

| # | Scenario | Expected Result | Pass/Fail | Notes |
|---|----------|-----------------|-----------|-------|
| 109 | Host login | Login succeeds; lands on home/host dashboard as usual |  |  |
| 110 | Host logout | Session clears; user lands on homepage; no stale host UI |  |  |
| 111 | Mobile: top link row | `Home` / `Join` / `Host` are hidden in the main top bar; burger exposes them |  |  |
| 112 | Mobile burger | Contains Home, Join Party, Host/Admin/Login in role order; **Logout** is last if shown |  |  |
| 113 | Create party form | No event date/time field; single consent as checkbox label; submit blocked without consent |  |  |
| 114 | New party | Creating a new party ends other open host parties (per server rules) |  |  |
| 115 | Party details | No “N guests expected” (or similar) for host-created flow |  |  |
| 116 | Host QR | Alphabet party code and scannable QR visible when code is available; no broken image when code fails to load |  |  |
| 117 | Join by code | From home and `/join`, code submits to `/join/:code`; trim whitespace; friendly error on bad code |  |  |
| 118 | Slow action (>1s) | Global busy overlay: dim + animated music notes; dismisses on success or failure |  |  |
| 119 | Regression | Existing party / playlist / song / karaoke flow unchanged |  |  |
