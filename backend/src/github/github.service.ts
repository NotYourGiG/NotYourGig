import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { SupabaseService } from "../supabase/supabase.service";

// ---------------------------------------------------------------------------
// GitHub proof-of-work verification (separate from Clerk auth).
//
// Flow (Vercel "connect GitHub after signup"-style, but triggered from the
// user's own dashboard/profile):
//   GET /api/auth/github/connect  (Clerk-guarded) ->
//     builds github.com OAuth authorize URL,
//     sets a signed HttpOnly state cookie binding clerk user -> state
//   GET /api/auth/github/callback (browser redirect from GitHub) ->
//     verifies the state cookie + GitHub `state` query param,
//     exchanges the code for an access token,
//     fetches the user's public repos *once*,
//     extracts each repo's primary language,
//     marks user_skills.verified_via='github' for languages that exist in
//     the curated `skills` table (exact name match only) AND appear as the
//     primary language in >= 2 owned, non-forked public repos
//     (a single one-off repo is not proficiency).
//
// Token lifecycle: the access token is held in a local variable for the
// duration of this one callback request and discarded immediately — it is
// NEVER written to the database (no live sync planned).
// ---------------------------------------------------------------------------

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_SCOPES = "read:user public_repo";
const STATE_COOKIE = "nyg_gh_state";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REPOS_PER_PAGE = 100;
const REPOS_MAX_PAGES = 10;
const MIN_REPOS_FOR_VERIFICATION = 2;

export type GithubConnectOutcome = "verified" | "none" | "error";

interface GithubRepo {
  language: string | null;
  fork: boolean;
}

export interface GithubCallbackInput {
  code: string | null;
  state: string | null;
  cookieValue: string | null;
}

@Injectable()
export class GithubService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Build the GitHub authorize URL for the given (authenticated) user and
   * bind them to a random OAuth state via a signed, HttpOnly cookie.
   * Returns the URL the frontend should navigate the browser to.
   */
  buildAuthorizeUrl(userId: string, res: Response): string {
    const clientId = this.requireEnv("GITHUB_CLIENT_ID");
    this.requireEnv("GITHUB_CLIENT_SECRET");
    const redirectUri = this.requireEnv("GITHUB_REDIRECT_URI");

    const state = randomBytes(24).toString("hex");
    this.setStateCookie(res, state, userId);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: GITHUB_SCOPES,
      state,
    });
    return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Complete the OAuth callback. Never throws: every failure path degrades
   * to a redirect to the frontend with ?github=error so the profile
   * page keeps working.
   */
  async handleCallback(input: GithubCallbackInput, res: Response): Promise<void> {
    this.clearStateCookie(res);

    const userId = this.verifyState(input.state, input.cookieValue);
    if (!userId || !input.code) {
      this.redirect(res, "error");
      return;
    }

    try {
      const token = await this.exchangeCode(input.code);
      if (!token) {
        this.redirect(res, "error");
        return;
      }
      const [ghUser, repos] = await Promise.all([
        this.fetchGithubUser(token),
        this.fetchOwnedRepos(token),
      ]);
      const languages = this.qualifiedLanguages(repos);
      const matched = await this.markVerifiedSkills(userId, languages);
      await this.saveGithubUser(userId, ghUser.login);
      this.redirect(res, matched ? "verified" : "none");
    } catch (err) {
      console.error("github verify failed:", err);
      this.redirect(res, "error");
    }
  }
