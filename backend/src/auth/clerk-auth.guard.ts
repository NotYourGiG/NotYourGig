import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService, AuthUser } from "./auth.service";

export type AuthenticatedRequest = Request & { authUser: AuthUser };

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Missing bearer token");

    const clerkUserId = await this.authService.verifySessionToken(token);
    // resolveUser = get-or-create our users row for this Clerk identity.
    req.authUser = await this.authService.resolveUser(clerkUserId);
    return true;
  }
}