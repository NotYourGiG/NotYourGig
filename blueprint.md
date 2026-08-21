# Builder Network — Full Product & Technical Blueprint (v0.2)

> Status: Pre-build reference document for engineering (handoff-ready for AI coding agents)
> Core philosophy: **"Resume tells. Proof demonstrates." — Proof > Resume**

---

## 1. Vision

A single platform where builders prove what they can do by showing real work, and where three needs are served by ONE unified system instead of three separate products:

1. **Find Work** — builders find paid/unpaid opportunities with startups
2. **Find Talent** — founders find trustworthy builders using proof, not resumes
3. **Find a Builder** — builders find complementary teammates to build together

These three are NOT three separate features. They are the same core loop — "someone needs people with certain skills for a project" — filtered differently depending on who's looking. Building them as one system keeps the codebase simple and lets every part scale together.

---

## 2. Core Personas

| Persona | Description | Primary goal |
|---|---|---|
| Builder | Student, freelancer, indie hacker | Prove skill, get work or a team |
| Founder | Early-stage startup owner, hiring manager | Find trustworthy talent fast |
| Organization | A registered startup/company (owned by a Founder) | Post real paid work, build a hiring pipeline |

A single `User` can be a Builder in one context and a Founder in another — these are roles, not separate account types.

---

## 3. Unified Core Concept

Everything in this platform is built around two objects:

- **Proof** — evidence of what a user has done (GitHub repo, live demo, past project, review from a collaborator)
- **Project** — a listing that needs people with specific skills, posted by either an individual builder or an organization

A `Project` posted by a solo builder with no budget = **Find a Builder**.
A `Project` posted by an organization with a budget = **Find Talent** (from the org's side) / **Find Work** (from the builder's side).

Same tables, same APIs, same UI components — just different values in a few fields. This is the key architectural decision behind this whole blueprint.

---

## 4. Complete User Flows

### 4.1 Onboarding (all users)
```
Sign up (email or OAuth)
→ Choose primary role tag: Builder / Founder / Both
→ Create profile (headline, bio, location, availability)
→ Add skills (from curated skill list + proficiency level)
→ Add Proof of Work (GitHub link, live demo, portfolio, past project write-up)
→ Land on Dashboard
```

### 4.2 Post a Project (builder OR founder — same flow)
```
Dashboard → New Project
→ Enter title, description
→ Select type: Paid / Unpaid / Equity / Learning-Collab
→ Post as: Myself (individual) OR an Organization (if one is set up)
→ Add roles needed (one or more): skill required, headcount, seniority
→ Set budget (optional, only relevant if Paid)
→ Publish
→ Review applicants as they come in
→ View each applicant's Proof + Skills
→ Accept / Reject / Message
→ Mark role filled → Project moves to "In Progress" when all roles filled
```

### 4.3 Browse & Apply (all users)
```
Home → Browse Projects
→ Filter: Paid / Unpaid / Skill needed / Remote-Onsite / Posted by (Org vs Individual)
→ Open a Project → view description, roles, poster's profile + track record
→ Apply to a specific role → optional note/pitch
→ Wait for response (status: pending)
→ If accepted → added to Project's team → Chat unlocked with team
```

### 4.4 Find a specific Builder directly (browse people, not projects)
```
Home → Explore Builders
→ Filter by skill, availability, location
→ View profile: Skills, Proof of Work, past Projects (completed), Reviews
→ Send Connection Request (optional short message)
→ If accepted → Chat unlocked
```

### 4.5 Organization setup (Founder only)
```
Dashboard → Create Organization
→ Name, description, website, logo
→ Invite team members (existing Users) with a role (owner/admin/member)
→ Organization can now post Projects under its name instead of the individual
```

### 4.6 Completing a Project → Building Proof (the loop that makes the platform valuable over time)
```
Project marked "Complete" by poster
→ All team members prompted to leave a Review for each other
→ Completed project auto-added to each member's Proof of Work
→ This proof strengthens their profile for the NEXT cycle of applying/posting
```

This closing loop is important: it's what makes "Proof > Resume" actually compound over time instead of being a one-time profile fill-in.

---

## 5. Information Architecture

```
Public
 - Landing page
 - Browse Projects (public, limited detail without login)
 - Explore Builders (public, limited detail without login)

Authenticated
 Home
  - Browse Projects        (filters: paid/unpaid, skill, org/individual)
  - Explore Builders        (filters: skill, availability, location)
  - Post a Project
  - Notifications

 Dashboard
  - My Profile              (edit skills, proof, availability)
  - My Projects             (posted by me — as individual or org)
  - My Applications         (projects I've applied to)
  - My Teams                (active projects I'm part of)
  - Connections / Chat
  - Organization Settings   (only visible if user owns/admins an org)

 Project Detail Page
  - Overview / description
  - Roles needed + fill status
  - Poster info (individual profile OR org profile)
  - Apply button (per role)
  - Team (once roles are filled)

 Profile Page (Builder or Org)
  - Header: name, headline, avatar, location
  - Skills (tagged, leveled)
  - Proof of Work (cards: title, links, description, role played)
  - Completed Projects (auto-populated from platform history)
  - Reviews (from past collaborators/founders)
  - Availability status
```

