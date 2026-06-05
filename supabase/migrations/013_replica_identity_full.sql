-- =============================================================
-- GameNight — Migration 013: REPLICA IDENTITY FULL for Realtime
--
-- Supabase Realtime postgres_changes UPDATE events only include
-- the primary key in payload.new when REPLICA IDENTITY is DEFAULT.
-- Setting FULL ensures all column values are available so the
-- frontend can read payload.new.status, payload.new.ended_at, etc.
-- =============================================================

ALTER TABLE public.rooms          REPLICA IDENTITY FULL;
ALTER TABLE public.game_sessions  REPLICA IDENTITY FULL;
