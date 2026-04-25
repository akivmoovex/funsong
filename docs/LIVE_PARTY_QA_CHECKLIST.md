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

## Quick Regression Notes

- Verify control requests and song requests remain separated in host panels.
- Verify taking back control does not reject/erase pending song requests.
- Verify a pending song request does not block a guest from requesting control.