---

## 6. Full Database Schema (Scalable, PostgreSQL — raw SQL, no ORM)

Naming convention: snake_case columns, plural table names, every table has `id` (UUID), `created_at`, `updated_at`.

Schema is written and applied as plain SQL migration files, run directly against Supabase (via the SQL editor or the Supabase CLI) — see Section 10 for how migrations are tracked without an ORM.

```
users
- id (uuid, pk)
- email (unique)
- password_hash (nullable if OAuth-only)
- name
- avatar_url
- headline
- bio
- location
- availability_status        enum: available / busy / not_looking
- primary_role                enum: builder / founder / both
- created_at, updated_at

skills
- id (uuid, pk)
- name (unique)               -- curated master list, prevents "React" vs "react.js" mess
- category                    -- e.g. "Frontend", "Backend", "Design", "Blockchain"

user_skills
- user_id (fk -> users)
- skill_id (fk -> skills)
- level                        enum: beginner / intermediate / advanced / expert
- PRIMARY KEY (user_id, skill_id)

proof_of_work
- id (uuid, pk)
- user_id (fk -> users)
- title
- description
- link_github (nullable)
- link_live_demo (nullable)
- link_other (nullable)
- role_played                  -- what this user specifically did
- source                        enum: manual / auto_from_project  -- auto when generated by a completed Project
- source_project_id (nullable fk -> projects)
- created_at

organizations
- id (uuid, pk)
- owner_id (fk -> users)
- name
- description
- website_url (nullable)
- logo_url (nullable)
- created_at, updated_at

organization_members
- organization_id (fk -> organizations)
- user_id (fk -> users)
- role                          enum: owner / admin / member
- PRIMARY KEY (organization_id, user_id)

projects
- id (uuid, pk)
- posted_by_user_id (fk -> users, nullable)         -- set if posted by an individual
- posted_by_org_id (fk -> organizations, nullable)  -- set if posted by an org
- title
- description
- type                          enum: paid / unpaid / equity / learning
- budget_amount (nullable, integer, in cents)
- budget_currency (nullable, default 'INR')
- status                        enum: open / in_progress / completed / cancelled
- created_at, updated_at
-- CONSTRAINT: exactly one of posted_by_user_id / posted_by_org_id must be set

project_roles
- id (uuid, pk)
- project_id (fk -> projects)
- skill_id (fk -> skills)
- seniority                     enum: any / junior / mid / senior
- headcount_needed (int, default 1)
- headcount_filled (int, default 0)

applications
- id (uuid, pk)
- project_id (fk -> projects)
- project_role_id (fk -> project_roles)
- applicant_user_id (fk -> users)
- pitch_note (nullable, text)
- status                        enum: pending / accepted / rejected / withdrawn
- created_at, updated_at

project_members
- project_id (fk -> projects)
- user_id (fk -> users)
- project_role_id (fk -> project_roles)
- joined_at
- PRIMARY KEY (project_id, user_id)

connections
- id (uuid, pk)
- sender_id (fk -> users)
- receiver_id (fk -> users)
- status                        enum: pending / accepted / declined
- message (nullable)
- created_at

conversations
- id (uuid, pk)
- context_type                  enum: connection / project
- context_id (uuid)             -- connection_id or project_id depending on context_type
- created_at

conversation_participants
- conversation_id (fk -> conversations)
- user_id (fk -> users)
- PRIMARY KEY (conversation_id, user_id)

messages
- id (uuid, pk)
- conversation_id (fk -> conversations)
- sender_id (fk -> users)
- content (text)
- created_at

reviews
- id (uuid, pk)
- project_id (fk -> projects)
- reviewer_id (fk -> users)
- reviewed_user_id (fk -> users)
- rating (int, 1-5)
- feedback (text, nullable)
- created_at

verifications
- id (uuid, pk)
- user_id (fk -> users)
- type                          enum: github / email / phone / linkedin
- status                        enum: pending / verified / failed
- verified_at (nullable)
- created_at

notifications
- id (uuid, pk)
- user_id (fk -> users)
- type                          -- e.g. "new_application", "application_accepted", "new_message"
- payload (jsonb)
- read_at (nullable)
- created_at
```

