// ═══════════════════════════════════════════════════════════════════════════════
//  Parser integration — calls the separate parser service /search/instant and
//  orchestrates the per-pair 3-step fallback cascade. Extracted from route.ts.
//  No prompt text. Budget reverse-conversion + client-side filtering live here.
// ═══════════════════════════════════════════════════════════════════════════════

import { MIN_BUDGET, PARSER_KEY, PARSER_URL } from "./config"
import { extractSearchParams } from "./survey-params"
import { stripGenerationSuffix } from "./normalize"
import { filterCarsClientSide } from "./filters"
import type { Answer, CarPair, ChatPreferences } from "./types"

async function callParserInstant(
  payload: Record<string, unknown>,
): Promise<{ count: number; cars: any[] } | null> {
  if (!PARSER_URL) return null
  try {
    // Build query string for GET /search/instant
    const params = new URLSearchParams()
    if (payload.make) params.set("make", String(payload.make))
    if (payload.model) params.set("model", String(payload.model))
    if (payload.year_from) params.set("year_from", String(payload.year_from))
    if (payload.year_to) params.set("year_to", String(payload.year_to))
    // Use `!= null` (not truthy check) so budget_min=0 is sent explicitly.
    // The parser API defaults to 5000 EUR when price_min is omitted, which
    // would re-introduce a floor we deliberately wanted to drop in the
    // fallback step of searchWithFallback.
    if (payload.budget_min != null) params.set("price_min", String(payload.budget_min))
    if (payload.budget_max) params.set("price_max", String(payload.budget_max))
    if (payload.fuel) params.set("fuel", String(payload.fuel))
    if (payload.transmission) params.set("transmission", String(payload.transmission))
    if (payload.body_type) params.set("body_type", String(payload.body_type))
    if (payload.drive) params.set("drive", String(payload.drive))
    params.set("limit", "100")

    const url = `${PARSER_URL}/search/instant?${params}`
    // Diagnostic — log every parser call so you can correlate "0 cars found"
    // red messages with the exact URL that was hit. Visible in Vercel runtime
    // logs under `[picker] parser →`.
    console.log(`[picker] parser → ${url.replace(PARSER_URL, "")}`)
    const res = await fetch(url, {
      headers: PARSER_KEY ? { "x-api-key": PARSER_KEY } : {},
    })
    if (!res.ok) {
      const { logError } = await import("@/lib/logger")
      await logError({ source: "site-api", level: "error", msg: `Parser /search/instant HTTP ${res.status}`, details: { endpoint: "ai-picker/route", url } })
      return null
    }
    const data = await res.json()
    if (data.count > 0) return data
    return null
  } catch (err: any) {
    const { logError } = await import("@/lib/logger")
    await logError({ source: "site-api", level: "error", msg: `Parser /search/instant failed: ${err?.message ?? err}`, stack: err?.stack, details: { endpoint: "ai-picker/route" } })
    return null
  }
}

// callParser + pollJobResults removed: searchWithFallback in triggerParser
// uses only callParserInstant now (strict 2-step cascade). If both attempts
// return empty, the frontend shows '0 results' instead of the heavier sync
// /search and job-queue paths.

