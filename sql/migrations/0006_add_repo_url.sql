-- ====================================================================
-- 0006_add_repo_url.sql
-- Add an optional GitHub repo link to projects. Backs the "GitHub Repo
-- URL" field on the Post a Project form; the project detail page shows
-- a plain outbound "View on GitHub" link when it is set (no README
-- fetching, as decided).
--
-- Guarded so it is safe to re-run in the Supabase SQL editor or as part
-- of a future migration batch.
-- ====================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'repo_url'
  ) then
    alter table projects add column repo_url text;
  end if;
end $$;