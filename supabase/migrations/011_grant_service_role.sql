-- =============================================================
-- GameNight — Migration 011: Grant service_role table access
-- Tables created via SQL migrations don't get the automatic
-- service_role grants that the Supabase dashboard adds.
-- The middleware uses the service role key and needs full access.
-- =============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
