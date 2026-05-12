-- =============================================================
-- GameNight — Migration 006: Complete RLS recursion fix
--
-- Problem: multiple policies queried room_members directly inside
-- their USING clauses, creating a recursive policy evaluation chain.
-- 005 fixed room_members itself but profiles_select_room_members
-- still queried room_members, keeping the cycle alive.
--
-- Fix strategy:
--   1. Re-ensure get_user_room_ids() SECURITY DEFINER helper exists.
--   2. Drop every policy that directly queries room_members in USING.
--   3. Rewrite them to use the helper (which bypasses RLS).
--   4. room_members itself gets a simple own-row policy — Phase 3
--      will expose other members via a SECURITY DEFINER function.
-- =============================================================

-- Ensure helper function exists (idempotent re-create)
CREATE OR REPLACE FUNCTION public.get_user_room_ids(p_user_id UUID)
RETURNS TABLE(room_id UUID) AS $$
  SELECT room_id FROM public.room_members WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── profiles ───────────────────────────────────────────────────
-- Remove the cross-reference to room_members from profiles policies.
-- Own-profile visibility is all that Phase 2 needs.
DROP POLICY IF EXISTS "profiles_select_room_members" ON public.profiles;

-- ── room_members ───────────────────────────────────────────────
-- Replace the self-referential policy with a simple own-row check.
DROP POLICY IF EXISTS "room_members_select_shared_room" ON public.room_members;
DROP POLICY IF EXISTS "room_members_select_own"         ON public.room_members;

CREATE POLICY "room_members_select_own"
  ON public.room_members FOR SELECT
  USING (auth.uid() = user_id);

-- ── rooms ──────────────────────────────────────────────────────
-- Use the SECURITY DEFINER helper — no direct room_members subquery.
DROP POLICY IF EXISTS "rooms_select_member" ON public.rooms;

CREATE POLICY "rooms_select_member"
  ON public.rooms FOR SELECT
  USING (
    id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid()))
  );

-- ── voting_sessions ────────────────────────────────────────────
DROP POLICY IF EXISTS "voting_sessions_select_member" ON public.voting_sessions;

CREATE POLICY "voting_sessions_select_member"
  ON public.voting_sessions FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid()))
  );

-- ── game_sessions ──────────────────────────────────────────────
DROP POLICY IF EXISTS "game_sessions_select_member" ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_all_host"      ON public.game_sessions;

CREATE POLICY "game_sessions_select_member"
  ON public.game_sessions FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid()))
  );

CREATE POLICY "game_sessions_all_host"
  ON public.game_sessions FOR ALL
  USING     (room_id IN (SELECT id FROM public.rooms WHERE host_id = auth.uid()))
  WITH CHECK(room_id IN (SELECT id FROM public.rooms WHERE host_id = auth.uid()));

-- ── session_ratings ────────────────────────────────────────────
DROP POLICY IF EXISTS "session_ratings_select_member" ON public.session_ratings;

CREATE POLICY "session_ratings_select_member"
  ON public.session_ratings FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.game_sessions
      WHERE room_id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid()))
    )
  );
