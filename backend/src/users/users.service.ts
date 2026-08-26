import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface UpdateProfileFields {
  name?: string;
  avatar_url?: string;
  headline?: string;
  bio?: string;
  location?: string;
  availability_status?: string;
  primary_role?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Public profile: user + skills + proof (blueprint §5 Profile Page). */
  async findProfile(id: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) throw new NotFoundException("User not found");
    const [skills, proof] = await Promise.all([
      this.listSkills(id),
      this.listProof(id),
    ]);
    return { ...data, skills, proof };
  }

  async updateProfile(id: string, fields: UpdateProfileFields) {
    const { data, error } = await this.supabase
      .getClient()
      .from("users")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`DB error: ${error.message}`);
    return data;
  }

  async listSkills(userId: string) {
    const client = this.supabase.getClient();
    // Note: user_skills has no created_at (pure join table, §6), so we
    // sort by skill name in JS after the nested join. The supabase-js
    // types the many-to-one embed as an array; PostgREST returns a single
    // object — normalize both.
    const { data, error } = await client
      .from("user_skills")
      .select("level, verified_via, skill:skills(id, name, category)")
      .eq("user_id", userId);
    if (error) throw new Error(`DB error: ${error.message}`);

    const rows = (data ?? []) as unknown as Array<{
      level: string;
      verified_via: string | null;
      skill: unknown;
    }>;
    const skills = rows.map((row) => {
      const skill = Array.isArray(row.skill) ? row.skill[0] : row.skill;
      return {
        skill: (skill as { id: string; name: string; category: string } | null) ?? null,
        level: row.level,
        verified_via: row.verified_via ?? null,
      };
    });
    skills.sort((a, b) => (a.skill?.name ?? "").localeCompare(b.skill?.name ?? ""));
    return skills;
  }

  async addSkill(userId: string, skillId: string, level: string) {
    const client = this.supabase.getClient();
    const { data: skill } = await client
      .from("skills")
      .select("id")
      .eq("id", skillId)
      .maybeSingle();
    if (!skill) throw new NotFoundException("Skill not found");
    const { error } = await client.from("user_skills").insert({
      user_id: userId,
      skill_id: skillId,
      level,
    });
    if (error) {
      if (error.code === "23505") {
        throw new BadRequestException("Skill already added");
      }
      throw new Error(`DB error: ${error.message}`);
    }
  }

  async listProof(userId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from("proof_of_work")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`DB error: ${error.message}`);
    return data ?? [];
  }

  async addProof(
    userId: string,
    entry: {
      title: string;
      description?: string;
      link_github?: string;
      link_live_demo?: string;
      link_other?: string;
      role_played?: string;
    },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from("proof_of_work")
      .insert({ user_id: userId, source: "manual", ...entry })
      .select("*")
      .single();
    if (error) throw new Error(`DB error: ${error.message}`);
    return data;
  }

  /** Delete one of the user's proof entries. No-op if the row doesn't exist. */
  async deleteProof(userId: string, proofId: string) {
    const { error } = await this.supabase
      .getClient()
      .from("proof_of_work")
      .delete()
      .eq("id", proofId)
      .eq("user_id", userId);
    if (error) throw new Error(`DB error: ${error.message}`);
  }

  /** Curated skills list search (blueprint §6: pick from the table, no free text). */
  async searchSkills(q?: string) {
    const client = this.supabase.getClient();
    let query = client.from("skills").select("id, name, category").order("name");
    if (q) {
      query = query.ilike("name", `%${q}%`);
    }
    const { data, error } = await query.limit(25);
    if (error) throw new Error(`DB error: ${error.message}`);
    return data ?? [];
  }
}