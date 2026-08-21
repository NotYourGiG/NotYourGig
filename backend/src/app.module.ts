import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseModule } from "./supabase/supabase.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProjectsModule } from "./projects/projects.module";
import { ApplicationsModule } from "./applications/applications.module";

// Bootstrap + feature modules per blueprint.md Build Order.
// Search module is added with Section E.
@Module({
  imports: [
    // .env lives at the repo root; this resolves it whether the backend
    // is started from backend/ or from the repo root.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../.env"] }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ApplicationsModule,
  ],
})
export class AppModule {}