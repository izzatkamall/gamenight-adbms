# GameNight — CLAUDE.md

**Student:** Muhammad Izzat Kamal | BSAI24078  
**Course:** Advanced DBMS — Individual Semester Project  
**Project:** GameNight — Group Video Game Night Planner

---

## Project Overview

GameNight is a database-backed web application that helps friend groups agree on a video game to play together. It solves the common problem of conflicting game libraries, differing genre preferences, and indecisive group decisions by:

- Finding which games everyone in a room actually owns in common
- Building per-user taste profiles from past play history and ratings
- Running a live real-time vote among the group on a suggested shortlist
- Logging every game night session so recommendations improve over time

**Target users:** Friend groups of 2–8 players, online gaming squads, university gaming clubs.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React (Vite) | Web UI |
| Primary DB | PostgreSQL via Supabase | Relational data + JSONB preference profiles |
| Real-time | Supabase Realtime | Auth, subscriptions, REST API |
| In-memory store | Redis | Live voting sessions (Sorted Sets) |
| Middleware | Node.js (Express) | WebSocket bridge between React and Redis |
| Auth | Supabase Auth | User registration, login, sessions |

---

## Architecture Overview

```
┌─────────────┐     Supabase JS client      ┌──────────────────────┐
│  React App  │ ◄──────────────────────────► │  Supabase (PostrgeSQL│
│  (Vite)     │   auth, DB queries,          │  + Realtime + Auth)  │
│             │   real-time subscriptions    └──────────────────────┘
│             │
│             │   WebSocket                  ┌──────────────────────┐
│             │ ◄──────────────────────────► │  Node.js middleware  │
└─────────────┘                              │  (Express + ws)      │
                                             └──────────┬───────────┘
                                                        │ Redis commands
                                             ┌──────────▼───────────┐
                                             │  Redis               │
                                             │  (Sorted Sets for    │
                                             │   live voting)       │
                                             └──────────────────────┘
```

**Data flow for live voting:**
1. React opens a WebSocket to Node.js middleware
2. Middleware writes/reads votes to Redis Sorted Sets (atomic, sub-millisecond)
3. Middleware broadcasts live vote tallies back to all room members via WebSocket
4. When voting ends, middleware persists the winner to PostgreSQL via Supabase

**Data flow for everything else:**
- React ↔ Supabase JS client directly (no custom backend needed)

---

## Repository Structure

```
gamenight/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/       # Supabase client, helpers
│   └── .env.local
├── middleware/        # Node.js WebSocket + Redis server
│   ├── index.js
│   └── .env
├── supabase/
│   └── migrations/    # SQL migration files
└── CLAUDE.md
```

---

## Implementation Guide

### Prerequisites

Before starting, install and set up:

