import clsx, { type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// shadcn/ui cn() helper — the one shared util the UI layer needs.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize a user-supplied link into a safe href: trims whitespace and
 * prepends https:// when no protocol is present, so a value like
 * "jokeverse-yb2z.vercel.app/" renders as a real external link instead of a
 * relative path resolved against this app's own origin.
 */
export function normalizeUrl(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) return v
  return `https://${v}`
}