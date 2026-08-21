import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class ApplicationsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Apply to a specific project_role (flow 4.3). */
  async create(
    authUserId: string,
    dto: { project_id: string; project_role_id: string; pitch_note?: string },
  ) {
    const client = this.supabase.getClient();

    const { data: role } = await client
      .from("project_roles")
      .select("id, project_id")
      .eq("id", dto.project_role_id)
      .maybeSingle();
    if (!role) throw new NotFoundException("Project role not found");

    const { data: project } = await client
      .from("projects")
      .select("id, status, posted_by_user_id")
      .eq("id", dto.project_id)
      .maybeSingle();
    if (!project) throw new NotFoundException("Project not found");
    if (project.status !== "open") {
      throw new BadRequestException("This project is no longer accepting applications");
    }
    if (project.posted_by_user_id === authUserId) {
      throw new BadRequestException("You cannot apply to your own project");
    }

    const { data: existing } = await client
      .from("applications")
      .select("id")
      .eq("project_role_id", dto.project_role_id)
      .eq("applicant_user_id", authUserId)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException("You already applied to this role");
    }

    const { data, error } = await client
      .from("applications")
      .insert({
        project_id: dto.project_id,
        project_role_id: dto.project_role_id,
        applicant_user_id: authUserId,
        pitch_note: dto.pitch_note ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(`DB error: ${error.message}`);
    return data;
  }

  /** My Applications (dashboard tab) — applications I've submitted. */
  async listMine(userId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from("applications")
      .select(
        `id, project_id, project_role_id, pitch_note, status, created_at,
         project:projects!applications_project_id_fkey(id, title, type, status, posted_by_user_id),
         project_role:project_roles!applications_project_role_id_fkey(id, skill_id, seniority, skill:skills(name))`,
      )
      .eq("applicant_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`DB error: ${error.message}`);
    return data ?? [];
  }

  /** Accept / reject (poster only) or withdraw (applicant only). */
  async updateStatus(
    actorUserId: string,
    applicationId: string,
    status: "accepted" | "rejected" | "withdrawn",
  ) {
    const client = this.supabase.getClient();

    const { data: app } = await client
      .from("applications")
      .select(
        "id, project_id, project_role_id, applicant_user_id, status, project:projects!applications_project_id_fkey(posted_by_user_id, status)",
      )
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) throw new NotFoundException("Application not found");

    // supabase-js types to-one embeds as arrays; PostgREST returns objects.
    const project = Array.isArray(app.project) ? app.project[0] : app.project;
    const posterId = project?.posted_by_user_id ?? null;

    if (status === "withdrawn") {
      if (app.applicant_user_id !== actorUserId) {
        throw new ForbiddenException("Only the applicant can withdraw an application");
      }
      if (app.status !== "pending") {
        throw new BadRequestException("Only pending applications can be withdrawn");
      }
      const { error } = await client
        .from("applications")
        .update({ status })
        .eq("id", applicationId);
      if (error) throw new Error(`DB error: ${error.message}`);
      return;
    }

    // accept / reject — poster only
    if (posterId !== actorUserId) {
      throw new ForbiddenException("Only the project poster can accept or reject applications");
    }
    if (app.status !== "pending") throw new BadRequestException("Application already decided");

    const { error: statusError } = await client
      .from("applications")
      .update({ status })
      .eq("id", applicationId);
    if (statusError) throw new Error(`DB error: ${statusError.message}`);

    if (status !== "accepted") return;

    // accept → join the team + fill the role headcount
    const { error: memberError } = await client.from("project_members").insert({
      project_id: app.project_id,
      user_id: app.applicant_user_id,
      project_role_id: app.project_role_id,
    });
    if (memberError) {
      // compensate: revert the status so no member exists without acceptance
      await client.from("applications").update({ status: "pending" }).eq("id", applicationId);
      if (memberError.code === "23505") {
        throw new BadRequestException("This user is already a member of the project");
      }
      throw new Error(`DB error: ${memberError.message}`);
    }

    const { data: role } = await client
      .from("project_roles")
      .select("headcount_filled, headcount_needed")
      .eq("id", app.project_role_id)
      .single();
    if (role) {
      await client
        .from("project_roles")
        .update({ headcount_filled: role.headcount_filled + 1 })
        .eq("id", app.project_role_id);
    }

    // all roles filled → project moves to in_progress (flow 4.2)
    const { data: roles } = await client
      .from("project_roles")
      .select("headcount_filled, headcount_needed")
      .eq("project_id", app.project_id);
    if (
      roles &&
      roles.length > 0 &&
      roles.every((r) => r.headcount_filled >= r.headcount_needed)
    ) {
      await client.from("projects").update({ status: "in_progress" }).eq("id", app.project_id);
    }
  }
}