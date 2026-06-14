import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Admin-only AI-picker funnel metrics from public.picker_events (last 30d):
// suggestions_shown → approved → search found → car clicked, plus thin-rate and
// 0-result rate. Per-SOURCE hit rates live in the parser (/stats) — this is the
// site-side funnel. Returns zeros (not an error) if the table is empty/absent.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single()
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const since = new Date(Date.now() - 30 * 864e5).toISOString()
  const { data, error } = await supabase
    .from("picker_events")
    .select("kind, make, model, found, grounded, shown, meta, ts")
    .gte("ts", since)
    .limit(50000)

  if (error || !data) {
    // Table not migrated yet, or read failed — report an empty funnel, not a 500.
    return NextResponse.json({ window_days: 30, events: 0, funnel: null, note: "no picker_events yet" })
  }

  const shown = data.filter(e => e.kind === "suggestions_shown")
  const approved = data.filter(e => e.kind === "suggestion_approved")
  const searched = data.filter(e => e.kind === "search_completed")
  const clicked = data.filter(e => e.kind === "car_clicked")

  const thinShown = shown.filter(e => (e.meta as any)?.thin === true).length
  const zeroResults = searched.filter(e => (e.found ?? 0) === 0).length
  const foundSearches = searched.length - zeroResults
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0)

  // Top approved base models.
  const approvedCounts = new Map<string, number>()
  for (const e of approved) {
    if (!e.make || !e.model) continue
    const k = `${String(e.make).trim()} ${String(e.model).trim()}`
    approvedCounts.set(k, (approvedCounts.get(k) ?? 0) + 1)
  }
  const topApproved = [...approvedCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([model, count]) => ({ model, count }))

  return NextResponse.json({
    window_days: 30,
    events: data.length,
    funnel: {
      suggestions_shown: shown.length,
      approved: approved.length,
      searches: searched.length,
      found_searches: foundSearches,
      cars_clicked: clicked.length,
    },
    rates_pct: {
      thin_rate: pct(thinShown, shown.length),           // % of shown sessions that were thin
      approve_rate: pct(approved.length, shown.length),  // % shown → approved
      zero_result_rate: pct(zeroResults, searched.length), // % searches returning 0
      approve_to_found: pct(foundSearches, approved.length), // % approvals that found cars
      click_through: pct(clicked.length, foundSearches), // % found searches → a car opened
    },
    top_approved: topApproved,
  })
}
