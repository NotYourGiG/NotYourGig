import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService, AuthUser } from "./auth.service";

export type AuthenticatedRequest = Request & { authUser: AuthUser };

// How long a single guard-side await (Clerk session verify, or the Supabase
// get-or-create row lookup) is allowed to run before the request fails fast.
// Both are outbound network calls with no client-side timeout of their own, so
// a stalled Clerk JWKS fetch or Supabase query could otherwise leave a guarded
// route hanging "(pending)" until the serverless function hits its own ceiling.
const GUARD_TIMEOUT_MS = 10_000;
const TIMED_OUT_MARKER = "timed out after";

/** Race a promise against a deadline; on timeout log clearly and throw 503. */
async function withDeadline<T>(
  label: string,
  promise: Promise<T>,
  ms: number = GUARD_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${TIMED_OUT_MARKER} ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, deadline]);
  } catch (err) {
    if (err instanceof Error && err.message.includes(TIMED_OUT_MARKER)) {
      console.error(
        `[clerk-auth-guard] ${label} did not complete within ${ms}ms; rejecting with 503 instead of hanging`,
      );
      throw new ServiceUnavailableException(`${label} timed out; please retry`);
    }
    throw err; // preserve original errors (e.g. invalid/expired token -> 401)
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Missing bearer token");

    const clerkUserId = await withDeadline(
      "ClerkAuthGuard.verifySessionToken",
      this.authService.verifySessionToken(token),
    );
    // resolveUser = get-or-create our users row for this Clerk identity.
    req.authUser = await withDeadline(
      "ClerkAuthGuard.resolveUser",
      this.authService.resolveUser(clerkUserId),
    );
    return true;
  }
}