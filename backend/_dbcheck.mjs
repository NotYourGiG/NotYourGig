// TEMP db state check — deleted after use.
import "dotenv/config"; // load backend/.env so process.env has credentials
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tables = ["users", "skills", "user_skills", "proof_of_work", "organizations", "projects", "project_roles", "applications", "project_members", "connections", "conversations", "conversation_participants", "messages"];
for (const t of tables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`${t.padEnd(26)} ${error ? "ERROR: " + error.message : `OK  rows=${count ?? 0}`}`);
}
