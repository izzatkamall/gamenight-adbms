# GameNight 🎮

**Advanced DBMS — Individual Semester Project**  
**Student:** Muhammad Izzat Kamal | BSAI24078  
**Course:** Advanced Database Management Systems

---

## Overview

GameNight is a real-time group video game night planner. It solves the problem of indecisive gaming groups by:

- Finding games that **every room member owns in common** (set intersection query)
- Building **per-user taste profiles** from session ratings using JSONB in PostgreSQL
- Running a **live vote** on a ranked shortlist with real-time results
- Logging every session so recommendations improve over time

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Primary Database | PostgreSQL via Supabase (JSONB, stored functions, triggers, RLS) |
| Auth | Supabase Auth (email/password) |
| Real-time | Supabase Realtime (postgres_changes) |
| In-memory Store | Redis (Sorted Sets for live voting) |
| Middleware | Node.js + Express + WebSocket (ws) + ioredis |

---

## Advanced DBMS Concepts Demonstrated

| Concept | Implementation |
|---|---|
| **JSONB document model** | `profiles.preferences` stores genre weights, session count, and favorite genres as flexible JSONB — updated with exponential moving average after each rating |
| **Set intersection query** | `get_common_games` uses `GROUP BY … HAVING COUNT(DISTINCT user_id) = member_count` to find games every room member owns |
| **Aggregate functions + HAVING** | Both the intersection query and `get_shortlist` use `HAVING COUNT(DISTINCT …)` for correctness guarantees |
| **Stored procedures / functions** | 8 PostgreSQL functions: `get_common_games`, `get_shortlist`, `get_room_members`, `get_session_history`, `get_user_stats`, `update_user_preferences`, `submit_session_rating`, `update_username` |
| **Triggers** | `on_auth_user_created` trigger auto-inserts a row into `profiles` when a user registers in `auth.users` |
| **GIN index** | `idx_games_genres` on `games.genres` (TEXT[]) for fast array containment queries |
| **Row Level Security** | All 8 tables have RLS enabled with per-user and per-room policies; `SECURITY DEFINER` helper functions eliminate RLS recursion |
| **In-memory database (Redis)** | Live voting uses Redis Sorted Sets (`ZINCRBY`) for atomic, sub-millisecond vote tallying and Redis Sets to prevent double-voting |
| **Real-time subscriptions** | Supabase Realtime `postgres_changes` streams room status and session updates to all connected clients instantly |
| **Normalization** | All relational tables are in 3NF with explicit foreign key constraints |

---

## Architecture

```
┌─────────────┐    Supabase JS client     ┌──────────────────────┐
│  React App  │ ◄────────────────────────► │  Supabase            │
│  (Vite)     │  auth, DB queries,         │  PostgreSQL + Auth   │
│             │  Realtime subscriptions    │  + Realtime          │
│             │                            └──────────────────────┘
│             │    WebSocket
│             │ ◄────────────────────────► ┌──────────────────────┐
└─────────────┘                            │  Node.js Middleware  │
                                           │  Express + ws        │
                                           └──────────┬───────────┘
                                                      │ ioredis
                                           ┌──────────▼───────────┐
                                           │  Redis               │
                                           │  Sorted Sets (votes) │
                                           └──────────────────────┘
```

**Live voting data flow:**
1. React opens a WebSocket to the Node.js middleware
2. Middleware validates room membership, then atomically increments vote counts in Redis (`ZINCRBY`)
3. Middleware broadcasts live tallies to all room members via WebSocket
4. When a game reaches majority (or all votes are cast), middleware persists the winner to PostgreSQL and cleans up Redis keys
5. All clients navigate to the Session Active screen via Supabase Realtime

---

## Database Schema

