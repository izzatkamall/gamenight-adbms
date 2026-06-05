-- =============================================================
-- GameNight — Migration 014: Fix get_user_stats
-- Count sessions from room membership, not session_ratings.
-- Users who skip rating still have correct totals.
-- =============================================================
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_sessions   BIGINT,
  total_hours      NUMERIC,
  avg_rating_given NUMERIC,
  most_played_game TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT gs.id)                                                AS total_sessions,
    COALESCE(ROUND(SUM(gs.duration_minutes)::NUMERIC / 60, 1), 0)      AS total_hours,
    COALESCE(ROUND(AVG(sr.rating)::NUMERIC, 1), 0)                     AS avg_rating_given,
    (
      SELECT g2.title
      FROM   game_sessions gs2
      JOIN   games         g2  ON g2.id  = gs2.game_id
      JOIN   room_members  rm2 ON rm2.room_id = gs2.room_id
                               AND rm2.user_id = p_user_id
      WHERE  gs2.ended_at IS NOT NULL
      GROUP  BY g2.id, g2.title
      ORDER  BY COUNT(*) DESC
      LIMIT  1
    )                                                                   AS most_played_game
  FROM   game_sessions  gs
  JOIN   room_members   rm  ON rm.room_id = gs.room_id AND rm.user_id = p_user_id
  LEFT JOIN session_ratings sr ON sr.session_id = gs.id AND sr.user_id = p_user_id
  WHERE  gs.ended_at IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;