export async function triggerParser(
  answers: Answer[],
  clientOrderId: string,
  chat: ChatPreferences,
  skipCache: boolean = false,
) {
  if (!PARSER_URL) {
    const { logError } = await import("@/lib/logger")
    await logError({ source: "site-api", level: "error", msg: "No PARSER_URL configured", details: { endpoint: "ai-picker/route" } })
    return null
  }
  const base = extractSearchParams(answers)

  // Budget: chat preferences > survey answers
  let budgetMin = chat.budget_min ?? base.budget_min
  let budgetMax = chat.budget_max ?? base.budget_max
  if (chat.budget != null && budgetMin == null && budgetMax == null) {
    // A single budget figure is a CEILING ("бюджет 35к" / "до 35к" = up to X),
    // NOT a tight band. The old ±5% window collapsed to ~€2.5k EU after the
    // turnkey→EU divide (÷1.38), so "Golf GTI, budget 35k" matched only cars at
    // exactly €20.8–23.4k EU → ~4 results. Treat it as the max and let the
    // MIN_BUDGET floor below set the lower bound, so the client sees the whole
    // affordable range up to their budget.
    budgetMax = chat.budget
  }
  // Always enforce the turnkey floor, even when the client gave NO budget (e.g.
  // "Шукати за всіма параметрами"): Fresh Auto deals only in cars ≥ MIN_BUDGET
  // turnkey, so a no-budget search must still exclude cheap utility vehicles
  // (Fiat Doblo, vans) instead of surfacing them.
  budgetMin = Math.max(budgetMin ?? 0, MIN_BUDGET)

  // User's budget is "turnkey" (final price inc. duty+excise+VAT+delivery).
  // Parser filters by raw EU source price, so reverse-calculate the EU ceiling/floor.
  // Formula: eu = (turnkey - fixed_fees) / 1.38 (see lib/constants.ts euPriceFromTurnkey)
  const { euPriceFromTurnkey } = await import("@/lib/constants")
  const euBudgetMin = budgetMin != null ? euPriceFromTurnkey(budgetMin) : null
  const euBudgetMax = budgetMax != null ? euPriceFromTurnkey(budgetMax) : null

  const commonPayload: Record<string, unknown> = {
    year_from: chat.year_from ?? base.year_from,
    year_to: chat.year_to ?? base.year_to,
    budget_min: euBudgetMin,  // raw EU ceiling, derived from user's turnkey budget
    budget_max: euBudgetMax,
    fuel: chat.fuel ?? base.fuel,
    transmission: chat.transmission ?? base.transmission,
    body_type: chat.body_type ?? base.body_type,
    drive: chat.drive ?? base.drive ?? null,
    displacement_min: chat.displacement_min ?? base.displacement_min ?? null,
    displacement_max: chat.displacement_max ?? null,
    client_order_id: clientOrderId,
    skip_cache: skipCache,
  }

  const pairs: CarPair[] = chat.pairs.length > 0 ? chat.pairs : [{ make: null, model: null }]

  // Parallel search for multiple brand/model pairs. Bumped 3 → 8 — users legitimately
  // compare several brands at once (BMW/Audi/Mercedes, or 3er/5er/X3 within one brand).
  // Each parser /search/instant hits its per-brand cache independently, so 8 parallel
  // requests take ~same wall-clock time as 1 (they're I/O-bound, cache-hit dominant).
  const limitedPairs = pairs.slice(0, 8)

  // Strict 3-step search. Per explicit user request: only drop price_min on
  // fallback step 2, never year or upper budget. Better to show '0 results'
  // honestly than return cars outside the user's budget — the previous
  // aggressive cascade gave back Mazda 30k cars for a "Infiniti від 60k"
  // query and the user (rightly) called that misleading.
  //
  // Step 3 drops the year window for niche models (Infiniti, narrow trims)
  // where AI's yearRange ends up too tight for the actual stock. Without it
  // the user sees "0 results" even though cars exist in adjacent years.
  const hasYearWindow = commonPayload.year_from != null || commonPayload.year_to != null
  const searchWithFallback = async (p: CarPair) => {
    // Normalize trailing generation suffixes (e.g. "passat b9" → "passat").
    // AS24's slug map only has base model names; "passat-b9" resolves to a
    // non-existent URL and the whole 3-step cascade returns 0 even though
    // /volkswagen/passat has plenty of stock.
    const model = stripGenerationSuffix(p.model)

    // Step 1: AI/user criteria as-is
    const first = await callParserInstant({ ...commonPayload, make: p.make, model })
    if (first && first.count > 0) return first

    // Step 2: drop lower price bound only. Keep year_from/year_to/budget_max.
    // budget_min=0 (not null) — parser defaults to 5000 EUR when omitted.
    const second = await callParserInstant({ ...commonPayload, budget_min: 0, make: p.make, model })
    if (second && second.count > 0) return second

    // Step 3: drop year window too — only triggers if step 1/2 used a year
    // filter. Skip when no year was set in the first place (otherwise it's a
    // duplicate of step 2).
    if (hasYearWindow) {
      const third = await callParserInstant({
        ...commonPayload,
        budget_min: 0,
        year_from: null,
        year_to: null,
        make: p.make,
        model,
      })
      if (third && third.count > 0) return third
    }

    // All empty → return empty. Frontend shows the red "0 found" message.
    return { count: 0, cars: [] }
  }

  const results = await Promise.all(limitedPairs.map(searchWithFallback))

  // Deduplicate — iterate pairs in REVERSE chronological order so the
  // most-recently-added selection appears first in the merged list.
  //
  // Why this matters: when the chat is cumulative (user picked BMW first,
  // then Audi), `pairs` grows in the order they were added. If we kept
  // natural order, the old BMW results would still appear at the top
  // and the user would have to scroll past them to see the cars they
  // just asked about. Reversing puts the latest pick at the top of
  // each refresh, which matches user expectation.
  const seenUrls = new Set<string>()
  let allCars: any[] = []
  for (const r of [...results].reverse()) {
    if (!r) continue
    for (const car of r.cars ?? []) {
      const key = (car.url ?? car.source_url ?? car.id) as string
      if (key && seenUrls.has(key)) continue
      if (key) seenUrls.add(key)
      allCars.push(car)
    }
  }

  // ── Client-side filtering (params that parser doesn't support) ──────────
  // Merge survey-form values (from extractSearchParams) with chat-extracted prefs
  const filterPrefs: ChatPreferences = {
    ...chat,
    displacement_min: chat.displacement_min ?? base.displacement_min ?? null,
    displacement_max: chat.displacement_max ?? base.displacement_max ?? null,
    hp_min: chat.hp_min ?? base.hp_min ?? null,
    seats_min: chat.seats_min ?? base.seats_min ?? null,
    drive: chat.drive ?? base.drive ?? null,
    mileage_min: chat.mileage_min ?? base.mileage_min ?? null,
    mileage_max: chat.mileage_max ?? base.mileage_max ?? null,
    color: chat.color ?? base.color ?? null,
    doors: chat.doors ?? base.doors ?? null,
    interior_material: chat.interior_material ?? base.interior_material ?? null,
    purpose_body_types: chat.purpose_body_types.length > 0
      ? chat.purpose_body_types
      : base.purpose_body_types ?? [],
  }
  allCars = filterCarsClientSide(allCars, filterPrefs)

  // SOFT image preference: prefer cars with images at the TOP, but never drop
  // cars entirely — otherwise a partially-indexed DB returns "no cars found"
  // when cars actually exist (the bug user reported: "у відповідь нажаль немає авто").
  const withImg = allCars.filter(c => c.image)
  const withoutImg = allCars.filter(c => !c.image)
  allCars = [...withImg, ...withoutImg]

  return { count: allCars.length, cars: allCars }
}
