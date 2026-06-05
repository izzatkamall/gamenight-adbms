-- =============================================================
-- GameNight — Migration 015: submit_session_rating RPC
--
-- Replaces the direct session_ratings INSERT from the frontend.
-- Using SECURITY DEFINER avoids the RLS SELECT policy being
-- evaluated on the RETURNING clause, which caused hangs when
-- the get_user_room_ids subquery stalled for new users.
-- Also grants EXECUTE on update_user_preferences (was missing).
-- =============================================================

CREATE OR REPLACE FUNCTION public.submit_session_rating(
  p_session_id UUID,
  p_user_id    UUID,
  p_game_id    INT,
  p_rating     INT
)
RETURNS VOID AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only submit your own rating';
  END IF;

  IF p_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  INSERT INTO public.session_ratings (session_id, user_id, rating)
  VALUES (p_session_id, p_user_id, p_rating)
  ON CONFLICT (session_id, user_id) DO NOTHING;

  PERFORM public.update_user_preferences(p_user_id, p_game_id, p_rating);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.submit_session_rating(UUID, UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_preferences(UUID, INT, INT)     TO authenticated;
