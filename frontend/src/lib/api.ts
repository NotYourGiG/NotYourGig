// Minimal typed fetch wrapper for the NestJS backend (same-origin /api via
// the Vite dev proxy). Attaches the Clerk session token automatically when
// a token provider is registered (see UserProvider).
const API_BASE = "/api"

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
