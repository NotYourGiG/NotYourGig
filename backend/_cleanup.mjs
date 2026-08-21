// TEMP cleanup for _fixture.mjs data — deleted after use.
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = process.argv[2];
if (!userId) { console.error("pass user id"); process.exit(1); }
const { error: e1 } = await sb.from("proof_of_work").delete().eq("user_id", userId);
const { error: e2 } = await sb.from("user_skills").delete().eq("user_id", userId);
// delete temp skills (parentless test skills)
const { data: skills, error: e3 } = await sb.from("skills").select("id, name").ilike("name", "_smoke_%");
if (e3) console.error(e3.message);
else for (const s of skills ?? []) {
  const { error } = await sb.from("skills").delete().eq("id", s.id);
  if (error) console.error("del skill:", error.message);
}
const { error: e4 } = await sb.from("users").delete().eq("id", userId);
console.log("cleanup done", JSON.stringify({ e1: e1?.message, e2: e2?.message, e4: e4?.message }));