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
    // Public fields only — NEVER email/password_hash or other private data.
    const { data, error } = await client
      .from("users")
      .select(
        "id, name, avatar_url, headline, bio, location, availability_status, primary_role, github_username, github_connected_at, created_at",
      )
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

  /**
   * Public builder directory (GET /users): optional name/skill search,
   * paginated like GET /projects (default 12, max 50). Public fields only —
   * never email or other private data. `q` matches builder name OR any of
   * their skills' names (union, so a name-only match with no skills still
   * shows up).
   */
  async listBuilders(q?: string, page?: number, perPage?: number) {
    const client = this.supabase.getClient();
    const safePage = Math.max(1, Number(page) || 1);
    const safePerPage = Math.min(50, Math.max(1, Number(perPage) || 12));
    const from = (safePage - 1) * safePerPage;
    const to = from + safePerPage - 1;
    const needle = q?.trim() ? `%${q.trim()}%` : null;

    const BUILDER_FIELDS =
      "id, name, avatar_url, headline, skills:user_skills(skill:skills(id, name, category))";

    // No search term: straight paginated listing (newest builders first).
    if (!needle) {
      const { data, count, error } = await client
        .from("users")
        .select(BUILDER_FIELDS, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(`DB error: ${error.message}`);
      const rows = data ?? [];
      return {
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          avatar_url: r.avatar_url,
          headline: r.headline,
          skills: this.normalizeBuilderSkills(r.skills),
        })),
        total: count ?? rows.length,
        page: safePage,
        per_page: safePerPage,
      };
    }

    // name OR skill search, unioned so a name match without skills survives.
    const [
      { data: byName, error: nameErr },
      { data: bySkill, error: skillErr },
    ] = await Promise.all([
      client.from("users").select("id").ilike("name", needle),
      client
        .from("user_skills")
        .select("user_id, skill:skills!inner(id)")
        .ilike("skill.name", needle),
    ]);
    if (nameErr ?? skillErr) {
      throw new Error(`DB error: ${nameErr?.message ?? skillErr?.message}`);
    }

    const candidateSet = new Set<string>();
    for (const r of byName ?? []) candidateSet.add(r.id);
    for (const r of bySkill ?? []) candidateSet.add(r.user_id);
    if (candidateSet.size === 0) {
      return { data: [], total: 0, page: safePage, per_page: safePerPage };
    }
    const candidateIds = [...candidateSet];

    // Order candidates newest-first, then slice the requested page.
    const { data: dated, error: datedErr } = await client
      .from("users")
      .select("id, created_at")
      .in("id", candidateIds);
    if (datedErr) throw new Error(`DB error: ${datedErr.message}`);
    const createdBy = new Map((dated ?? []).map((u) => [u.id, u.created_at]));
    const ordered = candidateIds.sort((a, b) =>
      (createdBy.get(b) ?? "").localeCompare(createdBy.get(a) ?? ""),
    );
    const pageIds = ordered.slice(from, to + 1);
    if (pageIds.length === 0) {
      return {
        data: [],
        total: candidateIds.length,
        page: safePage,
        per_page: safePerPage,
      };
    }

    const { data: rows, error: rowsErr } = await client
      .from("users")
      .select(BUILDER_FIELDS)
      .in("id", pageIds);
    if (rowsErr) throw new Error(`DB error: ${rowsErr.message}`);
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));

    const data: Array<{
      id: string;
      name: string;
      avatar_url: string | null;
      headline: string | null;
      skills: Array<{ id: string; name: string; category: string | null }>;
    }> = [];
    for (const id of pageIds) {
      const r = byId.get(id);
      if (!r) continue;
      data.push({
        id: r.id,
        name: r.name,
        avatar_url: r.avatar_url,
        headline: r.headline,
        skills: this.normalizeBuilderSkills(r.skills),
      });
    }
    return { data, total: candidateIds.length, page: safePage, per_page: safePerPage };
  }

  /** user_skills -> skills embed: dedupe/normalize, sort by name, cap at 4. */
  private normalizeBuilderSkills(
    skills: unknown,
  ): Array<{ id: string; name: string; category: string | null }> {
    const rows = (Array.isArray(skills) ? skills : []) as Array<{
      skill?: unknown;
    }>;
    return rows
      .map((row) => {
        const skill = Array.isArray(row.skill) ? row.skill[0] : row.skill;
        return (skill ?? null) as {
          id: string;
          name: string;
          category: string | null;
        } | null;
      })
      .filter(
        (s): s is { id: string; name: string; category: string | null } =>
          s !== null,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 4);
  }
}