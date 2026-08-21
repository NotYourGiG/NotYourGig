// TEMP smoke test for the projects/applications DB layer — deleted after use.
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stamp = Date.now();
const ok = (label) => console.log(`PASS ${label}`);

// users: poster + applicant
const { data: poster, error: e0 } = await sb.from("users").insert({ email: `poster-${stamp}@test.local`, name: "Poster", primary_role: "founder" }).select().single();
if (e0) throw new Error("poster: " + e0.message);
const { data: applicant, error: e1 } = await sb.from("users").insert({ email: `applicant-${stamp}@test.local`, name: "Applicant", primary_role: "builder" }).select().single();
if (e1) throw new Error("applicant: " + e1.message);

// temp skill
const { data: skill, error: e2 } = await sb.from("skills").insert({ name: `_sk_${stamp}`, category: "Test" }).select().single();
if (e2) throw new Error("skill: " + e2.message);

// project + role
const { data: project, error: e3 } = await sb.from("projects").insert({ title: "Smoke project", description: "test", type: "paid", budget_amount: 1000, budget_currency: "INR", posted_by_user_id: poster.id, status: "open" }).select().single();
if (e3) throw new Error("project: " + e3.message);
const { data: role, error: e4 } = await sb.from("project_roles").insert({ project_id: project.id, skill_id: skill.id, seniority: "mid", headcount_needed: 1 }).select().single();
if (e4) throw new Error("role: " + e4.message);
ok("project+role created");

// nested select shape used by ProjectsService.list (with FK hints)
const { data: listed, error: e5 } = await sb.from("projects")
  .select("id, title, type, status, posted_by_user_id, posted_by_user:users!projects_posted_by_user_id_fkey(id, name, avatar_url, headline), roles:project_roles(id, skill_id, seniority, headcount_needed, headcount_filled, skill:skills(name, category))")
  .eq("id", project.id);
if (e5) throw new Error("list select: " + e5.message);
const row = listed?.[0];
if (!row?.posted_by_user?.name || !row?.roles?.[0]?.skill?.name) throw new Error("nested embed returned empty: " + JSON.stringify(row));
ok("nested project embed select");

// application
const { data: app, error: e6 } = await sb.from("applications").insert({ project_id: project.id, project_role_id: role.id, applicant_user_id: applicant.id, pitch_note: "hi", status: "pending" }).select().single();
if (e6) throw new Error("application: " + e6.message);
ok("application created");

// accept flow: update status, insert member, bump headcount, project in_progress
const { error: e7 } = await sb.from("applications").update({ status: "accepted" }).eq("id", app.id);
if (e7) throw new Error("accept update: " + e7.message);
const { error: e8 } = await sb.from("project_members").insert({ project_id: project.id, user_id: applicant.id, project_role_id: role.id });
if (e8) throw new Error("member: " + e8.message);
const { data: roleAfter, error: e9 } = await sb.from("project_roles").select("headcount_filled").eq("id", role.id).single();
if (e9) throw new Error("role get: " + e9.message);
const { error: e10 } = await sb.from("project_roles").update({ headcount_filled: roleAfter.headcount_filled + 1 }).eq("id", role.id);
if (e10) throw new Error("role bump: " + e10.message);
const { data: rolesNow } = await sb.from("project_roles").select("headcount_filled, headcount_needed").eq("project_id", project.id);
if (rolesNow?.every((r) => r.headcount_filled >= r.headcount_needed)) {
  const { error: e11 } = await sb.from("projects").update({ status: "in_progress" }).eq("id", project.id);
  if (e11) throw new Error("in_progress: " + e11.message);
}
const { data: projFinal } = await sb.from("projects").select("status").eq("id", project.id).single();
if (projFinal.status !== "in_progress") throw new Error("project not in_progress: " + projFinal.status);
ok("accept flow -> member + headcount + in_progress");

// cleanup (reverse order)
await sb.from("project_members").delete().eq("project_id", project.id);
await sb.from("applications").delete().eq("project_id", project.id);
await sb.from("project_roles").delete().eq("project_id", project.id);
await sb.from("projects").delete().eq("id", project.id);
await sb.from("skills").delete().eq("id", skill.id);
await sb.from("users").delete().in("id", [poster.id, applicant.id]);
console.log("cleanup done");
