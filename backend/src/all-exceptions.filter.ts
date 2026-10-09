import { ArgumentsHost, Catch, HttpServer } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

// Global exception filter — THE place where unhandled errors (including every
// `DB error: ...` thrown by the services) are caught and logged.
//
// Nest's default filter only logs `error.message` + stack, which hides the
// real reason behind generic messages like `DB error: TypeError: fetch failed`.
// This wrapper additionally walks `error.cause` and logs each level: name,
// message, code/errno/syscall/address/port (ENOTFOUND, ETIMEDOUT, ECONNREFUSED,
// TLS codes, ...), plus PostgREST `details`/`hint` — postgrest-js flattens the
// original fetch error, cause code included, into `details`. Response
// behaviour is unchanged: everything is delegated to BaseExceptionFilter.
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(applicationRef?: HttpServer) {
    super(applicationRef);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const causeLines = describeCauseChain(exception);
    if (causeLines.length > 0) {
      console.error(`[exceptions] ${topLevelMessage(exception)}`);
      for (const line of causeLines) {
        console.error(`[exceptions]   ${line}`);
      }
    }
    super.catch(exception, host);
  }
}

function topLevelMessage(exception: unknown): string {
  if (exception instanceof Error) return exception.message;
  const message = (exception as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" && message ? message : String(exception);
}

/** Walk `root.cause` (depth-capped, cycle-safe) and describe every level. */
function describeCauseChain(root: unknown): string[] {
  const lines: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = (root as { cause?: unknown } | null | undefined)?.cause;
  let depth = 0;

  while (current !== null && current !== undefined && depth < 8) {
    if (typeof current === "object") {
      if (seen.has(current)) {
        lines.push("[circular cause]");
        break;
      }
      seen.add(current);
    }
    lines.push(...describeNode(current));
    if (isAggregateError(current)) {
      for (const sub of current.errors) {
        lines.push(...describeNode(sub));
      }
    }
    current = (current as { cause?: unknown } | null | undefined)?.cause;
    depth += 1;
  }
  return lines;
}

const INTERESTING_FIELDS = ["code", "errno", "syscall", "address", "port"] as const;

function describeNode(node: unknown): string[] {
  if (typeof node !== "object" || node === null) {
    return node === null || node === undefined ? [] : [String(node)];
  }
  const err = node as Record<string, unknown>;
  const name = typeof err.name === "string" && err.name ? err.name : null;
  const message = typeof err.message === "string" && err.message ? err.message : null;

  const parts: string[] = [];
  if (name && message) parts.push(`${name}: ${message}`);
  else if (message) parts.push(message);
  else if (name) parts.push(name);

  for (const field of INTERESTING_FIELDS) {
    const value = err[field];
    if (typeof value === "string" && value) parts.push(`${field}=${value}`);
    else if (typeof value === "number") parts.push(`${field}=${value}`);
  }
  if (parts.length === 0) return [];

  // PostgREST error objects: `details` embeds the flattened fetch-error cause
  // (e.g. "Caused by: Error: getaddrinfo ENOTFOUND ... (ENOTFOUND)"), `hint`
  // carries Postgres guidance. Both are the whole point of this filter.
  const lines = [parts.join(" | ")];
  const details = typeof err.details === "string" ? err.details.trim() : "";
  if (details) lines.push(`details: ${details}`);
  const hint = typeof err.hint === "string" ? err.hint.trim() : "";
  if (hint) lines.push(`hint: ${hint}`);
  return lines;
}

function isAggregateError(node: unknown): node is { errors: unknown[] } {
  return (
    typeof node === "object" &&
    node !== null &&
    Array.isArray((node as { errors?: unknown }).errors)
  );
}