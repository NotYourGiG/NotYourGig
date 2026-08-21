#!/usr/bin/env node
// Prints how to apply the raw-SQL migrations in /sql/migrations.
// No ORM / migration runner exists: the numbered files ARE the history
// (blueprint.md Section 10 — Migrations). Chosen workflow: paste each
// file into the Supabase SQL editor. No CLI dependency.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "sql", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.error(`No migrations found in ${migrationsDir}`);
  process.exit(1);
}

console.log(`
Not Your Gig applies schema as plain SQL — no ORM, no managed migration runner.
The numbered .sql files in /sql/migrations ARE the schema history (kept in git).

To apply a migration:
  1. Open your Supabase project dashboard -> SQL Editor -> New query.
  2. Paste the contents of the file below, run it.
  3. Move to the next file only after the previous one succeeds.

Migrations (apply in this order, skip ones already applied):
${files.map((f) => `  ${f}`).join("\n")}

Next to apply: ${files[0]}
`);
