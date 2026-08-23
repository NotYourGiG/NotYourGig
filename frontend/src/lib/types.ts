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
}

export interface Project {
  id: string
  title: string
  description: string
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