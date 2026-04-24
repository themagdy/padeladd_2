# Phase 3 – Match System (COMPLETED)

## Overview
Phase 3 implements the core match creation and joining system.
Players can create matches (solo or with a partner), browse open matches, join solo,
or send team join requests that require partner approval.

## Database Tables Added

| Table | Description |
|---|---|
| `matches` | One row per match. Holds venue, court, datetime, creator, status |
| `match_players` | Up to 4 rows per match — team_no (1/2) × slot_no (1/2), join_type, status |
| `waiting_list` | Pending team join requests; partner must approve before slots are filled |
| `blocked_partner_requests` | Tracks block history; after 3 distinct blockers the requester is banned 1 month |
| `player_stats` | Pre-wired stats table (points=50 default); used by Phase 7 scoring |

> Schema file: `database/schema/02_matches_tables.sql`

## API Endpoints Added

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/match/create` | Create a match, optionally with a partner (team 1 pre-filled) |
| POST | `/api/match/list` | List matches — `mode: browse` (open, not joined) or `mode: mine` (user's matches) |
| POST | `/api/match/details` | Full match detail: slots + waiting list + pending requests for current user |
| POST | `/api/match/join-solo` | Join a specific or auto-chosen open slot immediately |
| POST | `/api/match/join-team` | Send a team join request (goes to waiting list, requires partner response) |
| POST | `/api/match/approve` | Partner approves → both players enter team 2 slots (or cancelled if slots gone) |
| POST | `/api/match/deny` | Partner denies → request removed from waiting list |
| POST | `/api/match/block` | Partner blocks requester; after 3 distinct blockers → 1-month global ban |

## Frontend Files Added/Updated

| File | Change |
|---|---|
| `frontend/pages/matches/create.html` | Create match form with optional partner toggle |
| `frontend/pages/matches/list.html` | Matches list with Browse / My Matches tabs |
| `frontend/pages/matches/view.html` | Match detail: slots grid, action area, waiting list |
| `frontend/js/controllers.js` | Added `MatchesController` (create, list, view, join-solo, join-team, approve, deny, block) |
| `frontend/js/router.js` | Registered `/matches`, `/matches/create`, `/matches/join`, `/matches/view/:id` |
| `frontend/css/style.css` | Added `.match-card`, `.mv-slot`, `.wl-row`, toggle switch, and responsive styles |
| `backend/api/index.php` | Registered 8 new match/* endpoints |

## Business Logic

### Solo Join
- Immediate if slot is open, match status is `open`, match is in the future
- Prevents duplicate joins and globally-blocked users
- Auto-picks first available team-2 slot if not specified

### Team Join
- Creates a `waiting_list` row with `request_status = 'pending'`
- Prevents: duplicate pending, partner already in match, requester already in match, all team-2 slots full

### Approve Flow
- Locks match row with `FOR UPDATE`
- Re-validates team-2 has 2 open slots; cancels request if gone
- Inserts both players, cancels all other pending requests for the match

### Block Logic
- Each blocker adds 1 to their own `block_count` row against the requester
- Once 3 distinct players have blocked the same user, a self-referencing sentinel row sets `blocked_until = NOW() + 1 month`
- Both `/match/join-solo` and `/match/join-team` check this global ban

## Manual Test Steps

1. Log in as User A → `/matches/create` → fill venue + datetime → Create → should land on match detail page
2. Log in as User B → `/matches` → Browse tab → click the match → "Join Solo" → should fill a slot
3. Log in as User C → `/matches` → view same match → "Join as Team" → enter Player D's code → send request
4. Log in as User D → navigate to the match URL → should see "Team Join Request" banner → Approve → both enter team 2
5. Test deny: repeat step 3-4 but choose Deny → request disappears
6. Test block: repeat and choose Block → check `blocked_partner_requests` table → after 3 blocks check `blocked_until` set

## Known Limitations / Next Phases

- **Eligibility check** (Phase 4): Currently any player may join any match. Phase 4 adds `PlayerMatchScore` eligibility gating.
- **Scoring** (Phase 7): `player_stats` table is pre-created but not updated yet — that's Phase 7's job.
- **Match score recording**: No endpoint to set `score_a/score_b` yet — Phase 4 delivers the full match rules.
- **Match cancellation**: No endpoint to cancel a match created in error — can be added in Phase 4 or Phase 5.
