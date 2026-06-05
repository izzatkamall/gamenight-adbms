-- =============================================================
-- GameNight — Migration 018: Full-Text Search on games
--
-- Adds a tsvector column that indexes game title + genres.
-- A BEFORE INSERT/UPDATE trigger keeps it in sync automatically.
-- A GIN index makes @@ queries sub-millisecond even at scale.
-- websearch_to_tsquery is used in search_games() so users can
-- type natural phrases without learning tsquery syntax.
-- =============================================================

-- 1. Add the tsvector column
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Populate existing rows
UPDATE public.games
SET search_vector = to_tsvector('english',
  COALESCE(title, '') || ' ' ||
  COALESCE(array_to_string(genres, ' '), '')
);

-- 3. GIN index for fast @@ queries
CREATE INDEX IF NOT EXISTS idx_games_fts
  ON public.games USING GIN(search_vector);

-- 4. Trigger function — regenerates vector on every insert/update
CREATE OR REPLACE FUNCTION public.games_search_vector_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(array_to_string(NEW.genres, ' '), '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_games_search_vector ON public.games;
CREATE TRIGGER trg_games_search_vector
  BEFORE INSERT OR UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.games_search_vector_update();

-- 5. search_games(query) — returns ranked results
--    websearch_to_tsquery accepts natural language:
--      "fps battle royale"  → FPS AND battle AND royale
--      "rpg -horror"        → RPG but not horror
CREATE OR REPLACE FUNCTION public.search_games(p_query TEXT)
RETURNS TABLE (
  id                   INT,
  title                TEXT,
  genres               TEXT[],
  min_players          INT,
  max_players          INT,
  avg_playtime_minutes INT,
  cover_url            TEXT,
  is_free              BOOLEAN,
  rank                 REAL
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.title,
    g.genres,
    g.min_players,
    g.max_players,
    g.avg_playtime_minutes,
    g.cover_url,
    g.is_free,
    ts_rank(g.search_vector, websearch_to_tsquery('english', p_query)) AS rank
  FROM   public.games g
  WHERE  g.search_vector @@ websearch_to_tsquery('english', p_query)
  ORDER  BY rank DESC, g.title;
$$;

GRANT EXECUTE ON FUNCTION public.search_games(TEXT) TO anon, authenticated;
