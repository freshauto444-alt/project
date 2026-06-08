// Streaming search proxy — forwards SSE from the parser to the browser so
// the picker UI can append cars as each source completes (cache → AS24 → Bytbil → Blocket).
//
// Frontend POSTs the same chatPreferences payload it would send to /api/ai-picker;
// we transform to parser /search/stream query params, then filter each batch
// through the shared filterCarsClientSide so the streamed path applies the
// same Vito/M50i/etc safety net the blocking /api/ai-picker has.

import { euPriceFromTurnkey } from "@/lib/constants"
import { type ChatPreferences, filterCarsClientSide } from "@/lib/car-filter"

const PARSER_URL = process.env.PARSER_API_URL || "http://localhost:8000"
const PARSER_KEY = process.env.PARSER_API_KEY || "freshauto_secret_2024"

interface StreamRequest {
  // Single-pair convenience (legacy callers — used by aiUnavailable flow).
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

  // Full chat preferences — when present, used both for parser query AND for
  // post-fetch filtering of each SSE batch.
  chatPreferences?: ChatPreferences | null
}

function buildPrefsForFilter(body: StreamRequest): ChatPreferences {
  if (body.chatPreferences) return body.chatPreferences
  // Synthesise a minimal ChatPreferences from the flat fields for legacy callers.
  return {
    pairs: body.make ? [{ make: body.make, model: body.model ?? null }] : [],
    fuel: body.fuel ?? null,
    body_type: body.body_type ?? null,
    budget: null,
    budget_min: body.budget_min ?? null,
    budget_max: body.budget_max ?? null,
    color: body.color ?? null,
    mileage_max: null,
    mileage_min: null,
    required_options: [],
    year_from: body.year_from ?? null,
    year_to: body.year_to ?? null,
    transmission: body.transmission ?? null,
    drive: body.drive ?? null,
    displacement_min: null,
    displacement_max: null,
    hp_min: null,
    seats_min: null,
    doors: null,
    interior_material: null,
    purpose_body_types: [],
  }
}

function stripGenerationSuffix(model: string | null | undefined): string | null {
  if (!model) return model ?? null
  const trimmed = model.trim()
  const match = trimmed.match(/^(.*?)[\s-]+[bwfgce]\d{1,3}$/i)
  if (!match) return trimmed
  const base = match[1].trim()
  if (/^(amg|m|rs|s|gt)$/i.test(base)) return trimmed
  return base || trimmed
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

  const prefs = buildPrefsForFilter(body)

  // Resolve make+model: prefer the first chat-prefs pair when full prefs given.
  const firstPair = prefs.pairs[0]
  const make = firstPair?.make ?? body.make ?? null
  const rawModel = firstPair?.model ?? body.model ?? null
  const model = stripGenerationSuffix(rawModel)

  const budgetMin = prefs.budget_min ?? body.budget_min ?? null
  const budgetMax = prefs.budget_max ?? body.budget_max ?? null
  const euMin = budgetMin != null ? euPriceFromTurnkey(budgetMin) : null
  const euMax = budgetMax != null ? euPriceFromTurnkey(budgetMax) : null

  const qs = new URLSearchParams()
  if (make)                            qs.set("make", make)
  if (model)                           qs.set("model", model)
  if (body.vehicle_type)               qs.set("vehicle_type", body.vehicle_type)
  if (prefs.year_from)                 qs.set("year_from", String(prefs.year_from))
  if (prefs.year_to)                   qs.set("year_to", String(prefs.year_to))
  if (euMin != null)                   qs.set("price_min", String(Math.max(5000, Math.round(euMin))))
  if (euMax != null)                   qs.set("price_max", String(Math.round(euMax)))
  if (prefs.fuel)                      qs.set("fuel", prefs.fuel)
  if (prefs.transmission)              qs.set("transmission", prefs.transmission)
  if (prefs.body_type)                 qs.set("body_type", prefs.body_type)
  if (prefs.drive)                     qs.set("drive", prefs.drive)
  if (prefs.color)                     qs.set("color", prefs.color)
  qs.set("limit", "100")

  const upstream = `${PARSER_URL}/search/stream?${qs}`

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
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      },
    )
  }

  // Intercept the SSE stream so we can filter each batch through
  // filterCarsClientSide before passing it to the browser. This keeps the
  // Vito Tourer / M50i guards aligned with the blocking endpoint.
  const reader = upstreamRes.body.getReader()
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let buf = ""
  let totalEmitted = 0

  const out = new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buf.trim()) {
            // Flush any trailing partial line as-is.
            controller.enqueue(enc.encode(buf))
          }
          controller.close()
          return
        }
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) {
            controller.enqueue(enc.encode(line + "\n"))
            continue
          }
          let ev: any
          try { ev = JSON.parse(line.slice(6)) } catch {
            controller.enqueue(enc.encode(line + "\n"))
            continue
          }
          if (ev.cars && Array.isArray(ev.cars)) {
            const kept = filterCarsClientSide(ev.cars, prefs)
            totalEmitted += kept.length
            // Always emit an event (even with 0 cars) so the client can show
            // per-source progress / spinners. Preserve other event fields.
            const out = { ...ev, cars: kept }
            controller.enqueue(enc.encode(`data: ${JSON.stringify(out)}\n\n`))
          } else if (ev.done) {
            // Override "total" with the count we actually emitted.
            const out = { ...ev, total: totalEmitted }
            controller.enqueue(enc.encode(`data: ${JSON.stringify(out)}\n\n`))
          } else {
            controller.enqueue(enc.encode(line + "\n"))
          }
        }
        return
      }
    },
    cancel() {
      upstreamController.abort()
    },
  })

  return new Response(out, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
