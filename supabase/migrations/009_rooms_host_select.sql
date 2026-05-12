-- Allow the room host to SELECT their own room.
-- Without this, INSERT...RETURNING fails because the creator isn't in
-- room_members yet, so the existing rooms_select_member policy blocks
-- the RETURNING clause and PostgREST reports it as an RLS violation.
CREATE POLICY "rooms_select_host"
  ON public.rooms FOR SELECT
  USING (host_id = auth.uid());
