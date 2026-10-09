import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lookup } from "node:dns/promises";

// Health check for the deployed backend (Vercel). Thanks to the global "api"
// prefix, these map to:
//   GET /api           -> 200 {"status":"ok",...}
//   GET /api/health    -> 200 {"status":"ok",...}
//   GET /api/health/db -> 200 {"status":"ok|error","dns":{...},"fetch":{...}}
// Use these URLs to verify the backend is live before wiring it into the frontend.
@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  root() {
    return this.status();
  }

  @Get("health")
  health() {
    return this.status();
  }

  /**
   * TEMPORARY Supabase connectivity diagnostic — delete this handler (and the
   * module helpers below the class) once the cause of the production
   * `fetch failed` 500s is known. It is intentionally unauthenticated.
   *
   * From inside the Vercel function: (1) DNS-lookup the SUPABASE_URL hostname,
   * (2) GET {origin}/rest/v1/ with a 5s timeout. The response exposes only the
   * hostname, DNS answers and status/error codes — never the raw URL, apikey,
   * service-role key, request headers or response bodies.
   */
  @Get("health/db")
  async dbHealth() {
    const time = new Date().toISOString();
    const raw = this.config.get<string>("SUPABASE_URL") ?? "";
    const hadWhitespace = raw !== raw.trim();

    let hostname: string | null = null;
    let origin: string | null = null;
    if (raw.trim()) {
      try {
        const parsed = new URL(raw.trim());
        hostname = parsed.hostname;
        origin = parsed.origin;
      } catch {
        // Invalid URL: reported below without echoing the raw value.
      }
    }

    if (!origin || !hostname) {
      return {
        status: "error",
        time,
        supabase: {
          configured: raw.trim().length > 0,
          hostname: null,
          surrounding_whitespace: hadWhitespace,
        },
        dns: null,
        fetch: {
          ok: false,
          error: raw.trim()
            ? "SUPABASE_URL is not a valid absolute URL"
            : "SUPABASE_URL is not set",
          // Safe clues for diagnosing a bad paste — never the value itself.
          url_length: raw.trim().length,
          has_http_scheme: /^https?:\/\//i.test(raw.trim()),
        },
      };
    }

    // 1) DNS lookup (capped at 5s so a stuck resolver cannot hang the function).
    const dnsStart = Date.now();
    let dns: ProbeResult;
    try {
      const address = await withTimeout(lookup(hostname), 5000, "dns");
      dns = {
        ok: true,
        address: address.address,
        family: address.family,
        ms: Date.now() - dnsStart,
      };
    } catch (err) {
      dns = {
        ok: false,
        code: errorCode(err),
        message: errorMessage(err),
        ms: Date.now() - dnsStart,
      };
    }

    // 2) HTTP probe. Deliberately NO Authorization/apikey header: any response
    //    (even 401) proves DNS + TCP + TLS work, and no secret can be echoed.
    //    origin normalization avoids `https://host//rest/v1/` when the env var
    //    has a trailing slash.
    const fetchStart = Date.now();
    let fetchResult: ProbeResult;
    try {
      const res = await fetch(`${origin}/rest/v1/`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      fetchResult = {
        ok: true,
        status: res.status,
        statusText: res.statusText,
        ms: Date.now() - fetchStart,
      };
    } catch (err) {
      fetchResult = {
        ok: false,
        name: errorName(err),
        message: errorMessage(err),
        code: errorCode(err),
        cause: describeCause(err),
        ms: Date.now() - fetchStart,
      };
    }

    return {
      status: dns.ok && fetchResult.ok ? "ok" : "error",
      time,
      supabase: {
        configured: true,
        hostname,
        surrounding_whitespace: hadWhitespace,
      },
      dns,
      fetch: fetchResult,
    };
  }

  private status() {
    return {
      status: "ok",
      service: "not-your-gig-backend",
      time: new Date().toISOString(),
    };
  }
}

interface ProbeResult {
  ok: boolean;
  [key: string]: unknown;
}

/** Reject with code ETIMEDOUT if `promise` outlives `ms` (dns.lookup can block). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        Object.assign(new Error(`${label} lookup timed out after ${ms}ms`), {
          code: "ETIMEDOUT",
        }),
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorName(err: unknown): string {
  const name = (err as { name?: unknown } | null | undefined)?.name;
  return typeof name === "string" && name ? name : "Error";
}

function errorMessage(err: unknown): string {
  const message = (err as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" && message ? message : String(err);
}

/** Prefer the system code from `error.cause` (ENOTFOUND, ECONNREFUSED, ...). */
function errorCode(err: unknown): string | null {
  const e = err as
    | { name?: unknown; code?: unknown; cause?: { code?: unknown } }
    | null
    | undefined;
  for (const candidate of [e?.cause?.code, e?.code]) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return "ETIMEDOUT";
  return null;
}

/** Compact view of `error.cause` — the reason plain "fetch failed" hides. */
function describeCause(
  err: unknown,
): { name: string; message: string; code: string | null } | null {
  const cause = (err as { cause?: unknown } | null | undefined)?.cause;
  if (cause === null || cause === undefined) return null;
  if (typeof cause !== "object") {
    return { name: "cause", message: String(cause), code: null };
  }
  const c = cause as { name?: unknown; message?: unknown; code?: unknown };
  return {
    name: typeof c.name === "string" && c.name ? c.name : "Error",
    message:
      typeof c.message === "string" && c.message ? c.message : "[object cause]",
    code: typeof c.code === "string" && c.code ? c.code : null,
  };
}