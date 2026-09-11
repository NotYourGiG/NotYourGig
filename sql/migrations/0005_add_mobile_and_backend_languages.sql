-- ====================================================================
-- 0005_add_mobile_and_backend_languages.sql
-- Additive seed: extend the curated skills master list with common
-- languages missing from the original 32-skill seed (0002). Requested
-- before tester feedback (a real test project needs Swift; Kotlin/C++/C#/
-- Java/Objective-C cover the other mobile/backend gaps).
--
-- Matches the 0002 seed pattern: idempotent (on conflict do nothing), so
-- re-running is safe, and it won't touch rows a user/seed already created.
-- The `skills.name` unique constraint guarantees no duplicates.
--
-- Category choices are conservative and consistent with the existing list:
-- Apple-family languages (Swift, Objective-C) sit with React Native/Flutter
-- under 'Mobile'; general-purpose server languages (Kotlin, Java, C++, C#)
-- sit with Node.js/Python/Go/Rust under 'Backend'. These are easy to change
-- later if a language finds a different home.
-- ====================================================================

begin;

insert into skills (name, category) values
  ('Swift', 'Mobile'),
  ('Kotlin', 'Backend'),
  ('Java', 'Backend'),
  ('C++', 'Backend'),
  ('C#', 'Backend'),
  ('Objective-C', 'Mobile')
on conflict (name) do nothing;

commit;