// ---- private: OAuth ----------------------------

  private async exchangeCode(code: string): Promise<string | null> {
    const res = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.requireEnv("GITHUB_CLIENT_ID"),
        client_secret: this.requireEnv("GITHUB_CLIENT_SECRET"),
        redirect_uri: this.requireEnv("GITHUB_REDIRECT_URI"),
        code,
      }),
    });
    if (!res.ok) {
      console.error(`github: token exchange returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!data.access_token) {
      console.error(
        `github: token exchange failed: ${data.error ?? "unknown"} ${data.error_description ?? ""}`,
      );
      return null;
    }
    return data.access_token;
  }

  private async fetchGithubUser(token: string): Promise<{ login: string }> {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: this.githubHeaders(token),
    });
    if (!res.ok) throw new Error(`github: GET /user -> ${res.status}`);
    const data = (await res.json()) as { login?: string };
    return { login: String(data.login ?? "") };
  }

  /** Owned public repos (with `public_repo` scope; excludes forks of other people's code). */
  private async fetchOwnedRepos(token: string): Promise<GithubRepo[]> {
    const all: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= REPOS_MAX_PAGES; page++) {
      const url = `${GITHUB_API_BASE}/user/repos?per_page=${REPOS_PER_PAGE}&page=${page}&affiliation=owner`;
      const res = await fetch(url, { headers: this.githubHeaders(token) });
      if (!res.ok) throw new Error(`github: GET /user/repos -> ${res.status}`);
      const batch = (await res.json()) as unknown;
      const rows = Array.isArray(batch) ? batch : [];
      for (const row of rows as Array<Record<string, unknown>>) all.push(row);
      if (rows.length < REPOS_PER_PAGE) break;
    }
    return all.map((repo) => ({
      language: typeof repo["language"] === "string" ? (repo["language"] as string) : null,
      fork: repo["fork"] === true,
    }));
  }

  private githubHeaders(token: string): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "not-your-gig-backend",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }
// ---- private: language -> skills mapping ----------

  /** Languages that qualify: primary language of >=2 owned, non-forked repos. */
  private qualifiedLanguages(repos: GithubRepo[]): string[] {
    const counts = new Map<string, number>();
    for (const repo of repos) {
      if (repo.fork || !repo.language) continue;
      counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= MIN_REPOS_FOR_VERIFICATION)
      .map(([lang]) => lang);
  }

  /**
   * Map qualified languages to existing rows in the curated skills table
   * (exact name match only — "TypeScript" -> skills.name == "TypeScript").
   * Languages with no matching skill row are skipped; nothing is auto-created.
   * verified_via is set only on user_skills rows the user has already added.
   * Returns true when at least one user_skills row was marked.
   */
  private async markVerifiedSkills(userId: string, languages: string[]): Promise<boolean> {
    if (languages.length === 0) return false;
    const sb = this.supabase.getClient();

    const { data: skills, error } = await sb.from("skills").select("id, name");
    if (error) throw new Error(`github: skills select -> ${error.message}`);

    const nameToId = new Map<string, string>();
    for (const skill of skills ?? []) {
      if (typeof skill?.name === "string" && skill.id) nameToId.set(skill.name, skill.id);
    }

    const skillIds = languages
      .map((lang) => nameToId.get(lang))
      .filter((id): id is string => Boolean(id));
    if (skillIds.length === 0) return false;

    const { data: updatedRows, error: updateError } = await sb
      .from("user_skills")
      .update({ verified_via: "github" })
      .eq("user_id", userId)
      .in("skill_id", skillIds)
      .select("user_id");
    if (updateError) throw new Error(`github: user_skills update -> ${updateError.message}`);
    return (updatedRows?.length ?? 0) > 0;
  }

  /** Persist the connection: github_username + github_connected_at. */
  private async saveGithubUser(userId: string, username: string): Promise<void> {
    if (!username) return;
    const { error } = await this.supabase
      .getClient()
      .from("users")
      .update({
        github_username: username,
        github_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(`github: users update -> ${error.message}`);
  }

  // ---- private: state cookie -------------------------

  private setStateCookie(res: Response, state: string, userId: string): void {
    const exp = Date.now() + STATE_TTL_MS;
    const body = `${state}|${userId}|${exp}`;
    const sig = createHmac("sha256", this.stateSecret()).update(body).digest("base64url");
    const value = encodeURIComponent(`${body}|${sig}`);
    res.setHeader("Set-Cookie", [
      `${STATE_COOKIE}=${value}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${Math.floor(STATE_TTL_MS / 1000)}`,
    ].join("; "));
  }

  /** Verify the cookie was issued for this exact state+user and has not expired. */
  private verifyState(state: string | null, cookieValue: string | null): string | null {
    if (!state || !cookieValue) return null;
    let parts: string[];
    try {
      parts = decodeURIComponent(cookieValue).split("|");
    } catch {
      return null;
    }
    if (parts.length !== 4) return null;
    const [cookieState, userId, expRaw, signature] = parts;
    if (cookieState !== state || !userId) return null;
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Date.now()) return null;

    const body = `${cookieState}|${userId}|${expRaw}`;
    const expected = createHmac("sha256", this.stateSecret()).update(body).digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return userId;
  }

  private clearStateCookie(res: Response): void {
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  private stateSecret(): string {
    const explicit = this.config.get<string>("GITHUB_STATE_SECRET");
    if (explicit?.trim()) return explicit.trim();
    const fallback = this.config.get<string>("GITHUB_CLIENT_SECRET");
    if (!fallback?.trim()) {
      throw new ServiceUnavailableException(
        "GitHub OAuth is not configured: GITHUB_CLIENT_SECRET or GITHUB_STATE_SECRET is missing",
      );
    }
    return fallback.trim();
  }

  private requireEnv(name: string): string {
    const value = this.config.get<string>(name);
    if (!value?.trim()) {
      throw new ServiceUnavailableException(
        `GitHub OAuth is not configured: ${name} is missing from the environment`,
      );
    }
    return value.trim();
  }

  // ---- private: redirect back to the frontend -------------------------

  private redirect(res: Response, outcome: GithubConnectOutcome): void {
    const successUrl =
      this.config.get<string>("GITHUB_SUCCESS_REDIRECT_URL") ?? this.defaultFrontendUrl();
    let target: string;
    try {
      const url = new URL(successUrl);
      url.searchParams.set("github", outcome);
      target = url.toString();
    } catch {
      const sep = successUrl.includes("?") ? "&" : "?";
      target = `${successUrl}${sep}github=${outcome}`;
    }
    res.redirect(302, target);
  }

  private defaultFrontendUrl(): string {
    const configured = this.config.get<string>("FRONTEND_URL");
    const first = configured?.split(",").map((s) => s.trim()).filter(Boolean)[0];
    return `${first ?? "http://localhost:5173"}/dashboard/profile`;
  }
}