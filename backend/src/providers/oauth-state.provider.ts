import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

// Server-side, single-use, TTL-bound OAuth `state` storage keyed by a random
// token. This replaces the browser-cookie approach for the GitHub connect
// flow: modern browsers refuse to persist Set-Cookie on cross-origin fetch()
// responses, so we bind the state to the authenticated user in the DB instead
// and verify + delete it on the callback.
const TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class OauthStateProvider {
  constructor(private readonly supabase: SupabaseService) {}

  /** Persist a one-time state token bound to the given user with a short TTL. */
  async create(userId: string, stateToken: string): Promise<void> {
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    const { error } = await this.supabase
      .getClient()
      .from("oauth_state")
      .insert({ state_token: stateToken, user_id: userId, expires_at: expiresAt });
    if (error) throw new Error(`oauth_state insert -> ${error.message}`);
  }

  /**
   * Atomically consume a state token (delete + return). Returns the bound
   * user id if the token existed and was not expired, else null. Single-use
   * by construction (delete happens in the same statement).
   */
  async consume(stateToken: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from("oauth_state")
      .delete()
      .eq("state_token", stateToken)
      .select("user_id, expires_at")
      .maybeSingle();
    if (error) throw new Error(`oauth_state consume -> ${error.message}`);
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.user_id as string;
  }
}