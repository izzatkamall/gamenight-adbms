-- =============================================================
-- GameNight — Migration 010: Phase 5 — Enable Realtime on rooms
-- Supabase Postgres Changes subscriptions require the table to be
-- in the supabase_realtime publication.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
END
$$;
