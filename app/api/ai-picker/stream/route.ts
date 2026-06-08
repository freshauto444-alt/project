// Streaming search proxy — forwards SSE from the parser to the browser so
// the picker UI can append cars as each source completes (cache → AS24 → Bytbil → Blocket).
//
// Frontend POSTs the same chatPreferences payload it would send to /api/ai-picker;
// we transform to parser /search/stream query params and proxy the SSE response.

import { euPriceFromTurnkey } from "@/lib/constants"

const PARSER_URL = process.env.PARSER_API_URL || "http://localhost:8000"
const PARSER_KEY = process.env.PARSER_API_KEY || "freshauto_secret_2024"

interface StreamRequest {
  make?: string | null
  model?: string | null
  body_type?: string | null
  fuel?: string | null
  transmission?: string | null
  drive?: string | null
  color?: string | null
  vehicle_type?: string | null
  year_from?: number | null
  year_to?: number | null
  budget_min?: number | null
  budget_max?: number | null
}

export async function POST(req: Request): Promise<Response> {
  let body: StreamRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    })
  }

  // Convert turnkey budget → EU price (parser filters by EU price)
  const euMin = body.budget_min != null ? euPriceFromTurnkey(body.budget_min) : null
  const euMax = body.budget_max != null ? euPriceFromTurnkey(body.budget_max) : null

  const qs = new URLSearchParams()
  if (body.make)         qs.set("make", body.make)
  if (body.model)        qs.set("model", body.model)
  if (body.vehicle_type) qs.set("vehicle_type", body.vehicle_type)
  if (body.year_from)    qs.set("year_from", String(body.year_from))
  if (body.year_to)      qs.set("year_to", String(body.year_to))
  if (euMin != null)     qs.set("price_min", String(Math.max(5000, Math.round(euMin))))
  if (euMax != null)     qs.set("price_max", String(Math.round(euMax)))
  if (body.fuel)         qs.set("fuel", body.fuel)
  if (body.transmission) qs.set("transmission", body.transmission)
  if (body.body_type)    qs.set("body_type", body.body_type)
  if (body.drive)        qs.set("drive", body.drive)
  if (body.color)        qs.set("color", body.color)
  qs.set("limit", "60")

  const upstream = `${PARSER_URL}/search/stream?${qs}`

  // Forward client AbortController to upstream so cancelling the picker also
  // cancels the parser stream (no orphan scrapes).
  const upstreamController = new AbortController()
  req.signal.addEventListener("abort", () => upstreamController.abort())

  const upstreamRes = await fetch(upstream, {
    headers: { "x-api-key": PARSER_KEY, "Accept": "text/event-stream" },
    signal: upstreamController.signal,
  }).catch(e => {
    return new Response(
      `data: ${JSON.stringify({ error: e?.message ?? "upstream connect failed" })}\n\n` +
      `data: ${JSON.stringify({ done: true, total: 0 })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    )
  })

  if (!upstreamRes || !upstreamRes.ok || !upstreamRes.body) {
    const status = upstreamRes?.status ?? 502
    return new Response(
      `data: ${JSON.stringify({ error: `Parser HTTP ${status}` })}\n\n` +
      `data: ${JSON.stringify({ done: true, total: 0 })}\n\n`,
      {
        status: 200,  // don't propagate 5xx — frontend handles "done" event
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      },
    )
  }

  return new Response(upstreamRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
