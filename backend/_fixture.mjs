// TEMP fixture for smoke testing Section C endpoints — deleted after use.
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const email = `smoke-${Date.now()}@test.local`;

// user
const { data: user, error: e1 } = await sb.from("users").insert({ email, name: "Smoke Tester", primary_role: "builder", availability_status: "available" }).select().single();
if (e1) { console.error("user insert:", e1.message); process.exit(1); }
// temp skill
const { data: skill, error: e2 } = await sb.from("skills").insert({ name: `_smoke_${Date.now()}`, category: "Test" }).select().single();
if (e2) { console.error("skill insert:", e2.message); process.exit(1); }
// user_skill
const { error: e3 } = await sb.from("user_skills").insert({ user_id: user.id, skill_id: skill.id, level: "advanced" });
if (e3) { console.error("user_skill insert:", e3.message); process.exit(1); }
// proof
const { error: e4 } = await sb.from("proof_of_work").insert({ user_id: user.id, title: "Smoke proof", link_github: "https://github.com/smoke", source: "manual" });
if (e4) { console.error("proof insert:", e4.message); process.exit(1); }
console.log(`USER_ID=${user.id}`);
console.log(`SKILL_ID=${skill.id}`);
