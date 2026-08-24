import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
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
   * Clerk-guarded. Hands back the GitHub authorize URL and sets the signed
   * state cookie; the frontend navigates the browser there.
   */
  @UseGuards(ClerkAuthGuard)
  @Get("connect")
  connect(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    console.log("[github-connect] handler entered");
    const url = this.githubService.buildAuthorizeUrl(req.authUser.id, res);
    console.log("[github-connect] buildAuthorizeUrl returned");
    return { url };
  }

  /**
   * GET /api/auth/github/callback
   * Browser redirect target from GitHub (no bearer token possible). CSRF
   * protection comes from the signed state cookie. Always ends in a 302 to
   * the frontend with ?github=verified|none|error — never breaks the page.
   */
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.githubService.handleCallback(
      {
        code: code ?? null,
        state: state ?? null,
        cookieValue: (req.headers as { cookie?: string }).cookie ?? null,
      },
      res,
    );
  }
}