### Indexing notes (for scale from day 1)
- Index `projects(status, type)` — this is the main Browse query.
- Index `project_roles(skill_id)` — powers "filter by skill needed."
- Index `user_skills(skill_id)` — powers "Explore Builders by skill."
- Index `applications(project_role_id, status)` — founders reviewing applicants.
- Full-text search index on `projects(title, description)` and `users(headline, bio)` (Postgres `tsvector`, or move to a search service like Meilisearch/Typesense once volume grows — don't build this on day 1, just leave room for it).

---

## 7. API Structure (REST, resource-based)

```
Auth
 POST   /auth/signup
 POST   /auth/login
 POST   /auth/oauth/:provider

Users / Profile
 GET    /users/:id
 PATCH  /users/:id
 GET    /users/:id/skills
 POST   /users/:id/skills
 GET    /users/:id/proof
 POST   /users/:id/proof
 GET    /users/:id/reviews

Organizations
 POST   /organizations
 GET    /organizations/:id
 PATCH  /organizations/:id
 POST   /organizations/:id/members
 GET    /organizations/:id/projects

Projects
 GET    /projects                  (filters: type, skill, status, org_id)
 POST   /projects
 GET    /projects/:id
 PATCH  /projects/:id
 POST   /projects/:id/roles
 GET    /projects/:id/applications

Applications
 POST   /applications              (apply to a project_role)
 PATCH  /applications/:id          (accept / reject / withdraw)

Connections
 POST   /connections
 PATCH  /connections/:id
 GET    /users/:id/connections

Messaging
 GET    /conversations
 GET    /conversations/:id/messages
 POST   /conversations/:id/messages

Search
 GET    /search/projects
 GET    /search/builders
```

---

## 8. UI Principles

- Minimal, clean whitespace, neutral colors, card-based layout
- Search-first — Browse Projects and Explore Builders are the two primary entry points, not buried in a menu
- Every profile and project detail page should answer "why should I trust this" in the first screen (proof visible above the fold)
- Mobile responsive from day 1
- Fast loading — paginate all list views (Projects, Builders) server-side, never load full tables client-side

---

## 9. Matching (kept simple by design)

Do not build a scoring algorithm on day 1. Use structured filters instead:
- Skill match (exact skill_id match, required)
- Availability match (available_now filter)
- Type match (paid/unpaid)

A weighted "Match Score" algorithm becomes worth building only after there's real usage data to tune it against. Building it earlier means tuning it on guesses, not real behavior — wasted engineering effort. This is the one part of the original blueprint I'd actively recommend NOT front-loading, even in a "build for scale" approach, because it's not a scaling problem — it's a data problem, and there's no data yet.

---

## 10. Tech Stack (finalized)

```
Frontend      React (Vite), React Router, Tailwind CSS, shadcn/ui
              -- No Next.js: no built-in SSR. Public pages meant for
              Google/new visitors (Browse Projects, Explore Builders,
              Landing) will be client-rendered only. Acceptable trade-off
              for speed of building now; revisit if organic search
              traffic becomes a growth channel later.
Backend       Node.js, NestJS (module structure, dependency injection,
              built-in validation — matters once codebase grows past MVP)
Database      Supabase (Postgres) — used as DB ONLY, not for its bundled
              auth/storage/realtime. Schema in Section 6 is unchanged.
DB Access     No ORM. Supabase JS client (`@supabase/supabase-js`) for
              queries from the NestJS backend, OR raw `pg` + hand-written
              SQL if full control over queries is preferred. No Prisma.
Migrations    Plain `.sql` files kept in `/sql/migrations/`, numbered in
              order (e.g. `0001_init_phase1.sql`). Applied by pasting into
              Supabase's SQL editor, or via `supabase db push` if using
              the Supabase CLI. No ORM-managed migration history — the
              numbered files ARE the history, kept in git.
Auth          Clerk or Auth.js (kept separate from Supabase Auth by choice)
Realtime      For chat: WebSockets (Socket.IO or native ws) or a managed
              service (Pusher/Ably) — don't build custom realtime infra
              on day 1
Storage       Cloudflare R2 (avatars, org logos, proof-of-work assets)
Search        Postgres full-text to start; Meilisearch/Typesense once
              Browse Projects / Explore Builders traffic grows
Deployment    Vercel (frontend), Supabase (database), a separate host for
              the NestJS backend (Railway/Render/Fly — Supabase does not
              host your NestJS server, only the Postgres database)
```

---

## 11. Build Order (structure is complete now; this is what to build first)

Even in a "scalable from day 1" approach, code still gets written in some order. This is not scope-cutting — every table above gets built. This is just sequencing so nothing blocks anything else:

1. `users`, `skills`, `user_skills`, `proof_of_work` — auth + profile
2. `projects`, `project_roles`, `applications`, `project_members` — the core loop
3. `connections`, `conversations`, `messages` — team formation + chat
4. `organizations`, `organization_members` — org accounts
5. `reviews`, `notifications` — feedback loop + engagement
6. `verifications`, search service upgrade, matching refinements — polish layer

---

## 12. Success Metrics

- Projects posted per week
- Applications per project (signal of demand)
- Applications → accepted rate (signal of match quality)
- Project completion rate (posted → completed, not abandoned)
- Proof-of-work items generated per completed project (the compounding loop working)
- Returning users (week-over-week)