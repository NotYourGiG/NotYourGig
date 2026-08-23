-- ====================================================================
-- 0003_github_verification.sql
-- Additive schema for GitHub proof-of-work verification.
--
-- Getting-started notes:
-- 1) users.github_username / github_connected_at — the connected GitHub
--    identity and when the connection happened. Both null until a user
--    completes "Connect GitHub". We deliberately do NOT persist the OAuth
--    access token: this is a one-time fetch on connect (no live sync), so
--    there is no token column.
--
-- 2) user_skills.verified_via — nullable enum flag used when an existing
--    user_skills row has been verified against an external source.
--    'github' for now; future providers would extend this enum
--    (create type ... as enum; add value requires ALTER TYPE ... ADD VALUE).
-- ====================================================================

begin;

-- --------------------------- 1) verification source ------------------
create type verification_source as enum ('github');

-- ------------------------------ 2) users --------------------------------
alter table users
  add column github_username text,
  add column github_connected_at timestamptz;

-- ------------------------- 3) user_skills --------------------------------
alter table user_skills add column verified_via verification_source;

commit;