-- =============================================================
-- GameNight — Migration 012: Phase 6 — Session history & stats
-- =============================================================

-- ── get_session_history ──────────────────────────────────────
-- Returns all completed sessions for a room, with per-session
-- avg group rating and the calling user's own rating.
CREATE OR REPLACE FUNCTION get_session_history(p_room_id UUID)
RETURNS TABLE (
  session_id       UUID,
  game_id          INT,
  title            TEXT,
  cover_url        TEXT,
  genres           TEXT[],
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_minutes INT,
  avg_rating       NUMERIC,
  my_rating        INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gs.id                                                         AS session_id,
    gs.game_id,
    g.title,
    g.cover_url,
    g.genres,
    gs.started_at,
    gs.ended_at,
    gs.duration_minutes,
    ROUND(AVG(sr.rating)::NUMERIC, 1)                            AS avg_rating,
    MAX(CASE WHEN sr.user_id = auth.uid() THEN sr.rating END)    AS my_rating
  FROM game_sessions gs
  JOIN  games g  ON g.id = gs.game_id
  LEFT JOIN session_ratings sr ON sr.session_id = gs.id
  WHERE gs.room_id   = p_room_id
    AND gs.ended_at IS NOT NULL
  GROUP BY gs.id, g.title, g.cover_url, g.genres,
           gs.started_at, gs.ended_at, gs.duration_minutes
  ORDER BY gs.started_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_session_history(UUID) TO authenticated;

-- ── get_user_stats ───────────────────────────────────────────
-- Returns lifetime stats for a single user.
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
    COUNT(DISTINCT sr.session_id)                                       AS total_sessions,
    COALESCE(ROUND(SUM(gs.duration_minutes)::NUMERIC / 60, 1), 0)      AS total_hours,
    COALESCE(ROUND(AVG(sr.rating)::NUMERIC, 1), 0)                     AS avg_rating_given,
    (
      SELECT g2.title
      FROM   session_ratings  sr2
      JOIN   game_sessions    gs2 ON gs2.id  = sr2.session_id
      JOIN   games            g2  ON g2.id   = gs2.game_id
      WHERE  sr2.user_id = p_user_id
      GROUP  BY g2.id, g2.title
      ORDER  BY COUNT(*) DESC
      LIMIT  1
    )                                                                   AS most_played_game
  FROM session_ratings sr
  LEFT JOIN game_sessions gs ON gs.id = sr.session_id
  WHERE sr.user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;

-- ── Enable Realtime on game_sessions ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname   = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
  END IF;
END
$$;
