-- ====================================================================
-- 0001_init_phase1.sql
-- Not Your Gig — Phase 1 schema (raw SQL, no ORM).
-- Source of truth: blueprint.md Section 6 (Full Database Schema).
-- Applies: build-order steps 1-3 — users/skills/proof_of_work,
-- projects core loop, connections/conversations/messages.
-- Apply by pasting into Supabase SQL Editor (see `npm run db:apply-notice`).
-- ====================================================================

-- Enum approach chosen: native Postgres enum types.
-- Why: blueprint labels these fields "enum" throughout, native types map
-- 1:1 to that wording and stay introspectable via \dT. CHECK constraints
-- would be just as valid but need invented constraint names and read as
-- ad-hoc validation rather than types.
-- ponytail: adding an enum value later requires `ALTER TYPE ... ADD VALUE`
-- (allowed in a transaction on PG12+ with caveats). If enum churn becomes
-- frequent, migrate the field to text + a CHECK constraint instead.

begin;

-- ------------------------------ enums -----------------------------

create type availability_status as enum ('available', 'busy', 'not_looking');
create type primary_role as enum ('builder', 'founder', 'both');
create type skill_level as enum ('beginner', 'intermediate', 'advanced', 'expert');
create type proof_source as enum ('manual', 'auto_from_project');
create type project_type as enum ('paid', 'unpaid', 'equity', 'learning');
create type project_status as enum ('open', 'in_progress', 'completed', 'cancelled');
create type seniority as enum ('any', 'junior', 'mid', 'senior');
create type application_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type connection_status as enum ('pending', 'accepted', 'declined');
create type conversation_context_type as enum ('connection', 'project');

-- --------------------------- users / skills -----------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text, -- nullable for OAuth-only accounts (Clerk/Auth.js later)
  name text not null,
  avatar_url text,
  headline text,
  bio text,
  location text,
  availability_status availability_status not null default 'available',
  primary_role primary_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- curated master list prevents "React" vs "react.js" mess
  category text -- e.g. 'Frontend', 'Backend', 'Design', 'Blockchain'
);

create table user_skills (
  user_id uuid not null references users(id),
  skill_id uuid not null references skills(id),
  level skill_level not null,
  primary key (user_id, skill_id)
);

-- ----------------------- organizations (minimal) -------------------
-- Phase 1 excludes orgs, but blueprint Section 6 defines
-- projects.posted_by_org_id -> organizations, so the referenced table
-- must exist for the FK. Core fields only; organization_members and the
-- org feature itself are deferred to the organizations phase.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id),
  name text not null,
  description text,
  website_url text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------ projects --------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  posted_by_user_id uuid references users(id), -- set if posted by an individual
  posted_by_org_id uuid references organizations(id), -- set if posted by an org
  title text not null,
  description text not null,
  type project_type not null,
  budget_amount integer, -- in cents
  budget_currency text default 'INR',
  status project_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- blueprint Section 6: exactly one of posted_by_user_id / posted_by_org_id
alter table projects
  add constraint one_poster_only check (
    (posted_by_user_id is not null and posted_by_org_id is null)
    or (posted_by_user_id is null and posted_by_org_id is not null)
  );

create table project_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  skill_id uuid not null references skills(id),
  seniority seniority not null default 'any',
  headcount_needed integer not null default 1,
  headcount_filled integer not null default 0
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  project_role_id uuid not null references project_roles(id),
  applicant_user_id uuid not null references users(id),
  pitch_note text, -- optional note/pitch
  status application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects(id),
  user_id uuid not null references users(id),
  project_role_id uuid not null references project_roles(id),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table proof_of_work (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  title text not null,
  description text,
  link_github text,
  link_live_demo text,
  link_other text,
  role_played text, -- what this user specifically did
  source proof_source not null default 'manual', -- auto when generated by a completed Project
  source_project_id uuid references projects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------- connections / conversations -------------------

create table connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id),
  receiver_id uuid not null references users(id),
  status connection_status not null default 'pending',
  message text, -- optional short message on the request
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  context_type conversation_context_type not null, -- connection | project
  context_id uuid not null, -- connection_id or project_id depending on context_type
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversation_participants (
  conversation_id uuid not null references conversations(id),
  user_id uuid not null references users(id),
  primary key (conversation_id, user_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id),
  sender_id uuid not null references users(id),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------- indexes (Section 6) -------------------------

-- Indexing notes, Phase 1 tables:
create index projects_status_type_idx on projects (status, type); -- main Browse query
create index project_roles_skill_id_idx on project_roles (skill_id); -- filter by skill needed
create index user_skills_skill_id_idx on user_skills (skill_id); -- Explore Builders by skill
create index applications_project_role_id_status_idx on applications (project_role_id, status); -- reviewing applicants

-- Full-text search on projects(title, description) and users(headline, bio)
-- is intentionally deferred: blueprint says "don't build this on day 1,
-- just leave room for it" (Section 6 Indexing notes).

commit;

