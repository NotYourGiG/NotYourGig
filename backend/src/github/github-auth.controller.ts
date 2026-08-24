import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  AuthenticatedRequest,
  ClerkAuthGuard,
} from "../auth/clerk-auth.guard";
import { GithubService } from "./github.service";

// GitHub proof-of-work verification — the "Connect GitHub" entry both
// comes and returns through these routes. NOT a Clerk OAuth flow: it is an
// optional, additional connection the user makes from their own profile
// (Vercel-style "connect GitHub after signup", but profile-initiated).
@Controller("auth/github")
export class GithubAuthController {
  constructor(private readonly githubService: GithubService) {}

  /**
   * GET /api/auth/github/connect
   * Clerk-guarded. Persists a one-time state server-side and hands back the
   * GitHub authorize URL + the state token; the frontend navigates the
   * browser there. No cookie is used (browsers drop cross-origin Set-Cookie).
   */
  @UseGuards(ClerkAuthGuard)
  @Get("connect")
  async connect(@Req() req: AuthenticatedRequest) {
    return this.githubService.buildAuthorizeUrl(req.authUser.id);
  }

  /**
   * GET /api/auth/github/callback
   * Browser redirect target from GitHub (no bearer token possible). The
   * `state` query param is verified against the server-side store (single-use
   * + TTL). Always ends in a 302 to the frontend with
   * ?github=verified|none|error — never breaks the page.
   */
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() res: Response,
  ) {
    await this.githubService.handleCallback(
      { code: code ?? null, state: state ?? null },
      res,
    );
  }
}