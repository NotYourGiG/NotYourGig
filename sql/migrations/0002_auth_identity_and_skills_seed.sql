-- ====================================================================
-- 0002_auth_identity_and_skills_seed.sql
-- Two additive changes required by the auth + profile build:
--
-- 1) users.clerk_id — identity link between Clerk (chosen auth provider,
--    blueprint §10) and our users row. Flagged addition to blueprint §6
--    `users`: one nullable column + a partial unique index. Keeps the
--    Clerk-user -> our-user mapping O(1) in the DB instead of a Clerk API
--    round-trip per protected request (email-mapping would need that).
--
-- 2) Seed the curated skills master list. Blueprint §6 calls skills a
--    "curated master list... prevents 'React' vs 'react.js' mess"; the
--    table is empty, so the skill picker/search has nothing to show.
--    Idempotent (on conflict do nothing).
-- ====================================================================

-- --------------------------- 1) clerk identity ---------------------

alter table users add column clerk_id text;
create unique index users_clerk_id_key on users (clerk_id) where clerk_id is not null;

-- ------------------------- 2) skills seed --------------------------

insert into skills (name, category) values
  ('React', 'Frontend'),
  ('Vue', 'Frontend'),
  ('Next.js', 'Frontend'),
  ('TypeScript', 'Frontend'),
  ('JavaScript', 'Frontend'),
  ('HTML/CSS', 'Frontend'),
  ('Tailwind CSS', 'Frontend'),
  ('Node.js', 'Backend'),
  ('Python', 'Backend'),
  ('Go', 'Backend'),
  ('Rust', 'Backend'),
  ('PostgreSQL', 'Backend'),
  ('REST APIs', 'Backend'),
  ('GraphQL', 'Backend'),
  ('NestJS', 'Backend'),
  ('Figma', 'Design'),
  ('UI/UX Design', 'Design'),
  ('Product Design', 'Design'),
  ('Solidity', 'Blockchain'),
  ('Smart Contracts', 'Blockchain'),
  ('Web3', 'Blockchain'),
  ('React Native', 'Mobile'),
  ('Flutter', 'Mobile'),
  ('Docker', 'DevOps'),
  ('AWS', 'DevOps'),
  ('CI/CD', 'DevOps'),
  ('SQL', 'Data'),
  ('Data Analysis', 'Data'),
  ('Machine Learning', 'Data'),
  ('Product Management', 'Other'),
  ('Marketing', 'Other'),
  ('Copywriting', 'Other')
on conflict (name) do nothing;
