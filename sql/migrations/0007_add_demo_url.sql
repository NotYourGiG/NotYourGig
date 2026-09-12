-- ====================================================================
-- 0007_add_demo_url.sql
-- Add an optional live-demo link to projects, alongside the existing
-- repo_url column (0006). The Post a Project form now captures two
-- separate optional links — "GitHub Repo URL" (repo_url) and "Live Demo
-- URL" (demo_url) — matching the two-field pattern already used in the
-- Proof of Work section. The project detail page renders each as its own
-- outbound link ("View on GitHub" / "View Live Demo") when set.
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
      and column_name = 'demo_url'
  ) then
    alter table projects add column demo_url text;
  end if;
end $$;