import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import type { Response } from "express";
import { SupabaseService } from "../supabase/supabase.service";
import { OauthStateProvider } from "../providers/oauth-state.provider";

// ---------------------------------------------------------------------------
// GitHub proof-of-work verification (separate from Clerk auth).
//
// Flow (Vercel "connect GitHub after signup"-style, but triggered from the
// user's own dashboard/profile):
//   GET /api/auth/github/connect  (Clerk-guarded) ->
//     builds the github.com OAuth authorize URL + a one-time random state,
//     persists state -> user_id (TTL) in Supabase `oauth_state`,
//     returns { url, state_token } so the frontend can pass the state
//     through the OAuth roundtrip (GitHub echoes `state` back to the
//     callback) without needing a browser cookie.
//   GET /api/auth/github/callback (browser redirect from GitHub) ->
//     looks up + consumes the state server-side (single-use, TTL-bound),
//     exchanges the code for an access token,
//     fetches the user's public repos *once*,
//     extracts each repo's primary language,
//     marks user_skills.verified_via='github' for languages that exist in
//     the curated `skills` table (exact name match only) AND appear as the
//     primary language in >= 2 owned, non-forked public repos
//     (a single one-off repo is not proficiency).
//     302s the browser to the frontend with ?github=verified|none|error.
//
// Token lifecycle: the GitHub access token is held only in a local variable
// for the duration of this one callback request and discarded immediately —
// it is NEVER written to the database (no live sync planned).
//
// NOTE: We intentionally avoid state cookies. Browsers (Chrome/Edge/Safari/
// Firefox 2024+) drop Set-Cookie on cross-origin fetch() responses even with
// credentials:"include" + SameSite=None; Secure, so a cookie never survived
// the connect -> github.com -> callback chain. Server-side state (Supabase)
// is the robust fix.
// ---------------------------------------------------------------------------

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_SCOPES = "read:user public_repo";
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
}

export interface GithubAuthorizeResult {
  url: string;
  /** One-time state token the frontend forwards through the OAuth roundtrip. */
  state_token: string;
}

@Injectable()
export class GithubService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly oauthState: OauthStateProvider,
  ) {}

  /**
   * Build the GitHub authorize URL for the given (authenticated) user and
   * persist the state server-side, bound to that user. Returns the URL plus
   * the one-time state token the frontend should carry through the OAuth
   * roundtrip (GitHub echoes `state` back on the callback) — no cookie.
   */
  async buildAuthorizeUrl(userId: string): Promise<GithubAuthorizeResult> {
    const clientId = this.requireEnv("GITHUB_CLIENT_ID");
    this.requireEnv("GITHUB_CLIENT_SECRET");
    const redirectUri = this.requireEnv("GITHUB_REDIRECT_URI");

    const state = randomBytes(24).toString("hex");
    await this.oauthState.create(userId, state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: GITHUB_SCOPES,
      state,
    });
    return { url: `${GITHUB_AUTHORIZE_URL}?${params.toString()}`, state_token: state };
  }

  /**
   * Complete the OAuth callback. Never throws: every failure path degrades
   * to a redirect to the frontend with ?github=error so the profile
   * page keeps working.
   */
  async handleCallback(input: GithubCallbackInput, res: Response): Promise<void> {
    if (!input.code) {
      this.redirect(res, "error");
      return;
    }
    try {
      // Consume the one-time state server-side (also enforces the TTL).
      const userId = await this.oauthState.consume(input.state ?? "");
      if (!userId) {
        this.redirect(res, "error");
        return;
      }
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

  // ---- private: env -----------------------------------

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