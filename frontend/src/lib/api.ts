// Minimal typed fetch wrapper for the NestJS backend. Attaches the Clerk
// session token automatically when a token provider is registered (see
// UserProvider).
//
// API base resolution:
//  - Production (Vercel, separate frontend/backend projects): the frontend is
//    built with VITE_API_URL set to the deployed backend's full API base
//    (origin + /api), e.g. "https://nyg-backend.vercel.app/api". No trailing
//    slash needed.
//  - Local dev: no VITE_API_URL -> same-origin "/api", forwarded by the Vite
//    dev proxy (vite.config.ts) to the NestJS backend on localhost:3000.
//
// NestJS route prefix: every backend route lives under a global /api prefix
// (app.factory.ts: setGlobalPrefix("api")), and api() builds `${API_BASE}${path}`
// e.g. "/auth/me" -> ".../api/auth/me". So VITE_API_URL MUST include the /api
// suffix. A common misconfiguration is setting only the bare backend origin,
// which silently 404s every call against the running backend. normalizeApiBase()
// guards against that by appending /api when it's missing.
const apiBaseFromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

function normalizeApiBase(base: string): string {
  const trimmed = base.replace(/\/+$/, "") // strip any trailing slashes
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`
}

const API_BASE = apiBaseFromEnv ? normalizeApiBase(apiBaseFromEnv) : "/api"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

let tokenProvider: (() => Promise<string | null>) | null = null

/** Register the Clerk getToken provider once; unregister with null. */
export function setTokenProvider(fn: (() => Promise<string | null>) | null) {
  tokenProvider = fn
}

interface ApiOptions {
  method?: string
  body?: unknown
  /** Explicit token override; omit to use the registered provider. */
  token?: string | null
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"

  let token = opts.token
  if (token === undefined && tokenProvider) token = await tokenProvider()
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (typeof body?.message === "string") message = body.message
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}
