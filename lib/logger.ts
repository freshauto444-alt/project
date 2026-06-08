/**
 * Unified error logger — server-side + client-side.
 *
 * Server: writes JSON-lines to /Users/gruttyx/Desktop/cars_site/.logs/site-errors.jsonl
 *         (path resolved relative to process.cwd() → ../.logs/site-errors.jsonl)
 * Client: POSTs to /api/log/client-error, which logs server-side.
 *
 * Usage:
 *   - Server Components / API routes: `import { logError } from "@/lib/logger"`
 *   - Client: `import { logClientError } from "@/lib/logger"` (sends fetch)
 */

export type LogEntry = {
  ts: string                // ISO timestamp
  source: "site-server" | "site-client" | "site-api" | "ai" | "supabase"
  level: "error" | "warn" | "info"
  msg: string
  stack?: string
  path?: string             // URL/route
  userAgent?: string
  details?: Record<string, unknown>
}

const LOG_PATH_REL = "../.logs/site-errors.jsonl"
const SEARCH_LOG_PATH_REL = "../.logs/search-events.jsonl"

/** Server-only: append a log entry to disk (best-effort, never throws). */
export async function logError(entry: Omit<LogEntry, "ts">): Promise<void> {
  // Guard: only runs server-side (node). Clients use logClientError.
  if (typeof window !== "undefined") return
  try {
    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    const full: LogEntry = { ...entry, ts: new Date().toISOString() }
    const file = path.resolve(process.cwd(), LOG_PATH_REL)
    await fs.appendFile(file, JSON.stringify(full) + "\n", { encoding: "utf8" })
  } catch {
    // Logger failure must never break the request. Fallback: console.
    console.error("[logger] failed to write", entry)
  }
}

export type SearchEvent = {
  ts: string
  orderId?: string
  source: "chat" | "suggestion-card" | "load-more" | "other"
  query: Record<string, unknown>
  rawCount: number
  filteredCount?: number
  yearMin?: number | null
  yearMax?: number | null
  priceMin?: number | null
  priceMax?: number | null
  cars?: Array<{ year: number | null; make: string | null; model: string | null; price: number | null; url: string | null }>
  notes?: string
}

/** Server-only: append a search event for later debugging of mismatched results. */
export async function logSearchEvent(entry: Omit<SearchEvent, "ts">): Promise<void> {
  if (typeof window !== "undefined") return
  try {
    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    const full: SearchEvent = { ...entry, ts: new Date().toISOString() }
    const file = path.resolve(process.cwd(), SEARCH_LOG_PATH_REL)
    await fs.appendFile(file, JSON.stringify(full) + "\n", { encoding: "utf8" })
  } catch {
    console.error("[logger] failed to write search event", entry)
  }
}

/** Client-only: send error to /api/log/client-error. */
export function logClientError(entry: Omit<LogEntry, "ts" | "userAgent">): void {
  if (typeof window === "undefined") return
  try {
    const body = JSON.stringify({ ...entry, userAgent: navigator.userAgent })
    // keepalive: survives page-unload (so unhandled errors during navigation still send)
    if ("fetch" in window) {
      fetch("/api/log/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // swallow
  }
}
