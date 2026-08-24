import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OauthStateProvider } from "../providers/oauth-state.provider";
import { GithubAuthController } from "./github-auth.controller";
import { GithubService } from "./github.service";

// GitHub verification is separate from Clerk auth (the auth module's guard
// is reused only to protect the /connect entry, not the /callback — that
// one is a browser redirect carrying no bearer token). The server-side OAuth
// state store is registered here (SupabaseModule is global, so its client is
// injectable without an explicit import).
@Module({
  imports: [AuthModule],
  controllers: [GithubAuthController],
  providers: [GithubService, OauthStateProvider],
})
export class GithubModule {}