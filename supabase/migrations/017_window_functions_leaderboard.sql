-- =============================================================
-- GameNight — Migration 017: Window Functions — Room Leaderboard
--
-- Uses DENSE_RANK() OVER (...) to rank games within a room by
-- play count, with avg rating as tiebreaker. Also counts how
-- many times each game won a vote (times_won_vote).
-- DENSE_RANK ensures tied games share the same rank without
-- skipping numbers (1,2,2,3 not 1,2,2,4).
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_room_leaderboard(p_room_id UUID)
RETURNS TABLE (
  rank           BIGINT,
  game_id        INT,
  title          TEXT,
  cover_url      TEXT,
  genres         TEXT[],
  play_count     BIGINT,
  avg_rating     NUMERIC,
  times_won_vote BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DENSE_RANK() OVER (
      ORDER BY COUNT(DISTINCT gs.id) DESC,
               COALESCE(ROUND(AVG(sr.rating)::NUMERIC, 1), 0) DESC
    )                                                             AS rank,
    g.id                                                          AS game_id,
    g.title,
    g.cover_url,
    g.genres,
    COUNT(DISTINCT gs.id)                                         AS play_count,
    ROUND(AVG(sr.rating)::NUMERIC, 1)                            AS avg_rating,
    COALESCE((
      SELECT COUNT(*)
      FROM   voting_sessions vs
      WHERE  vs.winner_game_id = g.id
        AND  vs.room_id        = p_room_id
    ), 0)                                                         AS times_won_vote
  FROM   games g
  JOIN   game_sessions gs ON gs.game_id = g.id
                          AND gs.room_id  = p_room_id
                          AND gs.ended_at IS NOT NULL
  LEFT JOIN session_ratings sr ON sr.session_id = gs.id
  GROUP  BY g.id, g.title, g.cover_url, g.genres
  ORDER  BY rank, g.title;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_leaderboard(UUID) TO authenticated;
