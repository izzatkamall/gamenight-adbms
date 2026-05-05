-- =============================================================
-- GameNight — Migration 001: Initial Schema
-- Run this first in the Supabase SQL Editor
-- =============================================================

-- UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- Helper: generate a readable 6-char room invite code
-- Uses unambiguous characters (no O/0, I/1/l)
-- =============================================================
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- Helper: auto-update updated_at timestamp
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- TABLE: profiles
-- Extends auth.users. Created automatically via trigger (003).
-- preferences JSONB stores the adaptive taste profile.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preferences JSONB NOT NULL DEFAULT '{
    "favorite_genres": [],
    "genre_weights":   {},
    "avg_session_minutes": 0,
    "total_sessions": 0
  }'::jsonb
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- GIN index for fast JSONB querying on preference data
CREATE INDEX IF NOT EXISTS idx_profiles_preferences
  ON public.profiles USING GIN(preferences);

-- =============================================================
-- TABLE: games
-- Static catalog of games seeded in migration 004.
-- genres is a text array to support multi-genre matching.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.games (
  id                   SERIAL PRIMARY KEY,
  title                TEXT    NOT NULL,
  genres               TEXT[]  NOT NULL DEFAULT '{}',
  min_players          INT     NOT NULL DEFAULT 1,
  max_players          INT     NOT NULL DEFAULT 8,
  avg_playtime_minutes INT              DEFAULT 60,
  cover_url            TEXT,
  steam_app_id         INT,
  is_free              BOOLEAN          DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN index for genre-based filtering
CREATE INDEX IF NOT EXISTS idx_games_genres
  ON public.games USING GIN(genres);

-- =============================================================
-- TABLE: user_libraries
-- Which games each user owns. Junction table.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.user_libraries (
  user_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id  INT  REFERENCES public.games(id)    ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_user_libraries_user ON public.user_libraries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_libraries_game ON public.user_libraries(game_id);

-- =============================================================
-- TABLE: rooms
-- A game room created by a host. Members join via invite_code.
-- status machine: open → voting → session_active → open (loop) / closed
-- =============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  host_id     UUID    REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT    UNIQUE NOT NULL DEFAULT public.generate_invite_code(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT    NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'voting', 'session_active', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON public.rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_rooms_host        ON public.rooms(host_id);

-- =============================================================
-- TABLE: room_members
-- Who is in each room.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.room_members (
  room_id   UUID REFERENCES public.rooms(id)    ON DELETE CASCADE,
  user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members(user_id);

-- =============================================================
-- TABLE: voting_sessions
-- One record per voting round. winner persisted by middleware
-- after Redis resolves majority.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.voting_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID REFERENCES public.rooms(id)  ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  winner_game_id INT REFERENCES public.games(id)
);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_room ON public.voting_sessions(room_id);

-- =============================================================
-- TABLE: game_sessions
-- A logged play session that follows a completed vote.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID REFERENCES public.rooms(id)            ON DELETE CASCADE,
  game_id           INT  REFERENCES public.games(id),
  voting_session_id UUID REFERENCES public.voting_sessions(id),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  duration_minutes  INT,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON public.game_sessions(room_id);

-- =============================================================
-- TABLE: session_ratings
-- Per-user rating (1–5) after each game session.
-- Drives preference profile updates.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.session_ratings (
  session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id)       ON DELETE CASCADE,
  rating     INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_ratings_session ON public.session_ratings(session_id);
CREATE INDEX IF NOT EXISTS idx_session_ratings_user    ON public.session_ratings(user_id);
