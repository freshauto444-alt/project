import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Admin-only: tail the last N entries from site-errors.jsonl.
 * GET /api/admin/logs?n=100  → { entries: LogEntry[] }
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("user_id", user.id).single()
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const n = Math.min(500, Math.max(1, parseInt(url.searchParams.get("n") || "100")))

  try {
    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    const file = path.resolve(process.cwd(), "../.logs/site-errors.jsonl")
    const content = await fs.readFile(file, "utf8").catch(() => "")
    const lines = content.split("\n").filter(Boolean).slice(-n).reverse()
    const entries = lines.map(l => {
      try { return JSON.parse(l) } catch { return null }
    }).filter(Boolean)
    return NextResponse.json({ entries, count: entries.length, total_lines: content.split("\n").length - 1 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "read failed" }, { status: 500 })
  }
}
