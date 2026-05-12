-- =============================================================
-- GameNight — Migration 007: Phase 3 helper functions
-- =============================================================

-- Returns all members of a room with their profile info.
-- Only returns rows if the calling user is also a member of the room.
-- SECURITY DEFINER bypasses RLS on both room_members and profiles.
CREATE OR REPLACE FUNCTION public.get_room_members(p_room_id UUID)
RETURNS TABLE(user_id UUID, username TEXT, avatar_url TEXT, joined_at TIMESTAMPTZ) AS $$
  SELECT p.id, p.username, p.avatar_url, rm.joined_at
  FROM   public.room_members rm
  JOIN   public.profiles p ON p.id = rm.user_id
  WHERE  rm.room_id = p_room_id
  AND    EXISTS (
    SELECT 1 FROM public.room_members
    WHERE  room_id = p_room_id AND user_id = auth.uid()
  )
  ORDER BY rm.joined_at;
$$ LANGUAGE sql SECURITY DEFINER;
