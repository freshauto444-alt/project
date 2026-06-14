import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Append-only picker telemetry → public.picker_events. Powers the T9 learning
// loop (suggestion_approved biases future suggestions) and T10 metrics. Written
// anonymously via the service key. Fully defensive: a missing table / bad input
// must NEVER surface to the user — the picker works regardless of logging.

const ALLOWED_KINDS = new Set([
  "suggestions_shown",
  "suggestion_approved",
  "search_completed",
  "car_clicked",
])

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || !ALLOWED_KINDS.has(body.kind)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const { tryAcquire, clientKey } = await import("@/lib/rate-limit")
    if (!tryAcquire(`picker-event:${clientKey(req)}`, 60).ok) {
      return NextResponse.json({ ok: false }, { status: 429 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return NextResponse.json({ ok: false })

    const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.slice(0, 80) : null)
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)

    const supabase = createClient(url, key)
    await supabase.from("picker_events").insert({
      kind: body.kind,
      session_id: s(body.session_id),
      make: s(body.make),
      model: s(body.model),
      body_type: s(body.body_type),
      budget_min: n(body.budget_min),
      budget_max: n(body.budget_max),
      grounded: n(body.grounded),
      shown: n(body.shown),
      found: n(body.found),
      meta: body.meta && typeof body.meta === "object" ? body.meta : null,
    })
    return NextResponse.json({ ok: true })
  } catch {
    // Logging must never break the UX.
    return NextResponse.json({ ok: false })
  }
}
