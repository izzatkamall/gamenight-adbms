-- =============================================================
-- GameNight — Migration 016: Materialized View — room_stats
--
-- Pre-aggregates per-room statistics so the Room Lobby can read
-- a single row instead of running 3 aggregate queries on every
-- page load. CONCURRENTLY refresh (enabled by the unique index)
-- means reads are never blocked during refresh.
-- =============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.room_stats AS
SELECT
  r.id                                                              AS room_id,
  r.name                                                            AS room_name,
  COUNT(DISTINCT gs.id)                                             AS total_sessions,
  COALESCE(ROUND(SUM(gs.duration_minutes)::NUMERIC / 60, 1), 0)   AS total_hours,
  COALESCE(ROUND(AVG(sr.rating)::NUMERIC, 1), 0)                   AS avg_group_rating,
  (
    SELECT g2.title
    FROM   game_sessions gs2
    JOIN   games g2 ON g2.id = gs2.game_id
    WHERE  gs2.room_id = r.id
      AND  gs2.ended_at IS NOT NULL
    GROUP  BY g2.id, g2.title
    ORDER  BY COUNT(*) DESC
    LIMIT  1
  )                                                                 AS most_played_game,
  MAX(gs.ended_at)                                                  AS last_session_at
FROM   rooms r
LEFT JOIN game_sessions   gs ON gs.room_id = r.id AND gs.ended_at IS NOT NULL
LEFT JOIN session_ratings sr ON sr.session_id = gs.id
GROUP  BY r.id, r.name;

-- Unique index required for CONCURRENTLY refresh (non-blocking)
CREATE UNIQUE INDEX IF NOT EXISTS room_stats_room_id_idx ON public.room_stats (room_id);

-- ── refresh_room_stats() ─────────────────────────────────────
-- Called from the application after a session ends so the view
-- stays current without a scheduled job.
CREATE OR REPLACE FUNCTION public.refresh_room_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.room_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_room_stats() TO authenticated;

-- ── get_room_stats(room_id) ───────────────────────────────────
-- Returns the pre-computed stats row for one room.
CREATE OR REPLACE FUNCTION public.get_room_stats(p_room_id UUID)
RETURNS SETOF public.room_stats
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.room_stats WHERE room_id = p_room_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_stats(UUID) TO authenticated;
