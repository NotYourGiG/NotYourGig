import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GithubAuthController } from "./github-auth.controller";
import { GithubService } from "./github.service";

// GitHub verification is separate from Clerk auth (the auth module's guard
// is reused only to protect the /connect entry, not the /callback — that
// one is a browser redirect carrying no bearer token).
@Module({
  imports: [AuthModule],
  controllers: [GithubAuthController],
  providers: [GithubService],
})
export class GithubModule {}