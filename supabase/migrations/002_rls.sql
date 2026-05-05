-- =============================================================
-- GameNight — Migration 002: Row Level Security
-- Run after 001_schema.sql
-- =============================================================

-- Enable RLS on every table
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_ratings ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- profiles
-- =============================================================
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow members of shared rooms to see each other's usernames/avatars
CREATE POLICY "profiles_select_room_members"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT rm2.user_id
      FROM   public.room_members rm1
      JOIN   public.room_members rm2 ON rm1.room_id = rm2.room_id
      WHERE  rm1.user_id = auth.uid()
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- The trigger function (003) is SECURITY DEFINER so it inserts regardless of RLS.
-- This policy is a safety net in case of direct insert attempts.
CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =============================================================
-- games (public read-only catalog — all authenticated users)
-- =============================================================
CREATE POLICY "games_select_authenticated"
  ON public.games FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================
-- user_libraries
-- Users manage their own library.
-- Cross-user reads for room queries go through SECURITY DEFINER
-- functions (get_common_games, get_shortlist) which bypass RLS.
-- =============================================================
CREATE POLICY "user_libraries_all_own"
  ON public.user_libraries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- rooms
-- Visibility: members of the room.
-- Create: any authenticated user (must set themselves as host).
-- Update: host only.
-- =============================================================
CREATE POLICY "rooms_select_member"
  ON public.rooms FOR SELECT
  USING (
    id IN (
      SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "rooms_insert_authenticated"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "rooms_update_host"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- =============================================================
-- room_members
-- Visibility: other members of the same room.
-- Join: any authenticated user (adds themselves).
-- Leave: own membership only.
-- =============================================================
CREATE POLICY "room_members_select_shared_room"
  ON public.room_members FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "room_members_insert_self"
  ON public.room_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "room_members_delete_self"
  ON public.room_members FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- voting_sessions
-- Read: room members. Create: host. Update: service role only
-- (middleware uses service role key to persist winner).
-- =============================================================
CREATE POLICY "voting_sessions_select_member"
  ON public.voting_sessions FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "voting_sessions_insert_host"
  ON public.voting_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT id FROM public.rooms WHERE host_id = auth.uid()
    )
  );

-- Service role (middleware) updates voting_sessions to set winner.
-- The service role key bypasses RLS entirely, so no extra policy needed.

-- =============================================================
-- game_sessions
-- Read: room members. Manage: host.
-- =============================================================
CREATE POLICY "game_sessions_select_member"
  ON public.game_sessions FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "game_sessions_all_host"
  ON public.game_sessions FOR ALL
  USING (
    room_id IN (
      SELECT id FROM public.rooms WHERE host_id = auth.uid()
    )
  )
  WITH CHECK (
    room_id IN (
      SELECT id FROM public.rooms WHERE host_id = auth.uid()
    )
  );

-- =============================================================
-- session_ratings
-- Read: room members. Write: own rating only.
-- =============================================================
CREATE POLICY "session_ratings_select_member"
  ON public.session_ratings FOR SELECT
  USING (
    session_id IN (
      SELECT gs.id FROM public.game_sessions gs
      WHERE gs.room_id IN (
        SELECT room_id FROM public.room_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "session_ratings_insert_own"
  ON public.session_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "session_ratings_update_own"
  ON public.session_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
