import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface ListProjectsParams {
  type?: string;
  skill_id?: string;
  poster?: string; // "org" | "individual"
  status?: string;
  user_id?: string; // "My Projects" filter
  page?: number;
  per_page?: number;
}

export interface CreateProjectInput {
  title: string;
  description: string;
  repo_url?: string;
  demo_url?: string;
  type: string;
  budget_amount?: number;
  budget_currency?: string;
  posted_by_user_id?: string;
  posted_by_org_id?: string;
  roles: Array<{
    skill_id: string;
    seniority?: string;
    headcount_needed?: number;
  }>;
}

export interface UpdateRoleInput {
  /** Present for existing roles; absent for new ones. */
  id?: string;
  skill_id: string;
  seniority?: string;
  headcount_needed?: number;
}

const PROJECT_SELECT = `
  id, title, description, type, repo_url, demo_url, budget_amount, budget_currency, status,
  created_at, updated_at, posted_by_user_id, posted_by_org_id,
  posted_by_user:users!projects_posted_by_user_id_fkey(id, name, avatar_url, headline),
  posted_by_org:organizations!projects_posted_by_org_id_fkey(id, name),
  roles:project_roles(id, skill_id, seniority, headcount_needed, headcount_filled,
    skill:skills(id, name, category))
`;

