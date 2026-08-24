-- ====================================================================
-- 0004_oauth_state.sql
-- Additive schema for server-side OAuth state storage (GitHub proof-of-work
-- verification).
--
-- Replaces the cookie-based flow. Modern browsers (Chrome/Edge/Safari/Firefox
-- 2024+) drop Set-Cookie on cross-origin fetch() responses even with
-- credentials:"include" + SameSite=None; Secure, so a state cookie never
-- survives the connect -> github.com -> callback redirect chain. Instead:
--   GET /api/auth/github/connect (Clerk-guarded) returns a one-time random
--       state_token in the JSON body, and we persist a row here binding the
--       token to the authenticated user (authUser.id) with a short TTL.
--   GET /api/auth/github/callback (browser redirect) verifies the GitHub
--       `state` query param by looking up + deleting this row (single-use),
--       so CSRF protection is backed by the DB, not by a browser cookie.
--
-- Random one-time tokens are high-entropy; the table carries no secrets that
-- need hashing, and tokens are deleted on use. Cleanup of expired rows can be
-- a later cron/trigger — rows are tiny and TTL is 10 minutes.
-- ====================================================================

begin;

create table oauth_state (
  state_token text primary key,        -- one-time token returned to the frontend in the connect JSON body
  user_id uuid not null references users(id),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index oauth_state_user_id_idx on oauth_state (user_id);

commit;