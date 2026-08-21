import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import {
  AuthenticatedRequest,
  ClerkAuthGuard,
} from "./clerk-auth.guard";

@Controller("auth")
export class AuthController {
  /**
   * GET /api/auth/me
   * Verify the Clerk session token and return our users row,
   * creating it on first login (idempotent get-or-create).
   */
  @UseGuards(ClerkAuthGuard)
  @Get("me")
  getMe(@Req() req: AuthenticatedRequest) {
    return { user: req.authUser };
  }
}