import { NextResponse } from "next/server"
import { logError } from "@/lib/logger"

// Client error collector. Browser posts unhandled errors here; server logs to disk.
// Rate-limit by IP (best-effort) to prevent flood.
const _rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = _rateMap.get(ip)
  if (!rec || rec.resetAt < now) {
    _rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  rec.count++
  return rec.count > RATE_LIMIT_MAX
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown"
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 })
    }
    const body = await req.json() as {
      source?: string; level?: string; msg?: string; stack?: string;
      path?: string; userAgent?: string; details?: Record<string, unknown>
    }
    const truncate = (s: string | undefined, n: number) => s && s.length > n ? s.slice(0, n) : s
    await logError({
      source: "site-client",
      level: (["error", "warn", "info"].includes(body.level || "") ? body.level : "error") as any,
      msg: truncate(body.msg, 2000) || "unknown client error",
      stack: truncate(body.stack, 5000),
      path: truncate(body.path, 500),
      userAgent: truncate(body.userAgent, 500),
      details: body.details,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
