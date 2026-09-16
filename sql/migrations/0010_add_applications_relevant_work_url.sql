-- ====================================================================
-- 0010_add_applications_relevant_work_url.sql
-- Applications gain an optional "link to relevant work" URL (live demo,
-- past project, or something more specific to the role than the general
-- profile). The application pitch (pitch_note) stays on the existing
-- column and becomes REQUIRED at the API level.
-- Guarded so re-running is safe.
-- ====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'relevant_work_url'
  ) then
    alter table applications add column relevant_work_url text;
  end if;
end $$;