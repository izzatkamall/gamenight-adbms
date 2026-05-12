-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- games is a public catalog readable by everyone
GRANT SELECT ON public.games TO anon, authenticated;

-- authenticated users manage their own data
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_libraries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rooms TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.room_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.voting_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.game_sessions TO authenticated;
GRANT SELECT, INSERT ON public.session_ratings TO authenticated;
