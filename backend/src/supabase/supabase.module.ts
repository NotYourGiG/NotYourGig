import { Global, Module } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";

// The shared database client other modules inject to talk to the
// database. Blueprint.md Section 10: Supabase is DB ONLY — this client
// talks to Postgres via PostgREST, not Auth/Storage/Realtime.
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}