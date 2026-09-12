-- ====================================================================
-- 0009_add_participant_last_read_at.sql
-- Read receipts (chat v1, refresh-based, no real-time). Each
-- conversation_participants row gains a last_read_at timestamp, bumped
-- whenever a user opens/fetches that conversation's messages
-- (GET /conversations/:id/messages). When rendering a thread, a message
-- the current user sent shows "Seen" when the other participant's
-- last_read_at is >= the message's created_at, else "Delivered".
-- Nullable: a conversation nobody has opened has no read timestamp.
-- Guarded so re-running is safe.
-- ====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversation_participants'
      and column_name = 'last_read_at'
  ) then
    alter table conversation_participants add column last_read_at timestamptz;
  end if;
end $$;