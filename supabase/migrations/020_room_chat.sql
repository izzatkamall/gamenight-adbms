-- =============================================================
-- GameNight — Migration 020: Room Chat
--
-- Persistent chat messages per room, stored in PostgreSQL and
-- delivered in real-time via Supabase Realtime postgres_changes.
-- RLS ensures only room members can read/write messages.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.room_messages (
  id         BIGSERIAL    PRIMARY KEY,
  room_id    UUID         NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_messages_room_created
  ON public.room_messages (room_id, created_at ASC);

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages REPLICA IDENTITY FULL;

CREATE POLICY "room_messages_select_member"
  ON public.room_messages FOR SELECT
  USING (room_id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid())));

CREATE POLICY "room_messages_insert_own"
  ON public.room_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND room_id IN (SELECT room_id FROM public.get_user_room_ids(auth.uid()))
  );

GRANT SELECT, INSERT ON public.room_messages TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  END IF;
END $$;

-- ── get_room_messages ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_room_messages(
  p_room_id UUID,
  p_limit   INT DEFAULT 60
)
RETURNS TABLE (
  id         BIGINT,
  user_id    UUID,
  username   TEXT,
  content    TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rm.id, rm.user_id, p.username, rm.content, rm.created_at
  FROM   room_messages rm
  JOIN   profiles p ON p.id = rm.user_id
  WHERE  rm.room_id = p_room_id
  ORDER  BY rm.created_at ASC
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_messages(UUID, INT) TO authenticated;
