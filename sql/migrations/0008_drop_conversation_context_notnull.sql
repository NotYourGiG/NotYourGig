-- ====================================================================
-- 0008_drop_conversation_context_notnull.sql
-- Chat v1 is a simple user-to-user thread with no connection/project
-- context, but conversations.context_type / context_id were NOT NULL
-- from the original context-scoped design (0001). Drop NOT NULL so a
-- plain 1:1 conversation can store no context at all; future
-- connection/project-scoped chats can still set these columns.
-- Guarded so re-running is safe.
-- ====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversations'
      and column_name = 'context_type'
      and is_nullable = 'NO'
  ) then
    alter table conversations alter column context_type drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversations'
      and column_name = 'context_id'
      and is_nullable = 'NO'
  ) then
    alter table conversations alter column context_id drop not null;
  end if;
end $$;