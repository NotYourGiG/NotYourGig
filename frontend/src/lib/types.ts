// Shared API types — snake_case to match the backend/DB 1:1 (blueprint §6).
export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  headline: string | null
  bio: string | null
  location: string | null
  availability_status: string
  primary_role: string
  // GitHub verification (proof-of-work, separate from Clerk auth).
  github_username: string | null
  github_connected_at: string | null
}

export interface Skill {
  id: string
  name: string
  category: string | null
}

export interface UserSkill {
  skill: Skill
  level: string
  /** Non-null when this skill row was verified via an external source ('github'). */
  verified_via: string | null
}

export interface ProofEntry {
  id: string
  title: string
  description: string | null
  link_github: string | null
  link_live_demo: string | null
  link_other: string | null
  role_played: string | null
  source: string
  source_project_id: string | null
  created_at: string
}

export interface Profile extends User {
  skills: UserSkill[]
  proof: ProofEntry[]
}

export interface ProjectRole {
  id: string
  skill_id: string
  seniority: string
  headcount_needed: number
  headcount_filled: number
  skill: Skill | null
  /**
   * Live pending+accepted application count (present on the project detail
   * response). Drives per-role edit locking — a role with >0 applicants is
   * frozen except the slot total can be increased.
   */
  applications_count?: number
}

export interface Project {
  id: string
  title: string
  description: string
  /** Optional GitHub repo link shown as a plain outbound link on the detail page. */
  repo_url: string | null
  /** Optional live demo link, shown next to the repo link on the detail page. */
  demo_url: string | null
  type: string
  budget_amount: number | null
  budget_currency: string | null
  status: string
  created_at: string
  posted_by_user_id: string | null
  posted_by_org_id: string | null
  posted_by_user: Pick<User, "id" | "name" | "avatar_url" | "headline"> | null
  posted_by_org: { id: string; name: string } | null
  roles: ProjectRole[]
}

export interface Application {
  id: string
  project_id: string
  project_role_id: string
  pitch_note: string | null
  status: string
  created_at: string
  applicant: Pick<User, "id" | "name" | "avatar_url" | "headline"> | null
  project_role: {
    id: string
    skill_id: string
    seniority: string
    skill: Skill | null
  } | null
  project?: { id: string; title: string; type: string; status: string } | null
}

export interface Page<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}

/** One row in the public Explore Builders directory (GET /users). */
export interface BuilderSummary {
  id: string
  name: string
  avatar_url: string | null
  headline: string | null
  skills: Skill[]
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  sender: Pick<User, "id" | "name" | "avatar_url" | "headline"> | null
}

export interface Conversation {
  id: string
  context_type: string | null
  context_id: string | null
  created_at: string
  updated_at: string
  other_user: Pick<User, "id" | "name" | "avatar_url" | "headline"> | null
  last_message: {
    id: string
    conversation_id: string
    sender_id: string
    content: string
    created_at: string
  } | null
}