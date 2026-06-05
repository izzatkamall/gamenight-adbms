-- =============================================================
-- GameNight — Migration 019: Audit Log — room_events table
--
-- Captures every significant room event via AFTER triggers on
-- room_members, voting_sessions, and game_sessions.
-- Trigger functions are SECURITY DEFINER so they can always
-- write to room_events regardless of which role fired the DML.
-- =============================================================

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_events (
  id         BIGSERIAL    PRIMARY KEY,
  room_id    UUID         NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id    UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT         NOT NULL,
  metadata   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_events_room_created
  ON public.room_events (room_id, created_at DESC);

ALTER TABLE public.room_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_events_select_member"
  ON public.room_events FOR SELECT
  USING (room_id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid())));

GRANT SELECT ON public.room_events TO authenticated;

-- ── Trigger: room_members ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_room_member_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO room_events (room_id, user_id, event_type)
    VALUES (NEW.room_id, NEW.user_id, 'member_joined');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO room_events (room_id, user_id, event_type)
    VALUES (OLD.room_id, OLD.user_id, 'member_left');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_member_events ON public.room_members;
CREATE TRIGGER trg_room_member_events
  AFTER INSERT OR DELETE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.log_room_member_event();

-- ── Trigger: voting_sessions ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_voting_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_title TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO room_events (room_id, event_type)
    VALUES (NEW.room_id, 'vote_started');

  ELSIF TG_OP = 'UPDATE'
    AND NEW.winner_game_id IS NOT NULL
    AND OLD.winner_game_id IS NULL
  THEN
    SELECT title INTO v_title FROM games WHERE id = NEW.winner_game_id;
    INSERT INTO room_events (room_id, event_type, metadata)
    VALUES (NEW.room_id, 'vote_ended',
      jsonb_build_object('game_id', NEW.winner_game_id, 'game_title', v_title));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_voting_events ON public.voting_sessions;
CREATE TRIGGER trg_voting_events
  AFTER INSERT OR UPDATE ON public.voting_sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_voting_event();

-- ── Trigger: game_sessions ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_game_session_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_title TEXT;
BEGIN
  SELECT title INTO v_title FROM games WHERE id = NEW.game_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO room_events (room_id, event_type, metadata)
    VALUES (NEW.room_id, 'session_started',
      jsonb_build_object('game_id', NEW.game_id, 'game_title', v_title));

  ELSIF TG_OP = 'UPDATE'
    AND NEW.ended_at IS NOT NULL
    AND OLD.ended_at IS NULL
  THEN
    INSERT INTO room_events (room_id, event_type, metadata)
    VALUES (NEW.room_id, 'session_ended',
      jsonb_build_object(
        'game_id',          NEW.game_id,
        'game_title',       v_title,
        'duration_minutes', NEW.duration_minutes
      ));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_game_session_events ON public.game_sessions;
CREATE TRIGGER trg_game_session_events
  AFTER INSERT OR UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_game_session_event();

-- ── get_room_activity(room_id) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_room_activity(
  p_room_id UUID,
  p_limit   INT DEFAULT 20
)
RETURNS TABLE (
  id         BIGINT,
  event_type TEXT,
  username   TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    re.id,
    re.event_type,
    p.username,
    re.metadata,
    re.created_at
  FROM   room_events re
  LEFT JOIN profiles p ON p.id = re.user_id
  WHERE  re.room_id = p_room_id
  ORDER  BY re.created_at DESC
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_activity(UUID, INT) TO authenticated;
