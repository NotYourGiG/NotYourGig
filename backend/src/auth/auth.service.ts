import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { SupabaseService } from "../supabase/supabase.service";

// Our users row, as resolved from a Clerk session. Field names match
// the blueprint §6 `users` table 1:1 (snake_case, DB-style).
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  availability_status: string;
  primary_role: string;
  clerk_id: string | null;
}

@Injectable()
export class AuthService {
  // Lazy init: the backend must boot even before Clerk keys are set, so
  // protected routes fail with a clear 503 instead of crashing startup.
  private readonly clerk: ReturnType<typeof createClerkClient> | null;
  private readonly secretKey: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.secretKey = this.config.get<string>("CLERK_SECRET_KEY") ?? null;
    this.clerk = this.secretKey
      ? createClerkClient({ secretKey: this.secretKey })
      : null;
  }

  /** Verifies a Clerk session JWT; returns the Clerk user id (sub claim). */
  async verifySessionToken(token: string): Promise<string> {
    if (!this.clerk || !this.secretKey) {
      throw new ServiceUnavailableException(
        "Auth is not configured: CLERK_SECRET_KEY is missing from the environment",
      );
    }
    try {
      const session = await verifyToken(token, { secretKey: this.secretKey });
      if (!session.sub) throw new Error("missing subject");
      return session.sub;
    } catch {
      throw new UnauthorizedException("Invalid or expired session token");
    }
  }

  /**
   * Resolves a Clerk user id to our `users` row, creating it on first
   * login (blueprint flow 4.1). Mapping is by users.clerk_id (see
   * migration 0002). Primary role defaults to 'builder' — the profile
   * editor lets the user change it (builder/founder/both).
   */
  async resolveUser(clerkUserId: string): Promise<AuthUser> {
    if (!this.clerk) {
      throw new ServiceUnavailableException(
        "Auth is not configured: CLERK_SECRET_KEY is missing from the environment",
      );
    }
    const client = this.supabase.getClient();

    const { data: existing, error } = await client
      .from("users")
      .select("*")
      .eq("clerk_id", clerkUserId)
      .maybeSingle();
    if (error) throw new Error(`DB error resolving user: ${error.message}`);
    if (existing) return existing as AuthUser;

    // First login: fetch the profile from Clerk and create our row.
    const clerkUser = await this.clerk.users.getUser(clerkUserId);
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      `${clerkUserId}@users.clerk.local`;
    const name =
      [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || email.split("@")[0] || "Builder";

    const { data: created, error: createError } = await client
      .from("users")
      .insert({
        email,
        name,
        avatar_url: clerkUser.imageUrl ?? null,
        clerk_id: clerkUserId,
        primary_role: "builder",
      })
      .select("*")
      .single();

    if (!createError && created) return created as AuthUser;

    // Edge case: a row already exists with this email (pre-Clerk data),
    // so the insert violated the unique email index. Attach clerk_id to it.
    const { data: byEmail } = await client
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (byEmail) {
      const { data: updated, error: updateError } = await client
        .from("users")
        .update({ clerk_id: clerkUserId })
        .eq("id", byEmail.id)
        .select("*")
        .single();
      if (!updateError && updated) return updated as AuthUser;
    }

    throw new Error(`Failed to create user row: ${createError?.message}`);
  }
}