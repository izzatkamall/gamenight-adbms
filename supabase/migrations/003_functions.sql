-- =============================================================
-- GameNight — Migration 003: Functions & Triggers
-- Run after 002_rls.sql
-- =============================================================

-- =============================================================
-- TRIGGER: Auto-create profile row on user registration
-- SECURITY DEFINER lets this run as the function owner (postgres)
-- and bypass RLS to insert into profiles.
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- FUNCTION: get_common_games(room_id)
-- Returns all games owned by EVERY member of the room.
-- Uses HAVING COUNT to enforce the full-intersection condition.
-- SECURITY DEFINER bypasses user_libraries RLS for cross-user read.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_common_games(p_room_id UUID)
RETURNS SETOF public.games AS $$
  SELECT g.*
  FROM   public.games g
  JOIN   public.user_libraries ul ON ul.game_id = g.id
  WHERE  ul.user_id IN (
    SELECT user_id FROM public.room_members WHERE room_id = p_room_id
  )
  GROUP BY g.id
  HAVING COUNT(DISTINCT ul.user_id) = (
    SELECT COUNT(*) FROM public.room_members WHERE room_id = p_room_id
  )
  ORDER BY g.title;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================
-- FUNCTION: get_shortlist(room_id)
-- Returns the top 5 common games ranked by the group's average
-- genre preference weight. Falls back to 0.5 for missing weights
-- (neutral score for new users with no history).
-- SECURITY DEFINER bypasses RLS for cross-user profile reads.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_shortlist(p_room_id UUID)
RETURNS TABLE (
  id                   INT,
  title                TEXT,
  genres               TEXT[],
  min_players          INT,
  max_players          INT,
  avg_playtime_minutes INT,
  cover_url            TEXT,
  steam_app_id         INT,
  is_free              BOOLEAN,
  group_score          FLOAT
) AS $$
  SELECT
    g.id,
    g.title,
    g.genres,
    g.min_players,
    g.max_players,
    g.avg_playtime_minutes,
    g.cover_url,
    g.steam_app_id,
    g.is_free,
    AVG(
      COALESCE(
        (p.preferences -> 'genre_weights' ->> (g.genres[1]))::float,
        0.5
      )
    ) AS group_score
  FROM   public.games g
  JOIN   public.user_libraries ul ON ul.game_id = g.id
  JOIN   public.profiles p        ON p.id = ul.user_id
  WHERE  ul.user_id IN (
    SELECT user_id FROM public.room_members WHERE room_id = p_room_id
  )
  GROUP BY g.id
  HAVING COUNT(DISTINCT ul.user_id) = (
    SELECT COUNT(*) FROM public.room_members WHERE room_id = p_room_id
  )
  ORDER BY group_score DESC
  LIMIT 5;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================
-- FUNCTION: update_user_preferences(user_id, game_id, rating)
-- Called after a session rating is submitted.
-- Updates genre_weights in the JSONB preference profile using
-- an exponential moving average (EMA):
--   new_weight = old_weight * 0.8 + normalized_rating * 0.2
-- This makes recent sessions matter more than old ones.
-- Also increments total_sessions counter.
-- =============================================================
CREATE OR REPLACE FUNCTION public.update_user_preferences(
  p_user_id UUID,
  p_game_id INT,
  p_rating  INT
)
RETURNS VOID AS $$
DECLARE
  v_genres           TEXT[];
  v_genre            TEXT;
  v_current_weight   FLOAT;
  v_new_weight       FLOAT;
  v_normalized       FLOAT;
BEGIN
  -- Normalize rating 1–5 to 0.0–1.0
  v_normalized := p_rating / 5.0;

  -- Fetch genres of the rated game
  SELECT genres INTO v_genres
  FROM   public.games
  WHERE  id = p_game_id;

  -- Update each genre's weight with EMA
  FOREACH v_genre IN ARRAY COALESCE(v_genres, '{}') LOOP
    SELECT COALESCE(
      (preferences -> 'genre_weights' ->> v_genre)::float,
      0.5
    )
    INTO v_current_weight
    FROM public.profiles
    WHERE id = p_user_id;

    v_new_weight := v_current_weight * 0.8 + v_normalized * 0.2;

    UPDATE public.profiles
    SET preferences = jsonb_set(
      preferences,
      ARRAY['genre_weights', v_genre],
      to_jsonb(round(v_new_weight::numeric, 4))
    )
    WHERE id = p_user_id;
  END LOOP;

  -- Increment total_sessions
  UPDATE public.profiles
  SET preferences = jsonb_set(
    preferences,
    ARRAY['total_sessions'],
    to_jsonb(
      COALESCE((preferences ->> 'total_sessions')::int, 0) + 1
    )
  )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- FUNCTION: get_room_by_invite_code(code)
-- Lets a user look up a room by its invite code before joining.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_room_by_invite_code(p_code TEXT)
RETURNS SETOF public.rooms AS $$
  SELECT * FROM public.rooms
  WHERE  invite_code = upper(trim(p_code))
  AND    status != 'closed';
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================
-- FUNCTION: get_session_stats(user_id)
-- Returns aggregate stats for the profile page.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_sessions   BIGINT,
  total_hours      NUMERIC,
  avg_rating_given NUMERIC,
  most_played_game TEXT
) AS $$
  SELECT
    COUNT(DISTINCT gs.id)                                    AS total_sessions,
    ROUND(SUM(COALESCE(gs.duration_minutes, 0)) / 60.0, 1)  AS total_hours,
    ROUND(AVG(sr.rating), 1)                                 AS avg_rating_given,
    (
      SELECT g2.title
      FROM   public.game_sessions gs2
      JOIN   public.games g2 ON g2.id = gs2.game_id
      WHERE  gs2.room_id IN (
        SELECT room_id FROM public.room_members WHERE user_id = p_user_id
      )
      GROUP BY g2.id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )                                                        AS most_played_game
  FROM   public.game_sessions gs
  JOIN   public.room_members  rm ON rm.room_id = gs.room_id AND rm.user_id = p_user_id
  LEFT JOIN public.session_ratings sr ON sr.session_id = gs.id AND sr.user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;
