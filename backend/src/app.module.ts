import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { SupabaseModule } from "./supabase/supabase.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProjectsModule } from "./projects/projects.module";
import { ApplicationsModule } from "./applications/applications.module";
import { GithubModule } from "./github/github.module";

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
    GithubModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}