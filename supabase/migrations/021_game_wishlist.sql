-- =============================================================
-- GameNight — Migration 021: Game Wishlist
--
-- Users can mark games they want to play but don't own yet.
-- get_room_wishlist returns games any room member has wishlisted
-- but not everyone owns — ordered by most-wanted first.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.game_wishlists (
  user_id    UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id    INT   NOT NULL REFERENCES public.games(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_wishlists_user ON public.game_wishlists (user_id);
CREATE INDEX IF NOT EXISTS idx_game_wishlists_game ON public.game_wishlists (game_id);

ALTER TABLE public.game_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_all_own"
  ON public.game_wishlists FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.game_wishlists TO authenticated;

-- ── get_room_wishlist ─────────────────────────────────────────
-- Returns games wishlisted by at least one room member that are
-- NOT yet owned by every member — sorted by most-wished first.
CREATE OR REPLACE FUNCTION public.get_room_wishlist(p_room_id UUID)
RETURNS TABLE (
  game_id    INT,
  title      TEXT,
  cover_url  TEXT,
  genres     TEXT[],
  wish_count BIGINT,
  own_count  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id                                                      AS game_id,
    g.title,
    g.cover_url,
    g.genres,
    COUNT(DISTINCT gw.user_id)                                AS wish_count,
    COUNT(DISTINCT ul.user_id)                                AS own_count
  FROM   games g
  JOIN   game_wishlists gw
           ON gw.game_id = g.id
          AND gw.user_id IN (SELECT user_id FROM room_members WHERE room_id = p_room_id)
  LEFT JOIN user_libraries ul
           ON ul.game_id = g.id
          AND ul.user_id IN (SELECT user_id FROM room_members WHERE room_id = p_room_id)
  GROUP  BY g.id, g.title, g.cover_url, g.genres
  HAVING COUNT(DISTINCT ul.user_id) < (SELECT COUNT(*) FROM room_members WHERE room_id = p_room_id)
  ORDER  BY wish_count DESC, own_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_wishlist(UUID) TO authenticated;
