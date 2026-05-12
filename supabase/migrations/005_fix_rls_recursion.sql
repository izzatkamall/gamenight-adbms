-- =============================================================
-- GameNight — Migration 005: Fix RLS infinite recursion on room_members
--
-- Root cause: the room_members SELECT policy checked membership by
-- querying room_members itself, which re-triggered the same policy
-- → infinite recursion on every DB call.
--
-- Fix: extract the membership check into a SECURITY DEFINER function
-- that runs as the DB owner and bypasses RLS, breaking the cycle.
-- =============================================================

-- Helper: returns all room_ids the given user belongs to.
-- SECURITY DEFINER = runs as function owner (postgres), bypasses RLS.
CREATE OR REPLACE FUNCTION public.get_user_room_ids(p_user_id UUID)
RETURNS TABLE(room_id UUID) AS $$
  SELECT room_id FROM public.room_members WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Recreate the offending policy using the helper instead of a
-- self-referential subquery.
DROP POLICY IF EXISTS "room_members_select_shared_room" ON public.room_members;

CREATE POLICY "room_members_select_shared_room"
  ON public.room_members FOR SELECT
  USING (
    room_id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid()))
  );
