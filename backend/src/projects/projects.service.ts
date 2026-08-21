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

const PROJECT_SELECT = `
  id, title, description, type, budget_amount, budget_currency, status,
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
    const { data, error } = await this.supabase
      .getClient()
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) throw new NotFoundException("Project not found");
    return data;
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
  async update(
    id: string,
    fields: {
      title?: string;
      description?: string;
      type?: string;
      budget_amount?: number;
      budget_currency?: string;
      status?: string;
    },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from("projects")
      .update(fields)
      .eq("id", id)
      .select(PROJECT_SELECT)
      .single();
    if (error) throw new Error(`DB error: ${error.message}`);
    return data;
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

  async listApplications(projectId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from("applications")
      .select(
        `id, project_id, project_role_id, pitch_note, status, created_at,
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