1. **Node.js** (v18+) — for both the frontend and middleware
2. **Redis** — install locally via [Redis for Windows](https://github.com/tporadowski/redis/releases) or use Redis Cloud free tier
3. **Supabase account** — free tier at supabase.com is sufficient
4. **Git** — for version control and GitHub push

### Step 1 — Supabase Project

1. Go to supabase.com, create a new project named `gamenight`
2. Save the **Project URL** and **anon public key** from Settings → API
3. In the SQL editor, run each migration file from `supabase/migrations/` in order

### Step 2 — Redis

**Local (Windows):**
```powershell
# Download and extract Redis for Windows, then run:
redis-server
# Verify with:
redis-cli ping   # should return PONG
```

**Cloud alternative:** Use Redis Cloud free tier (30MB, no install needed). Copy the connection URL.

### Step 3 — Environment Files

**`frontend/.env.local`:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MIDDLEWARE_WS_URL=ws://localhost:4000
```

**`middleware/.env`:**
```
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
```

### Step 4 — Install Dependencies

```powershell
# Frontend
cd frontend
npm install

# Middleware
cd ../middleware
npm install
```

### Step 5 — Run Locally

```powershell
# Terminal 1: Redis (if local)
redis-server

# Terminal 2: Node.js middleware
cd middleware
node index.js

# Terminal 3: React frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` in the browser.

---

## Implementation Phases

Work through these phases in order. Each phase ends with a test checkpoint — do not move to the next phase until all tests in the current one pass.

---

### Phase 1 — Database Schema & Supabase Setup

**Goal:** PostgreSQL schema is live in Supabase with all tables, indexes, RLS policies, and seed data.

**Tables to create:**

```sql
-- Users are managed by Supabase Auth; this extends their profile
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'::jsonb   -- genre weights, avg playtime, etc.
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT[],
  min_players INT,
  max_players INT,
  avg_playtime_minutes INT,
  cover_url TEXT
);

CREATE TABLE user_libraries (
  user_id UUID REFERENCES profiles(id),
  game_id INT REFERENCES games(id),
  PRIMARY KEY (user_id, game_id)
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  host_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'open'  -- open | voting | closed
);

CREATE TABLE room_members (
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE voting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  winner_game_id INT REFERENCES games(id)
);

CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  game_id INT REFERENCES games(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  notes TEXT
);

CREATE TABLE session_ratings (
  session_id UUID REFERENCES game_sessions(id),
  user_id UUID REFERENCES profiles(id),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  PRIMARY KEY (session_id, user_id)
);
```

**Key JSONB preference schema** (stored in `profiles.preferences`):
```json
{
  "favorite_genres": ["FPS", "RPG"],
  "avg_session_minutes": 90,
  "genre_weights": { "FPS": 0.8, "RPG": 0.6, "Strategy": 0.3 },
  "total_sessions": 12
}
```

**Tasks:**
- [ ] Create Supabase project and save credentials
- [ ] Write and run all migration SQL files
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Add RLS policy: users can only read their own profile, room members can read room data
- [ ] Seed 20–30 games manually into the `games` table (title, genre, player count, playtime)
- [ ] Create a GIN index on `profiles.preferences` for fast JSONB queries

**Test checkpoint — Phase 1:**
- [ ] Open Supabase Table Editor and confirm all tables exist with correct columns
- [ ] Manually insert a test row into `games`, then delete it
- [ ] Verify RLS is ON for all tables in the Supabase dashboard
- [ ] Run: `SELECT * FROM games;` in SQL editor — seeded rows appear

---

### Phase 2 — Auth & User Profiles

**Goal:** Users can register, log in, and have a profile created automatically. Supabase Auth handles credentials; a database trigger creates the profile row.

**Tasks:**
- [ ] Enable Email auth provider in Supabase Auth settings
- [ ] Create a Postgres function + trigger that inserts into `profiles` when a new user registers in `auth.users`
- [ ] Bootstrap the React app with Vite: `npm create vite@latest frontend -- --template react`
- [ ] Install Supabase JS client: `npm install @supabase/supabase-js`
- [ ] Create `src/lib/supabase.js` that exports the initialized client
- [ ] Build a Register page (email + username + password)
- [ ] Build a Login page
- [ ] Build a simple Profile page that shows username and lets user update it
- [ ] Add route protection — unauthenticated users are redirected to Login

**Test checkpoint — Phase 2:**
> You must manually test this phase in the browser.

- [ ] Register a new account and confirm the row appears in both `auth.users` and `profiles` in Supabase
- [ ] Log out and log back in — session persists across page refresh
- [ ] Try accessing a protected route while logged out — confirm redirect to Login
- [ ] Update username on the Profile page — confirm the change in Supabase Table Editor

---

### Phase 3 — Game Library & Rooms

**Goal:** Users can add games to their personal library. A user can create a room, invite friends by username, and the system computes which games all room members have in common.

**Key query — common game library:**
```sql
SELECT g.*
FROM games g
JOIN user_libraries ul ON ul.game_id = g.id
WHERE ul.user_id IN (
  SELECT user_id FROM room_members WHERE room_id = $1
)
GROUP BY g.id
HAVING COUNT(DISTINCT ul.user_id) = (
  SELECT COUNT(*) FROM room_members WHERE room_id = $1
);
```

**Tasks:**
- [ ] Build a Game Library page — browse seeded games, toggle owned/not owned
- [ ] Wire library toggles to insert/delete rows in `user_libraries`
- [ ] Build a Create Room page — room name, then shows the room's invite link/code
- [ ] Build a Join Room page — user enters room code, gets added to `room_members`
- [ ] Build a Room Lobby page — shows all members and the computed common game list
- [ ] Run the common-library intersection query from the React client using the Supabase JS client's RPC call (wrap the query in a Postgres function)
- [ ] Host can close/archive a room (set `status = 'closed'`)

**Test checkpoint — Phase 3:**
> You must manually test this phase in the browser with at least 2 user accounts.

- [ ] Open two browser profiles (or incognito) — register two accounts
- [ ] Add different game libraries to each account with some overlap
- [ ] User A creates a room, User B joins via the room code
- [ ] Room lobby shows only the games both users own (intersection is correct)
- [ ] Verify `room_members` table in Supabase shows both users
- [ ] Check that a user NOT in the room cannot query the room data (RLS working)

---

### Phase 4 — Preference Profiles

**Goal:** Users have a JSONB preference profile in PostgreSQL. After each game session, the profile is updated. The system uses preference data to rank the common game shortlist.

**Preference update logic (run as a Postgres function after each session rating):**
```sql
-- Increment genre weight based on rating (normalized 0–1)
UPDATE profiles
SET preferences = jsonb_set(
  preferences,
  ARRAY['genre_weights', genre_key],
  to_jsonb(
    COALESCE((preferences->'genre_weights'->>genre_key)::float, 0.5)
    * 0.8 + (rating / 5.0) * 0.2   -- exponential moving average
  )
)
WHERE id = user_id;
```

**Shortlist ranking query — score games by group preference fit:**
```sql
SELECT g.*,
  AVG(
    COALESCE((p.preferences->'genre_weights'->>g.genre[1])::float, 0.5)
  ) AS group_score
FROM games g
JOIN user_libraries ul ON ul.game_id = g.id
JOIN profiles p ON p.id = ul.user_id
WHERE ul.user_id IN (SELECT user_id FROM room_members WHERE room_id = $1)
GROUP BY g.id
HAVING COUNT(DISTINCT ul.user_id) = (SELECT COUNT(*) FROM room_members WHERE room_id = $1)
ORDER BY group_score DESC
LIMIT 5;
```

**Tasks:**
- [ ] Create the `update_preference_profile` Postgres function
- [ ] Create the `get_shortlist` Postgres function (returns top 5 games ranked by group preference)
- [ ] Add a "Rate this session" modal after a game night ends (1–5 stars per user)
- [ ] Wiring: submitting a rating calls `update_preference_profile` for that user
- [ ] Display the preference breakdown on the Profile page (top genres, sessions played)
- [ ] Show the ranked shortlist (from `get_shortlist`) on the Room Lobby page

**Test checkpoint — Phase 4:**
> You must manually test this phase.

- [ ] After logging 2+ sessions with ratings, check that `profiles.preferences` JSONB has updated genre weights in Supabase
- [ ] Verify the shortlist changes order as you add more ratings (preferences are influencing ranking)
- [ ] Run `get_shortlist` directly in the Supabase SQL editor for a test room — confirm it returns up to 5 games ordered by score
- [ ] Edge case: a room with a member who has no preference data yet — system falls back to 0.5 default weight (no crash)

---

### Phase 5 — Live Voting (Redis + Node.js Middleware)

**Goal:** The host starts a vote on the shortlist. All room members see live vote counts update in real time. First game to reach majority wins and the result is saved to PostgreSQL.

**Redis data model:**
```
Key: vote:{room_id}:{voting_session_id}
Type: Sorted Set
Members: game_id
Scores: vote count (atomic ZINCRBY)

Key: voters:{room_id}:{voting_session_id}
Type: Set
Members: user_id (prevents double-voting)
```

**Node.js middleware responsibilities:**
- Accept WebSocket connections from React clients
- Validate room membership before allowing a socket to join a room channel
- On vote message: check `SISMEMBER voters:{room_id}`, then `ZINCRBY vote:{room_id}`, then `SADD voters:{room_id}`, then broadcast updated tallies
- Poll for majority: if any game reaches `ceil(members/2)` votes, emit a `vote_end` event, delete Redis keys, persist winner to `voting_sessions.winner_game_id` via Supabase

**Tasks:**
- [ ] Set up `middleware/` as a Node.js project: `npm init -y && npm install express ws ioredis @supabase/supabase-js dotenv`
- [ ] Implement the WebSocket server with room-based channels
- [ ] Implement the vote handler with Redis Sorted Sets (atomic, no double-voting)
- [ ] Implement majority detection and the persist-to-Supabase step
- [ ] Build the Voting Screen in React — shows the shortlist with live vote bars, a Vote button per game
- [ ] Connect React to the middleware WebSocket on room entry
- [ ] Host-only "Start Vote" button that transitions room `status` to `'voting'`
- [ ] After `vote_end` event: show winner announcement, transition to Session Logging page

**Test checkpoint — Phase 5:**
> You must manually test this phase with 2+ browser windows open simultaneously.

- [ ] Open 2 browser windows logged in as different users, both in the same room
- [ ] Host clicks "Start Vote" — both windows switch to the Voting Screen
- [ ] User A votes for Game X — the vote count updates live in User B's window without a page refresh
- [ ] Cast enough votes for one game to hit majority — winner announcement appears on both screens
- [ ] Check `voting_sessions` table in Supabase — `winner_game_id` is populated and `ended_at` is set
- [ ] Verify Redis keys are cleaned up after the vote ends (`redis-cli KEYS "vote:*"` returns nothing for that session)
- [ ] Try voting twice as the same user — second vote is rejected (no duplicate in Redis Set)

---

### Phase 6 — Session History & Logging

**Goal:** After voting ends, a game session is logged. Users rate the session. The full history is viewable per room and per user.

**Tasks:**
- [ ] After vote ends, automatically create a row in `game_sessions` (room_id, game_id, started_at)
- [ ] Build a "Session Active" screen with an "End Session" button for the host
- [ ] On session end: set `ended_at`, calculate `duration_minutes`, update the row
- [ ] Show the rating modal for all users after a session ends
- [ ] Build a Session History page per room — table of past sessions (game, date, duration, avg group rating)
- [ ] Build a personal stats section on the Profile page — total sessions, favorite game, most-played genre

**Test checkpoint — Phase 6:**
> You must manually test this phase.

- [ ] Complete a full flow: room → shortlist → vote → session → rate → history
- [ ] Session History page shows all past sessions for a room in chronological order
- [ ] Profile page stats reflect actual session and rating data from the DB
- [ ] Verify `session_ratings` table has entries for each user who rated

---

### Phase 7 — Polish, Final Testing & GitHub Push

**Goal:** The application is stable, reasonably styled, and pushed to a public GitHub repository.

**Tasks:**
- [ ] Add basic responsive CSS / a UI library (Tailwind or shadcn/ui recommended)
- [ ] Add loading states and error messages to all data-fetching operations
- [ ] Handle edge cases: empty library, room with 1 person, no common games found
- [ ] Write a `README.md` with setup instructions, screenshots, and tech stack explanation
- [ ] Audit all Supabase RLS policies — ensure no data leaks between rooms
- [ ] Create `.env.example` files (no real keys) for both frontend and middleware
- [ ] Add a `.gitignore` that excludes `.env`, `.env.local`, `node_modules/`
- [ ] Initialize git: `git init` in the project root
- [ ] Create a GitHub repository named `gamenight-adbms`
- [ ] Push all code: `git push -u origin main`

**Final test checklist — full end-to-end run:**
- [ ] Fresh browser, register two new accounts
- [ ] Both add game libraries (at least 5 games each, some overlap)
- [ ] Create a room, have second user join
- [ ] Confirm common library appears correctly
- [ ] Start a vote — live updates work across both windows
- [ ] Vote resolves — winner announced, session logged
- [ ] Both users rate the session — preference profiles update
- [ ] Check Session History — session appears with correct data
- [ ] Run shortlist again — order has shifted based on new rating data

---

## Roadmap / Task Tracker

### Milestones

| # | Phase | Key Deliverable | Status |
|---|---|---|---|
| 1 | Database Setup | All Supabase tables live, seeded, RLS on | ✅ Complete — tagged phase-1 |
| 2 | Auth & Profiles | Register, login, profile trigger working | ✅ Complete — tagged phase-2 |
| 3 | Libraries & Rooms | Common library intersection query working | ✅ Complete — tagged phase-3 |
| 4 | Preference Profiles | JSONB profiles updating, shortlist ranking working | ✅ Complete — tagged phase-4 |
| 5 | Live Voting | Redis voting with real-time WebSocket updates | ✅ Complete — tagged phase-5 |
| 6 | Session History | Full session logging and rating flow | ✅ Complete — tagged phase-6 |
| 7 | Polish & GitHub | Styled app pushed to public repo | ✅ Complete — tagged phase-7 |

### Bonus Features (post Phase 7)

| # | Feature | Key DB Concept | Status |
|---|---|---|---|
| B1 | Materialized view — room stats | `CREATE MATERIALIZED VIEW`, `REFRESH CONCURRENTLY` | ✅ Complete |
| B2 | Window functions — room leaderboard | `DENSE_RANK() OVER (...)` | ✅ Complete |
| B3 | Full-text search on games | `tsvector`, `websearch_to_tsquery`, GIN index, trigger | ✅ Complete |
| B4 | Audit log with triggers | `AFTER INSERT/UPDATE` triggers, JSONB metadata | ✅ Complete |
| B5 | Real-time room chat | Supabase Realtime, optimistic updates, `room_messages` table | ✅ Complete |
| B6 | Rematch / Play Again button | Reuses `startVote()` — contextual UX after sessions | ✅ Complete |
| B7 | Game Wishlist | `game_wishlists` table, `get_room_wishlist` set query, personal Wishlist page | ✅ Complete |

### Advanced DBMS Concepts Demonstrated

This project must clearly demonstrate the following — these are the graded aspects:

| Concept | Where used |
|---|---|
| JSONB document model in RDBMS | `profiles.preferences` column — flexible schema within PostgreSQL |
| Set intersection query | Common game library query across room members |
| Aggregate functions with HAVING | Intersection query's `HAVING COUNT(DISTINCT...)` |
| Stored procedures / functions | `get_shortlist`, `update_preference_profile` as Postgres functions |
| Triggers | Auto-create profile on user registration |
| GIN index | Fast JSONB querying on preference data |
| Row Level Security | Per-user and per-room data access control |
| In-memory DB (Redis) | Live voting with Sorted Sets — justified performance use case |
| Real-time subscriptions | Supabase Realtime for live room state |
| Normalization | All relational tables in 3NF |

---

## UI / Design Guidelines

- **Theme:** Dark, modern, futuristic. Think gaming aesthetic — deep dark backgrounds, neon accent colors (purple/cyan/blue spectrum), glowing effects, clean typography.
- **Color palette:** Background `#08080f` (near-black), surface cards `#0f0f1a` with `#ffffff0d` glass overlay, accent primary `#7c3aed` (violet), accent secondary `#06b6d4` (cyan), text `#e2e8f0`, muted text `#6b7280`.
- **Typography:** `Space Grotesk` (headings — geometric, techy) + `Inter` (body) from Google Fonts. Large display text with tight letter-spacing like the AgentAI reference.
- **Components:** Glassmorphism cards — `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.08)`, `backdrop-filter: blur(12px)`, box-shadow with violet glow on hover. Gradient CTA buttons (violet → cyan). No flat/boxy material look.
- **Game cards:** Crunchyroll/streaming-app style — cover art fills the card, genre tags overlaid at bottom, hover lifts the card and shows a violet glow border.
- **Hero sections:** Full-width with atmospheric background, large bold heading, subtitle, CTA pair (like the AgentAI + museum references). Subtle grid or noise texture overlay.
- **Icons:** Use `lucide-react` for all icons.
- **Animations:** Subtle — `transition-all duration-200`, scale on hover, fade-in on mount, loading skeletons (dark shimmer). Nothing that gets in the way of UX.
- **Glow effects:** Violet radial gradient blobs behind key UI sections for depth. Cyan glow on active/selected states.
- Reference images analyzed: Crunchyroll dark layout (card grid), purple scheduling app (dark glass cards), AgentAI (dramatic hero + typography), museum (minimal high-contrast), anime app (hero + trending row).

---

## GitHub Strategy

- The repository is pushed to GitHub **at the end of every phase** (after all test checkpoints pass), not just at the end.
- Each phase push uses a descriptive commit message, e.g. `feat: phase 1 - database schema and supabase setup`.
- Use `gh repo create` to create the repo on first push. Confirm the repo name with the user before creating.
- Never force-push. Never commit `.env` or `.env.local` files.
- Tag each phase completion: `git tag phase-1`, `git tag phase-2`, etc.

---

## Environment & Credentials

- **Supabase Project Name:** gamenight (already created)
- **Supabase Project URL:** https://larjzxirqhzdcrtnbpvr.supabase.co
- **Supabase Anon Key:** stored in `frontend/.env.local` (never commit)
- **Supabase Service Role Key:** stored in `middleware/.env` (never commit)
- **Redis:** Installed locally, default port 6379
- **Node.js:** v24.15.0 | npm 11.12.1
- **GitHub CLI:** gh v2.92.0 (authenticated)
- **GitHub repo name:** gamenight-adbms
- **GitHub username:** izzatkamall
- **GitHub push cadence:** After every phase, with a tag (phase-1, phase-2, …)

---

## Current State (resuming for Phase 5)

### What is built and working
- Full dark/glass UI design system (Tailwind, Space Grotesk + Inter fonts)
- Auth: register, login, logout, session persistence, profile auto-created via trigger
- Library page: browse 45 seeded games, toggle ownership (user_libraries table)
- Dashboard: live rooms list with status badges, action card navigation
- Create Room: insert into rooms + room_members, invite code auto-generated
- Join Room: look up by invite code (get_room_by_invite_code RPC), join room_members
- Room Lobby: members panel, common games grid (get_common_games RPC), Group Picks shortlist (get_shortlist RPC), star rating → update_user_preferences RPC
- Profile page: username display, stats row, genre preference bars from JSONB

### Critical fixes applied (must NOT revert)

**1. Supabase JS Web Locks hang** — `frontend/src/lib/supabase.js`
The Supabase JS v2 client hung indefinitely on all requests because a stale Web Lock prevented `getSession()` from resolving. Fixed by passing a no-op lock function:
```js
auth: { lock: async (_name, _acquireTimeout, fn) => fn() }
```

**2. RLS recursion on room_members** — migrations 005 & 006
Self-referential policies caused infinite recursion. Fixed by introducing `get_user_room_ids()` SECURITY DEFINER helper and simplifying all policies to avoid direct `room_members` subqueries inside RLS USING clauses.

**3. Role privileges missing** — migration 008
Tables were created without explicit GRANT statements. `anon` and `authenticated` roles had no table-level SELECT/INSERT privileges. Fixed with `GRANT ... ON ... TO anon, authenticated`.

**4. rooms INSERT…RETURNING RLS failure** — migration 009
`INSERT...select().single()` on rooms failed because after INSERT the user isn't in room_members yet, so the SELECT USING policy blocked the RETURNING clause. Fixed by adding `rooms_select_host` policy: `USING (host_id = auth.uid())`.

### Migrations applied to Supabase (in order)
001_schema.sql, 002_rls.sql, 003_functions.sql, 004_seed_games.sql,
005_fix_rls_recursion.sql, 006_fix_rls_recursion_complete.sql,
007_phase3_functions.sql, 008_grant_role_privileges.sql, 009_rooms_host_select.sql

### Phase 5 starting checklist
Before writing any Phase 5 code, verify:
- [ ] Redis is running: `redis-cli ping` → PONG
- [ ] `middleware/` directory exists with `package.json` (run `npm init -y` if not)
- [ ] `middleware/.env` has REDIS_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT=4000
- [ ] `frontend/.env.local` has VITE_MIDDLEWARE_WS_URL=ws://localhost:4000

---

## Known Bugs / Deferred Issues

### Username change not saving (Phase 2 — deferred)
- **Symptom:** Clicking ✓ on Profile page spins indefinitely, username never updates.
- **Root cause:** Direct `supabase.from('profiles').update()` call triggers RLS policy evaluation which has a recursion chain involving `room_members`. Migrations 005 and 006 partially addressed this but did not resolve it.
- **Attempted fix:** Switched to `supabase.rpc('update_username', ...)` calling a SECURITY DEFINER function — still did not resolve.
- **Next step:** Investigate why `auth.uid()` may not be resolving correctly inside the SECURITY DEFINER function, or try a different approach (e.g., `supabase.auth.updateUser()` for metadata, or debug the exact PostgREST request in the Network tab).
- **Priority:** Fix before final submission. Does not block Phases 3–6.

---

## Rules for Claude

- Implement one phase at a time. Do not scaffold Phase 3 code while Phase 2 tests are not yet passing.
- Every phase ends with a test checkpoint. If any manual test fails, fix it before proceeding.
- When manual testing is required (browser UI tests), explicitly tell the user what to test and what the expected result is. Do not mark a phase complete until the user confirms the tests passed.
- Push to GitHub after every phase with a phase tag. Ask for confirmation before the first push (to confirm repo name). Subsequent phase pushes can proceed after test confirmation.
- Do not add features beyond what is specified in this document.
- SQL migrations go in `supabase/migrations/` as numbered files (e.g., `001_initial_schema.sql`).
- Environment secrets must never be committed. Always check `.gitignore` before any `git add`.
- Keep the Node.js middleware minimal — it only handles WebSocket/Redis. All other backend logic stays in Supabase.
- All UI must follow the dark/futuristic design guidelines above. No light themes, no generic component library defaults.