@Injectable()
export class ProjectsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Paginated Browse query (blueprint §8: server-side pagination). */
  async list(params: ListProjectsParams) {
    const client = this.supabase.getClient();
    const page = Math.max(1, Number(params.page) || 1);
    const perPage = Math.min(50, Math.max(1, Number(params.per_page) || 12));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = client.from("projects").select(PROJECT_SELECT, { count: "exact" });
    if (params.type) query = query.eq("type", params.type);
    if (params.status) query = query.eq("status", params.status);
    if (params.skill_id) query = query.eq("roles.skill_id", params.skill_id);
    if (params.poster === "org") query = query.not("posted_by_org_id", "is", null);
    if (params.poster === "individual") query = query.not("posted_by_user_id", "is", null);
    if (params.user_id) query = query.eq("posted_by_user_id", params.user_id);

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(`DB error: ${error.message}`);
    return { data: data ?? [], total: count ?? 0, page, per_page: perPage };
  }

  async findOne(id: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) throw new NotFoundException("Project not found");

    // Live per-role application counts (pending + accepted) — drives the
    // edit-form role lock-out. Computed here on every read, never cached.
    const roles = (Array.isArray(data.roles) ? data.roles : []) as Array<{
      id: string;
      [k: string]: unknown;
    }>;
    const roleIds = roles.map((r) => r.id);
    const counts = new Map<string, number>();
    if (roleIds.length) {
      const { data: apps, error: countsErr } = await client
        .from("applications")
        .select("project_role_id")
        .in("project_role_id", roleIds)
        .in("status", ["pending", "accepted"]);
      if (countsErr) throw new Error(`DB error: ${countsErr.message}`);
      for (const a of apps ?? []) {
        counts.set(a.project_role_id, (counts.get(a.project_role_id) ?? 0) + 1);
      }
    }
    return {
      ...data,
      roles: roles.map((r) => ({
        ...r,
        applications_count: counts.get(r.id) ?? 0,
      })),
    };
  }

  /**
   * Create a project + its roles. Enforces the one_poster_only rule at the
   * application layer (blueprint §6 and task requirement), not relying on
   * the DB CHECK alone. org posting is deferred, so the current user is
   * always the poster.
   */
  async create(authUserId: string, dto: CreateProjectInput) {
    const client = this.supabase.getClient();

    const hasUser = Boolean(dto.posted_by_user_id);
    const hasOrg = Boolean(dto.posted_by_org_id);
    if (hasUser && hasOrg) {
      throw new BadRequestException(
        "A project must be posted by exactly one of: an individual or an organization",
      );
    }
    if (!hasUser && !hasOrg) {
      throw new BadRequestException(
        "A project needs a poster: set posted_by_user_id or posted_by_org_id",
      );
    }
    if (hasOrg) {
      throw new BadRequestException(
        "Posting as an organization is not available yet",
      );
    }

    const { data: project, error } = await client
      .from("projects")
      .insert({
        title: dto.title,
        description: dto.description,
        repo_url: dto.repo_url ?? null,
        demo_url: dto.demo_url ?? null,
        type: dto.type,
        budget_amount: dto.budget_amount ?? null,
        budget_currency: dto.budget_currency ?? "INR",
        posted_by_user_id: authUserId, // never trust a client-supplied id
        status: "open",
      })
      .select()
      .single();
    if (error) throw new Error(`DB error: ${error.message}`);

    for (const role of dto.roles) {
      const { error: roleError } = await client.from("project_roles").insert({
        project_id: project.id,
        skill_id: role.skill_id,
        seniority: role.seniority ?? "any",
        headcount_needed: role.headcount_needed ?? 1,
      });
      if (roleError) {
        // rollback the project if a role insert failed
        await client.from("projects").delete().eq("id", project.id);
        throw new BadRequestException(`Invalid role on project: ${roleError.message}`);
      }
    }
    return this.findOne(project.id);
  }
  /**
   * Update project scalar fields and (optionally) reconcile the full role
   * set. Roles: existing roles come with `id`, new roles have none, and any
   * existing role omitted from `roles` is deleted. A role that has live
   * applications (pending or accepted) can only have its headcount_needed
   * increased — every other edit or a delete is rejected with a specific
   * message, and validation runs before anything is mutated.
   */
  async update(
    id: string,
    fields: {
      title?: string;
      description?: string;
      repo_url?: string;
      demo_url?: string;
      type?: string;
      budget_amount?: number;
      budget_currency?: string;
      status?: string;
    },
    roles?: UpdateRoleInput[],
  ) {
    const client = this.supabase.getClient();
    if (roles !== undefined) {
      await this.reconcileRoles(client, id, roles);
    }
    if (Object.keys(fields).length > 0) {
      const { error } = await client
        .from("projects")
        .update(fields)
        .eq("id", id)
        .select("id");
      if (error) throw new Error(`DB error: ${error.message}`);
    }
    return this.findOne(id);
  }

  async addRole(
    projectId: string,
    role: { skill_id: string; seniority?: string; headcount_needed?: number },
  ) {
    const client = this.supabase.getClient();
    const { data: project } = await client
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) throw new NotFoundException("Project not found");

    const { data, error } = await client
      .from("project_roles")
      .insert({
        project_id: projectId,
        skill_id: role.skill_id,
        seniority: role.seniority ?? "any",
        headcount_needed: role.headcount_needed ?? 1,
      })
      .select()
      .single();
    if (error) throw new Error(`DB error: ${error.message}`);
    return data;
  }

  /**
   * Validate + apply a full role-set replacement. Throws before mutating
   * anything on the first violation, so a locked-role edit or delete never
   * partially applies.
   */
  private async reconcileRoles(
    client: ReturnType<SupabaseService["getClient"]>,
    projectId: string,
    submitted: UpdateRoleInput[],
  ) {
    const { data: existingRows, error: e1 } = await client
      .from("project_roles")
      .select(
        "id, skill_id, seniority, headcount_needed, headcount_filled, skill:skills(name)",
      )
      .eq("project_id", projectId);
    if (e1) throw new Error(`DB error: ${e1.message}`);
    const existing = (existingRows ?? []) as Array<{
      id: string;
      skill_id: string;
      seniority: string;
      headcount_needed: number;
      headcount_filled: number;
      skill?: unknown;
    }>;

    // Live per-role application counts (pending + accepted).
    const roleIds = existing.map((r) => r.id);
    const counts = new Map<string, number>();
    if (roleIds.length) {
      const { data: apps, error: e2 } = await client
        .from("applications")
        .select("project_role_id")
        .in("project_role_id", roleIds)
        .in("status", ["pending", "accepted"]);
      if (e2) throw new Error(`DB error: ${e2.message}`);
      for (const a of apps ?? []) {
        counts.set(a.project_role_id, (counts.get(a.project_role_id) ?? 0) + 1);
      }
    }
    const locked = (roleId: string) => (counts.get(roleId) ?? 0) > 0;
    const skillName = (roleId: string) => {
      const row = existing.find((r) => r.id === roleId);
      const s = row?.skill;
      const name = (Array.isArray(s) ? s[0] : s)?.name as string | undefined;
      return name ?? "role";
    };

    const submittedById = new Map(
      submitted.filter((r) => r.id).map((r) => [r.id!, r]),
    );

    // Deletions: existing roles omitted from the submitted set.
    for (const ex of existing) {
      if (!submittedById.has(ex.id) && locked(ex.id)) {
        throw new BadRequestException(
          `Role "${skillName(ex.id)}" has applicants and can't be deleted`,
        );
      }
    }

    // Adds (no id) + updates (with id). Every rule checked before mutation.
    let keepsRole = false;
    for (const role of submitted) {
      if (!role.id) {
        keepsRole = true;
        continue;
      }
      const current = existing.find((r) => r.id === role.id);
      if (!current) {
        throw new BadRequestException("Role not found on this project");
      }
      keepsRole = true;

      const newSkill = role.skill_id;
      const newSeniority = role.seniority ?? current.seniority;
      const newNeeded = role.headcount_needed ?? current.headcount_needed;

      const skillChanged = newSkill !== current.skill_id;
      const seniorityChanged = newSeniority !== current.seniority;
      const decreased = newNeeded < current.headcount_needed;

      if (locked(current.id) && (skillChanged || seniorityChanged || decreased)) {
        throw new BadRequestException(
          `Role "${skillName(current.id)}" has applicants and can't be edited`,
        );
      }
      if (decreased && newNeeded < current.headcount_filled) {
        throw new BadRequestException(
          `Role "${skillName(current.id)}" can't go below its filled count (${current.headcount_filled})`,
        );
      }
    }
    if (!keepsRole) {
      throw new BadRequestException("A project needs at least one role");
    }
    // Apply: deletes, then updates + inserts.
    for (const ex of existing) {
      if (!submittedById.has(ex.id)) {
        const { error } = await client.from("project_roles").delete().eq("id", ex.id);
        if (error) throw new Error(`DB error: ${error.message}`);
      }
    }
    for (const role of submitted) {
      if (!role.id) {
        const { error } = await client.from("project_roles").insert({
          project_id: projectId,
          skill_id: role.skill_id,
          seniority: role.seniority ?? "any",
          headcount_needed: role.headcount_needed ?? 1,
        });
        if (error) {
          throw new BadRequestException(`Invalid role on project: ${error.message}`);
        }
      } else {
        const current = existing.find((r) => r.id === role.id);
        if (!current) continue;
        const { error } = await client
          .from("project_roles")
          .update({
            skill_id: role.skill_id,
            seniority: role.seniority ?? current.seniority,
            headcount_needed: role.headcount_needed ?? current.headcount_needed,
          })
          .eq("id", role.id);
        if (error) throw new Error(`DB error: ${error.message}`);
      }
    }
  }

  /**
   * Delete a project. Blocked if it has ANY application (any status) — the
   * sanctioned way to stop taking applications is closing the project
   * (status), not deleting it.
   */
  async delete(id: string) {
    const client = this.supabase.getClient();

    const { data: project, error: pErr } = await client
      .from("projects")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (pErr) throw new Error(`DB error: ${pErr.message}`);
    if (!project) throw new NotFoundException("Project not found");

    const { data: apps, error: aErr } = await client
      .from("applications")
      .select("id")
      .eq("project_id", id)
      .limit(1);
    if (aErr) throw new Error(`DB error: ${aErr.message}`);
    if ((apps ?? []).length > 0) {
      throw new BadRequestException(
        "Project can't be deleted while it has applications — close it instead",
      );
    }

    // No applications means no accepted members, but clean up anyway.
    await client.from("project_members").delete().eq("project_id", id);
    const { error: rolesErr } = await client
      .from("project_roles")
      .delete()
      .eq("project_id", id);
    if (rolesErr) throw new Error(`DB error: ${rolesErr.message}`);

    const { error: delErr } = await client.from("projects").delete().eq("id", id);
    if (delErr) {
      if (delErr.code === "23503") {
        throw new BadRequestException(
          "Project can't be deleted because another record still references it (e.g. proof of work)",
        );
      }
      throw new Error(`DB error: ${delErr.message}`);
    }
  }

  async listApplications(projectId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from("applications")
      .select(
        `id, project_id, project_role_id, pitch_note, relevant_work_url, status, created_at,
         applicant_user_id,
         applicant:users!applications_applicant_user_id_fkey(id, name, avatar_url, headline),
         project_role:project_roles!applications_project_role_id_fkey(id, skill_id, seniority, skill:skills(name))`,
      )
      .eq("project_id", projectId)
      .order("created_at");
    if (error) throw new Error(`DB error: ${error.message}`);
    return data ?? [];
  }
}