```sql
profiles          -- extends auth.users; stores JSONB preference profile
games             -- seeded catalog of 45 games (title, genres, player count, playtime)
user_libraries    -- many-to-many: which games each user owns
rooms             -- game night rooms with status (open / voting / session_active / closed)
room_members      -- many-to-many: which users are in each room
voting_sessions   -- records each vote with winner
game_sessions     -- logged game nights with duration
session_ratings   -- 1–5 star ratings per user per session
```

---

## Features

- **Auth** — email/password registration and login; profile auto-created via trigger
- **Game Library** — browse 45 seeded games, toggle owned/not owned
- **Rooms** — create rooms with auto-generated invite codes; join by code
- **Common Library** — intersection query shows only games every member owns
- **Group Picks** — shortlist of top 5 games ranked by group preference score
- **Live Voting** — real-time vote with live bars; majority or plurality wins
- **Session Active** — live timer, host can end session; all members rate with stars
- **Session History** — per-room log of past sessions with avg group rating
- **Taste Profile** — per-user genre preference bars built from session ratings
- **Personal Stats** — total sessions, hours played, avg rating, top game

---

## Local Setup

### Prerequisites

- Node.js v18+
- Redis (local or Redis Cloud free tier)
- Supabase account (free tier)

### 1. Clone the repo

```bash
git clone https://github.com/izzatkamall/gamenight-adbms.git
cd gamenight-adbms
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL editor, run each migration file in `supabase/migrations/` in order (001 → 015)
3. Copy your **Project URL** and **anon key** from Settings → API
4. Copy your **service role key** from Settings → API

### 3. Environment files

**`frontend/.env.local`**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MIDDLEWARE_WS_URL=ws://localhost:4000
```

**`middleware/.env`**
```
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
```

### 4. Install dependencies

```bash
cd frontend && npm install
cd ../middleware && npm install
```

### 5. Run locally

Open three terminals:

```bash
# Terminal 1 — Redis
redis-server

# Terminal 2 — Node.js middleware
cd middleware
node index.js

# Terminal 3 — React frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
gamenight-adbms/
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── components/        # Navbar, ProtectedRoute, Avatar
│   │   ├── hooks/             # useAuth, useVotingWS
│   │   ├── lib/               # Supabase client
│   │   └── pages/             # Landing, Dashboard, Library, RoomLobby,
│   │                          # VotingScreen, SessionActive, Profile, …
│   ├── .env.example
│   └── tailwind.config.js
├── middleware/                # Node.js WebSocket + Redis server
│   ├── index.js
│   └── .env.example
├── supabase/
│   └── migrations/            # 015 SQL migration files (schema → seed → functions → fixes)
└── README.md
```

---

## Key SQL: Common Game Intersection

```sql
SELECT g.*
FROM games g
JOIN user_libraries ul ON ul.game_id = g.id
WHERE ul.user_id IN (
  SELECT user_id FROM room_members WHERE room_id = p_room_id
)
GROUP BY g.id
HAVING COUNT(DISTINCT ul.user_id) = (
  SELECT COUNT(*) FROM room_members WHERE room_id = p_room_id
);
```

## Key SQL: Preference-Ranked Shortlist

```sql
SELECT g.*,
  AVG(
    COALESCE((p.preferences->'genre_weights'->>g.genres[1])::float, 0.5)
  ) AS group_score
FROM games g
JOIN user_libraries ul ON ul.game_id = g.id
JOIN profiles p        ON p.id = ul.user_id
WHERE ul.user_id IN (SELECT user_id FROM room_members WHERE room_id = p_room_id)
GROUP BY g.id
HAVING COUNT(DISTINCT ul.user_id) = (SELECT COUNT(*) FROM room_members WHERE room_id = p_room_id)
ORDER BY group_score DESC
LIMIT 5;
```

## Key SQL: JSONB Preference Update (Exponential Moving Average)

```sql
UPDATE profiles
SET preferences = jsonb_set(
  preferences,
  ARRAY['genre_weights', genre_key],
  to_jsonb(old_weight * 0.8 + (rating / 5.0) * 0.2)
)
WHERE id = user_id;
```
