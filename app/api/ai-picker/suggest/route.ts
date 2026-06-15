import { createClient } from "@supabase/supabase-js"

// Multi-suggestion Claude generation can take 15-25s; lift past Vercel default.
export const maxDuration = 60

// ═══════════════════════════════════════════════════════════════════════════════
//  AI Car Suggestion Endpoint — Streaming SSE
//
//  Returns a text/event-stream with events:
//    { type: "suggestion", suggestion: CarSuggestion }  — one per suggestion
//    { type: "done" }                                    — stream complete
//    { type: "fallback", fallback: "ai_unavailable", message: string }
//    { type: "error", message: string }
// ═══════════════════════════════════════════════════════════════════════════════

interface SuggestRequest {
  preferences: {
    fuel?: string | null
    body_type?: string | null
    budget_min?: number | null
    budget_max?: number | null
    year_from?: number | null
    year_to?: number | null
    transmission?: string | null
    drive?: string | null
    hp_min?: number | null
    seats_min?: number | null
    displacement_min?: number | null
    displacement_max?: number | null
    mileage_min?: number | null
    mileage_max?: number | null
    doors?: number | null
    color?: string | null
    interior_material?: string | null
    purpose_body_types?: string[]
    pairs?: { make: string | null; model: string | null }[]
  }
  answers?: { questionId: string; selected: string[]; custom: string }[]
  conversationHistory?: { role: string; content: string }[]
  freeText?: string
}

// ── Inventory context: query Supabase before Claude call ──────────────────────
// Gives Claude real data about what's available in stock so suggestions are
// grounded in actual inventory rather than Claude's general knowledge.

// Collapse a noisy parsed model name to its base model so the candidate menu
// groups correctly: "GLS 350 d"/"GLS450 d"/"GLS 63 AMG" → "GLS", "Q8 50 TDI" → "Q8",
// "Cayenne S Diesel" → "Cayenne", "S90 D5 AWD" → "S90". Keeps genuinely-distinct
// performance models separate (SQ5 ≠ Q5, S5 ≠ A5, RS Q3). Heuristic, validated
// against real DB data — it's a soft hint to the AI, not a hard identity.
function baseModelName(make: string, model: string): string {
  const m = (model || "").trim()
  if (!m) return model
  const mk = make.toLowerCase()
  if (mk.includes("mercedes")) {
    const cls = m.match(/^(glc|gle|gls|gla|glb|glk|eqa|eqb|eqc|eqe|eqs|cla|cls|amg ?gt|maybach)/i)
    if (cls) return cls[1].replace(/\s+/g, " ").toUpperCase()
    const single = m.match(/^([abcegsv])[\s-]?\d{2,3}/i) // "C 220" → "C-Class"
    if (single) return single[1].toUpperCase() + "-Class"
  }
  if (mk.includes("bmw")) {
    // X/Z/i/M lines keep their own identity ("X5", "M5", "iX", "Z4"). Guard the
    // M case so "M340i" (a 3-Series trim) is NOT swallowed as "M3" — only a bare
    // single-digit M-car ("M3", "M5", "M2") qualifies.
    const special = m.match(/^(x\d|z\d|i\d|ix|m\d(?!\d))/i)
    if (special) return special[1].toUpperCase()
    // Numeric series collapse to "<n> Series": the FIRST digit is the series —
    // "520 d xDrive"→5, "320d"→3, "118i"→1 — and the literal "5 Series" form too.
    const series = m.match(/^(\d)\s*series\b/i) || m.match(/^(\d)\d{2}(?!\d)/)
    if (series) return series[1] + " Series"
  }
  // Models whose following token is a TRIM, not a separate AS24 group → first word.
  const trim = m.match(/^(cayenne|macan|panamera|cayman|boxster|taycan|tiguan|touareg|passat|golf|octavia|superb|kodiaq|xc60|xc90|s60|s90|v60|v90)\b/i)
  if (trim) return trim[1][0].toUpperCase() + trim[1].slice(1).toLowerCase()
  // Alphanumeric model code that IS its own model — keep ("Q8", "SQ5", "S5", "RS Q3", "X5", "A6").
  const code = m.match(/^(rs ?q?\d|sq\d|s\d|rs\d|q\d|x\d|[a-z]{1,2}\d{1,3})/i)
  if (code) return code[1].replace(/\s+/g, " ").toUpperCase()
  // Fallback: take 1-2 leading words, dropping engine displacements ("2.0",
  // "1.6", "330") and stopping at the first engine/drivetrain spec token so a
  // noisy "Sportage 1.6 T-GDI" collapses to "Sportage", not "Sportage 1.6".
  const SPEC = /^(t-?gdi|tdi|tfsi|tsi|hdi|dci|cdi|gdi|crdi|bluetec|bluehdi|ecoboost|awd|fwd|rwd|4wd|4matic|xdrive|quattro|hybrid|phev|mhev)$/i
  const toks = m.replace(/\b\d\.\d[a-z]?\b/gi, " ").replace(/\b\d{2,4}\b/g, " ").trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const w of toks) {
    if (SPEC.test(w)) break
    out.push(w)
    if (out.length === 2) break
  }
  const base = (out.join(" ") || toks[0] || "").trim()
  return base ? base.replace(/\b\w/g, c => c.toUpperCase()) : m
}

// Canonicalize a make so a suggestion's make ("Mercedes", "VW") matches the DB's
// stored form ("Mercedes-Benz", "Volkswagen"). Tiny on purpose — only the few
// brands where the AI's shorthand diverges from how the parser stores them.
// Both inventory keys and suggestion keys go through this SAME function so the
// grounding comparison is consistent.
function normMake(make: string): string {
  const m = (make || "").toLowerCase().trim()
  const alias: Record<string, string> = {
    "mercedes": "mercedes-benz", "mercedes benz": "mercedes-benz", "merc": "mercedes-benz",
    "vw": "volkswagen",
    "landrover": "land rover", "range rover": "land rover",
    "alfa": "alfa romeo",
    "chevy": "chevrolet",
  }
  return alias[m] ?? m
}

// Stable grounding key: "<canonical make>|<base model>", both lowercased. Built
// from baseModelName so a noisy DB model ("GLS 350 d") and a clean suggestion
// model_display ("GLS") collapse to the SAME key. This is T3's validation
// primitive — a suggestion whose key is in the real-inventory key set is one we
// KNOW is findable right now (we just parsed it), so the pick resolves.
function groundingKey(make: string, model: string): string {
  let m = (model || "").trim()
  // Strip a duplicated leading make the AI sometimes repeats in model_display
  // ("Kia Sportage" w/ make "Kia" → "Sportage"; "Mercedes GLC" / "Mercedes-Benz
  // GLC" → "GLC"). Without this the key becomes "kia|kia sportage" and never
  // matches the pool's "kia|sportage" → a grounded pick reads as ungrounded and
  // the T4 gate may wrongly drop it. Regex-prefix (not word-array) so it spans
  // hyphenated makes and preserves the rest of the model verbatim (keeps trims
  // like "T-GDI" intact).
  const mkWords = (make || "").toLowerCase().split(/[\s-]+/).filter(Boolean)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  if (mkWords.length) {
    const re = new RegExp(`^(?:(?:${mkWords.join("|")})[\\s-]+)+`, "i")
    m = m.replace(re, "").trim() || m
  }
  return `${normMake(make)}|${baseModelName(make, m).toLowerCase().trim()}`
}

interface InventoryContext {
  text: string
  keys: Set<string>
  // Budget-UNCONSTRAINED real price floor per canonical model key. Powers the
  // global feasibility backstop in POST: an OFF-MENU suggestion the client never
  // named, priced below its real floor, is a generation error and gets dropped.
  floors: Map<string, { n: number; floorTk: number }>
}

async function fetchInventoryContext(prefs: SuggestRequest["preferences"]): Promise<InventoryContext> {
  const empty: InventoryContext = { text: "", keys: new Set(), floors: new Map() }
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    )

    // ── Named-model price facts (UNCONSTRAINED by budget) ────────────────────
    // When the client EXPLICITLY named make+model (prefs.pairs), the budget-
    // windowed menu below can exclude that model entirely if its real market
    // price sits ABOVE the budget-derived EU ceiling. Real case: a Škoda Superb
    // Estate floors at ~€33k turnkey, but a client asking for €25k makes the EU
    // window €12-15k → 0 Superbs in the menu → the AI has no real anchor, guesses
    // a too-low priceRange ("21000-26000"), the card looks feasible, the user
    // approves → the parser search (correctly) finds 0 → confusing red banner.
    // Feed the model's REAL price/year stats so the AI sets budgetFit/overBy/
    // feasibilityWarning honestly upfront instead of under-pricing.
    let namedFactsText = ""
    const namedPairs = (prefs.pairs ?? []).filter(p => p?.make && p?.model)
    if (namedPairs.length > 0) {
      const factLines: string[] = []
      for (const p of namedPairs.slice(0, 4)) {
        let nq = supabase
          .from("cars")
          .select("year, price, body_type")
          .neq("status", "Sold")
          .ilike("make", `%${p.make}%`)
          .ilike("model", `%${p.model}%`)
          .limit(400)
        // Respect the client's chosen body (incl. Unknown/NULL, which many real
        // cars carry) so the floor reflects the variant they actually want.
        if (prefs.body_type) {
          nq = nq.or(`body_type.ilike.%${prefs.body_type}%,body_type.is.null,body_type.eq.Unknown`)
        }
        const { data: nrows } = await nq
        if (!nrows || nrows.length === 0) continue
        const tk = nrows.map(r => Number(r.price)).filter(v => v > 0)
          .map(v => Math.round(v * 1.38 + 4500)).sort((a, b) => a - b)
        if (tk.length === 0) continue
        const years = nrows.map(r => Number(r.year)).filter(v => v > 1990)
        const mid = Math.floor(tk.length / 2)
        const med = tk.length % 2 ? tk[mid] : Math.round((tk[mid - 1] + tk[mid]) / 2)
        const yearStr = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "?"
        factLines.push(
          `• ${p.make} ${p.model}${prefs.body_type ? ` (${prefs.body_type})` : ""} — ${tk.length} шт, ${yearStr}, ` +
          `floor €${tk[0].toLocaleString()} під ключ, медіана €${med.toLocaleString()}, max €${tk[tk.length - 1].toLocaleString()}`,
        )
      }
      if (factLines.length > 0) {
        namedFactsText = `\n\nРЕАЛЬНА РИНКОВА ЦІНА НАЗВАНИХ КЛІЄНТОМ МОДЕЛЕЙ (фактичні спарсені авто, БЕЗ обмеження бюджетом — це ПРАВДА про ціну цієї моделі ЗАРАЗ; звіряй із нею budgetFit/overBy/priceRange. Якщо floor/медіана ВИЩІ за бюджет клієнта — постав budgetFit:"over" + overBy + feasibilityWarning і НЕ занижуй priceRange під бюджет):\n${factLines.join("\n")}`
      }
    }

    // Shared body/segment filter — match the client's chosen kuzov (else purpose
    // kuzovs). INCLUDE Unknown/NULL body cars: many real cars (e.g. SQ5) come
    // back body_type "Unknown" and hard-excluding them empties the pool.
    const bodyFilter = prefs.body_type
      ? [prefs.body_type]
      : (prefs.purpose_body_types ?? [])
    const applyBody = <T extends { or: (f: string) => T }>(q: T): T => {
      if (bodyFilter.length === 0) return q
      const ors = bodyFilter.map(b => `body_type.ilike.%${b}%`)
      ors.push("body_type.is.null", "body_type.eq.Unknown")
      return q.or(ors.join(","))
    }

    // ── Price-floor map (UNCONSTRAINED by budget) — global feasibility backstop ──
    // The AI sometimes invents an OFF-MENU suggestion the client never named and
    // prices it below the real market (the Škoda Superb Combi case: "21-26k"
    // turnkey when the real Estate floor is ~33k). Showing an over-budget card is
    // only legitimate when the CLIENT named the model; an un-named over-budget
    // pick is a generation error → POST drops it. Floor = a low percentile of
    // turnkey price per canonical key (robust to a lone cheap/salvage outlier).
    // Cheapest-first ordering means truncation drops only the priciest rows, so
    // the floor of any near-budget model is captured.
    const floors = new Map<string, { n: number; floorTk: number }>()
    try {
      let fq = supabase
        .from("cars")
        .select("make, model, price")
        .neq("status", "Sold")
        .gt("price", 0)
        .order("price", { ascending: true })
        .limit(4000)
      if (prefs.year_from) fq = fq.gte("year", prefs.year_from)
      if (prefs.year_to)   fq = fq.lte("year", prefs.year_to)
      if (prefs.fuel)      fq = fq.ilike("fuel", `%${prefs.fuel}%`)
      fq = applyBody(fq)
      const { data: frows } = await fq
      if (frows) {
        const byKey = new Map<string, number[]>()
        for (const c of frows) {
          const k = groundingKey(c.make, c.model)
          const arr = byKey.get(k) ?? []
          arr.push(Number(c.price))
          byKey.set(k, arr)
        }
        for (const [k, prices] of byKey) {
          prices.sort((a, b) => a - b)
          const idx = Math.min(prices.length - 1, Math.max(1, Math.floor(prices.length * 0.1)))
          floors.set(k, { n: prices.length, floorTk: Math.round(prices[idx] * 1.38 + 4500) })
        }
      }
    } catch { /* floors stay empty → backstop simply doesn't fire */ }

    // Build a REAL candidate menu from our own parse history. NOTE: parsed
    // market cars are stored with status "Available" (not "In Stock") — the old
    // `eq("status","In Stock")` matched ~0 rows, so the AI got no grounding and
    // suggested purely from memory.
    // Sample broadly (1200, not 300): at 300-most-recent a single bulk harvest
    // (e.g. a recent Audi sweep) dominated the pool and the menu came back
    // mono-brand, while genuinely common models fell off and read as ungrounded.
    let query = supabase
      .from("cars")
      .select("make, model, year, price, body_type, fuel")
      .neq("status", "Sold")
      .order("parsed_at", { ascending: false })
      .limit(1200)

    if (prefs.budget_min) query = query.gte("price", Math.round(prefs.budget_min / 1.38 - 4500))
    if (prefs.budget_max) query = query.lte("price", Math.round(prefs.budget_max / 1.38 - 3000))
    if (prefs.year_from)  query = query.gte("year", prefs.year_from)
    if (prefs.year_to)    query = query.lte("year", prefs.year_to)
    if (prefs.fuel)       query = query.ilike("fuel", `%${prefs.fuel}%`)
    query = applyBody(query)

    const { data } = await query
    // Even with an empty budget-windowed menu, still surface named-model price
    // facts — that's exactly the over-budget case they exist to explain.
    if (!data || data.length === 0) {
      return namedFactsText ? { text: namedFactsText.trimStart(), keys: new Set(), floors } : { ...empty, floors }
    }

    // Group by make+model → count, year range, turnkey price range. Rank by
    // count (most-available models are the safest, most-findable candidates).
    // Also remember the canonical grounding key per group so suggestions can be
    // validated against what's genuinely in stock (T3).
    const grouped = new Map<string, { years: number[]; prices: number[]; body: string; n: number; gkey: string }>()
    for (const c of data) {
      const key = `${c.make} ${baseModelName(c.make, c.model)}`
      const entry = grouped.get(key) ?? { years: [] as number[], prices: [] as number[], body: c.body_type ?? "", n: 0, gkey: groundingKey(c.make, c.model) }
      entry.n++
      if (c.year)  entry.years.push(Number(c.year))
      if (c.price) entry.prices.push(Number(c.price))
      grouped.set(key, entry)
    }

    // Median is more representative than min/max (outliers — a salvage car or a
    // loaded top-spec — don't skew it). Round to €500 for a clean anchor.
    const median = (arr: number[]): number => {
      const s = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      const v = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
      return Math.round(v / 500) * 500
    }

    const ranked = [...grouped.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25)
    const lines = ranked.map(([name, { years, prices, body, n }]) => {
      const yearStr = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "?"
      // Convert EU price → turnkey so the menu speaks the client's language.
      const tk = prices.map(p => Math.round(p * 1.38 + 4500))
      const priceStr = tk.length
        ? `медіана €${median(tk).toLocaleString()} під ключ (€${Math.min(...tk).toLocaleString()}-€${Math.max(...tk).toLocaleString()})`
        : "?"
      return `• ${name} — ${n} шт, ${yearStr}, ${priceStr}${body ? ", " + body : ""}`
    })

    // Grounding keys: EVERY real group (not just the top-25 shown) — a pick is
    // "grounded" if it matches anything we actually have in stock.
    const keys = new Set<string>([...grouped.values()].map(g => g.gkey))

    const text = `РЕАЛЬНЕ МЕНЮ КАНДИДАТІВ (фактично спарсені авто, що ЗАРАЗ є на ринку ЄС за параметрами клієнта; "шт" = скільки в наявності; "медіана" = типова turnkey-ціна цієї моделі ЗАРАЗ — бери ЇЇ за основу priceRange, а не оцінку з памʼяті):\n${lines.join("\n")}`
    return { text: text + namedFactsText, keys, floors }
  } catch {
    return empty
  }
}

// T9 learning loop: which models clients actually picked recently → a gentle
// popularity signal for the AI. Reads picker_events (kind=suggestion_approved),
// last 30 days. Fully defensive: returns "" if the table is absent or empty, so
// the picker behaves exactly as before until signals accumulate.
async function fetchPopularModels(): Promise<string> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) return ""
    const supabase = createClient(url, key)
    const since = new Date(Date.now() - 30 * 864e5).toISOString()
    const { data } = await supabase
      .from("picker_events")
      .select("make, model")
      .eq("kind", "suggestion_approved")
      .gte("ts", since)
      .limit(2000)
    if (!data || data.length === 0) return ""

    const counts = new Map<string, number>()
    for (const e of data) {
      if (!e.make || !e.model) continue
      const k = `${String(e.make).trim()} ${String(e.model).trim()}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const top = [...counts.entries()]
      .filter(([, c]) => c >= 2) // ignore one-offs (noise)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    if (top.length === 0) return ""
    return `ПОПУЛЯРНЕ В НАШИХ КЛІЄНТІВ (найчастіше обирають за останній місяць — хороший орієнтир за інших рівних, але НЕ нав'язуй усупереч параметрам клієнта): ${top.map(([k, c]) => `${k} (×${c})`).join(", ")}`
  } catch {
    return ""
  }
}

// ── Streaming JSON suggestion parser ─────────────────────────────────────────
// Parses complete JSON objects from a streaming buffer like "[{...},{...},..."
// Returns completed objects and the remaining unparsed buffer.

function extractCompleteSuggestions(
  text: string,
): { complete: any[]; remaining: string } {
  const complete: any[] = []
  let t = text.trim()
  if (t.startsWith("[")) t = t.slice(1)

  while (true) {
    t = t.trim()
    if (!t || t.startsWith("]")) break
    if (t.startsWith(",")) { t = t.slice(1).trim(); continue }
    if (!t.startsWith("{")) break

    // Find end of this JSON object (respecting nested structures and strings)
    let depth = 0
    let end = -1
    let inString = false
    let escape = false

    for (let i = 0; i < t.length; i++) {
      const c = t[i]
      if (escape) { escape = false; continue }
      if (c === "\\") { escape = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) { end = i; break }
      }
    }

    if (end === -1) break // object not yet complete

    try {
      complete.push(JSON.parse(t.slice(0, end + 1)))
      t = t.slice(end + 1)
    } catch {
      break
    }
  }

  return { complete, remaining: t }
}

// ── Map raw Claude suggestion → normalized CarSuggestion ─────────────────────

// Year a brand actually started selling in the EUROPEAN market. We import from
// the EU, so a brand/model that didn't exist there yields 0 parser results no
// matter what the AI claims.
const EU_LAUNCH_YEAR: Record<string, number> = {
  genesis: 2021,
  polestar: 2020,
  byd: 2023,
  nio: 2022,
}

// Deterministic safety net (prompt isn't 100% reliable): drop a mapped
// suggestion that can never parse — an inverted/empty year range, or a brand
// whose EU availability doesn't reach the requested upper year.
function isUsableSuggestion(s: any): boolean {
  const sp = s?.searchParams ?? {}
  const yf = typeof sp.year_from === "number" ? sp.year_from : null
  const yt = typeof sp.year_to === "number" ? sp.year_to : null
  if (yf != null && yt != null && yf > yt) return false // inverted/empty range
  const launch = EU_LAUNCH_YEAR[String(sp.make ?? s?.make ?? "").toLowerCase()]
  if (launch != null && yt != null && yt < launch) return false // brand not in EU for those years
  return true
}

function mapRawSuggestion(
  raw: any,
  prefs: SuggestRequest["preferences"],
): object {
  let modelDisplay: string = raw.model_display ?? raw.model ?? ""
  const make: string = raw.make ?? ""
  if (modelDisplay.toLowerCase().startsWith(make.toLowerCase())) {
    modelDisplay = modelDisplay.slice(make.length).trim()
  }

  const parseYearRange = (s: string) => {
    const parts = String(s ?? "").split("-")
    return {
      from: (() => { const v = parseInt(parts[0]?.replace(/\D/g, "")); return !isNaN(v) && v > 1990 ? v : null })(),
      to:   (() => { const v = parseInt(parts[1]?.replace(/\D/g, "") ?? ""); return !isNaN(v) && v > 1990 ? v : null })(),
    }
  }
  const parsePriceRange = (s: string) => {
    const parts = String(s ?? "").split("-")
    return {
      min: (() => { const v = parseInt(parts[0]?.replace(/\D/g, "")); return !isNaN(v) && v > 0 ? v : null })(),
      max: (() => { const v = parseInt(parts[1]?.replace(/\D/g, "") ?? ""); return !isNaN(v) && v > 0 ? v : null })(),
    }
  }

  const yr = parseYearRange(raw.yearRange ?? "")
  const pr = parsePriceRange(raw.priceRange ?? "")

  // Normalize new honesty fields (from updated system prompt).
  // budgetFit: "fits" | "tight" | "over" — visual badge on the suggestion card.
  // overBy: EUR amount over user's budget (only meaningful when budgetFit="over").
  // feasibilityWarning: explanation when user's constraints are unsatisfiable.
  const budgetFit: "fits" | "tight" | "over" =
    raw.budgetFit === "over" ? "over"
    : raw.budgetFit === "tight" ? "tight"
    : "fits"
  const overBy = typeof raw.overBy === "number" && raw.overBy > 0 ? Math.round(raw.overBy) : 0
  const feasibilityWarning = typeof raw.feasibilityWarning === "string" && raw.feasibilityWarning.trim()
    ? raw.feasibilityWarning.trim()
    : null

  return {
    make,
    model: modelDisplay,
    yearRange: raw.yearRange ?? "",
    priceRange: raw.priceRange ?? "",
    whyRecommended: raw.whyRecommended ?? "",
    concerns: raw.concerns ?? "",
    budgetFit,
    overBy,
    feasibilityWarning,
    searchParams: {
      make,
      model: raw.model_search ?? raw.model ?? "",
      year_from:  yr.from ?? prefs.year_from ?? 2018,
      year_to:    yr.to   ?? prefs.year_to   ?? undefined,
      budget_min: pr.min  ?? prefs.budget_min ?? 20000,
      budget_max: pr.max  ?? prefs.budget_max ?? undefined,
      fuel:         prefs.fuel         || undefined,
      transmission: prefs.transmission || undefined,
      body_type:    prefs.body_type    || undefined,
      drive:        prefs.drive        || undefined,
    },
  }
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseEvent(encoder: TextEncoder, payload: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const { tryAcquire, clientKey } = await import("@/lib/rate-limit")
  const rl = tryAcquire(`ai-suggest:${clientKey(req)}`, 15)
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ type: "error", message: "Забагато запитів. Спробуйте через кілька секунд." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.resetIn) } },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(sseEvent(encoder, { type: "fallback", fallback: "ai_unavailable", message: "AI недоступний." }))
        c.close()
      },
    })
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } })
  }

  let body: SuggestRequest
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ type: "error", message: "Невалідний запит." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  const prefs = body.preferences ?? {}

  // ── Build user-facing preferences description ─────────────────────────────
  const prefsDesc: string[] = []
  if (prefs.budget_min || prefs.budget_max) {
    prefsDesc.push(
      `Бюджет клієнта ПІД КЛЮЧ: ${prefs.budget_min ?? "?"} - ${prefs.budget_max ?? "?"} EUR ` +
      `(фінальна ціна в Україні з митом, доставкою, реєстрацією). ` +
      `ВСІ пропозиції МУСЯТЬ вміщуватись у цей бюджет — priceRange в turnkey.`,
    )
  }
  if (prefs.fuel)         prefsDesc.push(`Паливо: ${prefs.fuel}`)
  if (prefs.body_type) {
    // Body types form has TWO distinct pickup-ish options that map to different
    // markets: "Пікап" → Pickup (personal pickups: Ranger, F-150, Hilux, Amarok)
    // and "Вантажівка" → Truck (commercial freight: Sprinter, Iveco Daily,
    // MAN TGE, Renault Master). The AI must respect this distinction or it
    // suggests a Ranger to someone who picked Truck and the strict parser
    // filter (pickup ≠ truck) drops every car. Spell out the rule explicitly.
    let bodyHint = `Кузов: ${prefs.body_type}`
    if (prefs.body_type === "Truck") {
      bodyHint += ` — це КОМЕРЦІЙНІ вантажівки/фургони (Sprinter, Iveco Daily, MAN TGE, Renault Master, VW Crafter, Ford Transit). НЕ пропонуй пікапи (Ranger, F-150, Hilux, Amarok) — у клієнта окремо є опція "Пікап".`
    } else if (prefs.body_type === "Pickup") {
      bodyHint += ` — це особисті пікапи (Ranger, F-150, Hilux, Amarok, Navara, L200). НЕ пропонуй комерційні фургони (Sprinter, Transit, Iveco) — у клієнта окремо є опція "Вантажівка".`
    }
    prefsDesc.push(bodyHint)
  }
  if (prefs.year_from)    prefsDesc.push(`Рік від: ${prefs.year_from}`)
  if (prefs.year_to)      prefsDesc.push(`Рік до: ${prefs.year_to}`)
  if (prefs.transmission) prefsDesc.push(`КПП: ${prefs.transmission}`)
  if (prefs.drive)        prefsDesc.push(`Привід: ${prefs.drive}`)
  if (prefs.hp_min)       prefsDesc.push(`Мін. к.с.: ${prefs.hp_min}`)
  if (prefs.seats_min)    prefsDesc.push(`Мін. місць: ${prefs.seats_min}`)
  if (prefs.displacement_min) prefsDesc.push(`Об'єм від: ${prefs.displacement_min}л`)
  if (prefs.purpose_body_types?.length) prefsDesc.push(`Ціль (кузови): ${prefs.purpose_body_types.join(", ")}`)
  if (prefs.pairs?.length) {
    const validPairs = prefs.pairs.filter(p => p.make)
    const pairsDesc = validPairs.map(p => `${p.make}${p.model ? " " + p.model : ""}`).join(", ")
    if (pairsDesc) {
      prefsDesc.push(
        `КЛІЄНТ ЯВНО ОБРАВ ЦІ МОДЕЛІ — ВОНИ МУСЯТЬ БУТИ В ПРОПОЗИЦІЯХ: ${pairsDesc}. ` +
        (validPairs.length === 1
          ? `Перша пропозиція = саме ${pairsDesc}. Дві інші — найближчі альтернативи того ж класу/сегменту.`
          : `Усі пропозиції — з цього списку.`),
      )
    }
  }

  const purposes = body.answers?.find(a => a.questionId === "purpose")?.selected ?? []
  if (purposes.length) prefsDesc.push(`Ціль: ${purposes.join(", ")}`)

  const systemPrompt = `Ти — старший менеджер Fresh Auto, 15+ років на ринку імпорту авто з Німеччини/Швеції/Нідерландів. Знаєш моделі 2015-2026: реальні комплектації двигунів, які об'єми/палива доступні на якому поколінні, типові ринкові ціни, надійність.

═══ АБСОЛЮТНІ ПРАВИЛА ЧЕСНОСТІ (НІКОЛИ не порушуй) ═══

1. **ВИКОРИСТОВУЙ СВОЇ ЗНАННЯ ПРО РЕАЛЬНИЙ РИНОК:**
   Ти знаєш типові ціни на autoscout24/mobile.de для кожної моделі та року з власних тренувальних даних. Користуйся ними напряму.

   priceRange = реальний turnkey-діапазон для типового стану (медіана ринку): нижня межа = типовий floor авто з нормальним пробігом, верхня межа = типовий well-equipped варіант. Формула: turnkey = EU × 1.38 + €4500.

   ВАЖЛИВО для дорогих/перформанс-моделей (X5 M, AMG, RS, Cayenne Turbo, M5 тощо), коли клієнт НЕ вказав бюджет: priceRange має охоплювати РЕАЛЬНИЙ ВЖИВАНИЙ ринок ЄС — включно зі СТАРІШИМИ поколіннями, які реально купують. НЕ квоти лише ціну найновішого покоління. Нижня межа = типове доступне вживане авто цієї моделі (старше покоління/більший пробіг), а не ціна майже нового. Напр. BMW X5 M: вживані від ~€90k під ключ (F85 2015-2018), а не 180k+ (лише нова F95).

   НЕ занижуй ціни щоб вписатись у бюджет клієнта. Краще чесно показати реальний діапазон і дати клієнту вирішити.

2. **budgetFit ВИКОРИСТОВУЙ ТІЛЬКИ КОЛИ КЛІЄНТ ВКАЗАВ БЮДЖЕТ:**
   • Бюджет не вказаний клієнтом → завжди budgetFit:"fits", overBy:0, feasibilityWarning:null. Ніяких "над бюджетом" — нема з чим порівнювати.
   • Бюджет вказаний і реальний priceRange.min > user.budget_max → budgetFit:"over", overBy=(priceRange.min - user.budget_max), feasibilityWarning пояснює різницю та пропонує альтернативи.
   • Бюджет вказаний і priceRange.max в межах user.budget_max ±10% → "tight".
   • Інакше → "fits".

2. **НЕ ВИГАДУВАТИ КОМПЛЕКТАЦІЇ — ДВИГУН ЦЕ HARD CONSTRAINT.** Якщо клієнт указав displacement_min, ПЕРЕД генерацією кожної пропозиції перевір чи реально існує мотор цього об'єму у цій моделі у вказаних роках. Якщо НЕ існує — НЕ ПРОПОНУЙ.

   **Якщо клієнт хоче ≥3.0 літра:**
   • Volvo — ВСЯ модельна лінійка з 2014 максимум 2.0 (Drive-E platform). НЕ пропонуй жодну Volvo для 3.0L+ запиту.
   • Mazda — після 2018 тільки 2.0/2.5 SkyActiv. CX-60 має 3.3 PHEV (один варіант).
   • Mercedes — є 3.0 (E 400d, S 400d, GLE 400d, AMG GT, S 580). C-Klasse після 2021 тільки 2.0.
   • BMW — є 3.0 (30d, 40d, 40i, M340i, M40i, X5/X6/X7 40i, M3, M5 — V8 у поточному, S58 турбо у М3/M4).
   • Audi — є 3.0 TDI/TFSI (Q5/Q7/Q8/A6/A7/A8 40/50/55 TDI, SQ7/SQ8). RS варіанти 4.0 V8 biturbo.
   • Porsche — 3.0+ скрізь (Macan S/GTS, Cayenne S/GTS, Panamera 4S, 911).
   • Toyota — Land Cruiser 3.5 V6, Hilux 2.8 (макс — не 3.0).
   • Lexus — RX/LX/LS 3.5 V6 / 5.0 V8.
   • Land Rover/Range Rover — 3.0 D300/I6, 4.4 V8.

   **Якщо клієнт хоче 2.0-3.0:** більшість виробників мають варіанти.

   Краще чесно вкажи у feasibilityWarning що такого варіанта не існує і запропонуй або іншу марку, або послабити фільтр об'єму.

3. **НЕ ПІДБИРАТИ ПІД ПАРАМЕТРИ ЯКЩО НЕРЕАЛЬНО.** Якщо параметри клієнта неможливо задовольнити (наприклад, "Porsche 718 Cayman до €23k turnkey" — реально €55k+), не вигадуй модель щоб обманом вкластись. Поверни feasibilityWarning у першій пропозиції.

═══ ФОРМАТ ВИВОДУ ═══

Поля кожної пропозиції:
- make, model_display, model_search, yearRange, priceRange (ТУRNKEY EUR), whyRecommended, concerns, confidence
- **budgetFit**: "fits" | "tight" | "over"
  • "fits" — реальна turnkey-ціна на ≥10% нижче верхньої межі бюджету
  • "tight" — на межі (в межах ±10% бюджету)
  • "over" — реальна ціна перевищує бюджет
- **overBy** (EUR, 0 якщо не "over"): на скільки реальна turnkey-ціна перевищує бюджет клієнта
- **feasibilityWarning** (string | null): попередження якщо параметри клієнта не реалістичні. Якщо все OK → null. Якщо проблема (об'єм/паливо/комплектація не існує, бюджет надто низький) → коротке пояснення (1-2 речення).

═══ ОБОВ'ЯЗКОВІ ПРАВИЛА ═══

A. Ціни ТІЛЬКИ в EUR і ТІЛЬКИ "під ключ". Формула: turnkey = EU × 1.38 + 4500.
B. РІВНО 3 моделі, мінімум 2 різні марки.
C. model_display БЕЗ префіксу марки. Правильно: "3 Series Touring", не "BMW 3 Series Touring".
D. У whyRecommended ціни завжди як "€X під ключ".
E. Якщо є дані про наявність у стоці — пріоритизуй моделі, які там є.

═══ СТРАТЕГІЯ ВИБОРУ ПРОПОЗИЦІЙ ═══

• Якщо параметри РЕАЛІСТИЧНІ і бюджет вкладається — 3 моделі що ВСІ "fits"/"tight", без "over".
• Якщо клієнт назвав КОНКРЕТНУ марку+модель але бюджет недостатній — перша пропозиція = саме та модель з ЧЕСНОЮ ціною і budgetFit:"over" + overBy. Інші 2 = реальні альтернативи в бюджеті ("fits").
• Якщо параметри НЕРЕАЛІСТИЧНІ (не існує комбінації об'єму/палива/моделі/року) — перша пропозиція = найближча реальна альтернатива з feasibilityWarning що пояснює проблему. Інші 2 = додаткові реальні варіанти.

КЛЮЧОВИЙ ПРИНЦИП: ТРИМАЙСЯ ВИБІРКИ З РЕАЛЬНИМИ ВАРІАНТАМИ.
Не пропонуй "Mercedes E-Class 2018-2020 за €50-55k" якщо знаєш що в Європі ринок цих років в цьому бюджеті — 0-2 авто.

═══ СПОРТИВНИЙ ЗАПИТ — ТІЛЬКИ СПРАВЖНІЙ СПОРТ + ВІДПОВІДНИЙ КЛАС БЮДЖЕТУ ═══

Якщо клієнт хоче СПОРТИВНЕ/драйверське авто (слова "спортивне", "sporty", "драйв", "потужне", ціль "спорт") — пропонуй ТІЛЬКИ реально перформанс-моделі, НЕ базові/комфортні версії:
• Перформанс-лінійки: Audi S/RS (S3/S4/S5/RS3), BMW M/M-Performance (M2/M240i/M340i/M3/M4), Mercedes-AMG (A35/A45/C43/CLA45), VW Golf GTI/R, Hyundai N (i30 N/i20 N), Cupra (Leon/Formentor), Honda Type R, Toyota GR (Supra/GR86/Yaris), Porsche (Cayman/Boxster/718), Ford ST/RS, Renault RS.
• НЕ пропонуй базову некомплектну версію як «спортивну» (звичайний Hyundai i30, базовий Golf, A3 1.0 — це НЕ спорт). Базовий хетч ≠ спорт.

ВІДПОВІДНІСТЬ БЮДЖЕТУ: підбирай авто, що ВИКОРИСТОВУЄ бюджет, а не сильно дешевше. Для спорт-бюджету €45k не пропонуй €30k хот-хетч (i30 N), коли в цей бюджет реально вкладаються сильніші: Audi S4/S5, BMW M240i/M340i, Golf R, AMG A45/CLA45, Audi TTS.

ГОЛОВНЕ ДЖЕРЕЛО — МЕНЮ: спочатку шукай перформанс-моделі в МЕНЮ КАНДИДАТІВ (вони реально є на ринку ЗАРАЗ). НЕ називай рідкісну спорт-модель з памʼяті (Porsche Cayman/718, Toyota Supra, Audi TTS тощо), якщо її НЕМАЄ в меню — її майже напевно не знайдеться, і клієнт отримає 0. Якщо в меню в цьому бюджеті немає жодної справді спортивної моделі — НЕ вигадуй і НЕ підставляй позашляховик/комфорт-седан як «спорт»: чесно дай те зі спортивного, що найреальніше, і познач у concerns, що вибір спортивного в цьому бюджеті зараз обмежений. Дешевший варіант доречний ЛИШЕ якщо клієнт явно просив зекономити.

═══ yearRange = РОКИ МОДЕЛЬНОГО ПОКОЛІННЯ ═══

yearRange має відповідати РЕАЛЬНИМ рокам конкретного покоління моделі (ти знаєш межі поколінь з тренувальних даних), а не "до якого року вписується бюджет".

Алгоритм:
1. Визнач покоління моделі, яке найкраще підходить запиту.
2. yearRange = перетин меж покоління з обмеженнями клієнта:
   • yearFrom = max(generation.start, user.year_from)
   • yearTo = min(generation.end, user.year_to)
3. НЕ ЗМІШУЙ два покоління в одному yearRange (наприклад "2017-2022" для BMW 3 Series міксує F30 і G20 — невірно). yearRange має лежати в межах ОДНОГО покоління.

Приклади:
• Skoda Octavia A7 (2013-2020): клієнт без year-обмежень → "2013-2020". Клієнт year_from=2015 → "2015-2020".
• BMW 3 Series F30 (2012-2019): клієнт year_to=2017 → "2012-2017". Клієнт year_from=2014 → "2014-2019".
• Audi A6 C8 (2018-2026): клієнт без обмежень → "2018-2026". Клієнт year_from=2020 → "2020-2026".
• Volvo XC90 II (2015-2026): без обмежень → "2015-2026".

ВИБІР ПОКОЛІННЯ коли модель має кілька актуальних:
• Клієнт year_from=2018, а є і Audi A6 C7 (2011-2018), і C8 (2018-2026) → бери C8 (новіше тяжіння при year_from).
• Клієнт year_to=2015 → бери старіше покоління.
• Клієнт без year-обмежень → бери покоління що ВКЛАДАЄТЬСЯ у бюджет (для €30k turnkey преміуму F30 реальніше за G20).

═══ ДОСТУПНІСТЬ НА ЄВРОПЕЙСЬКОМУ РИНКУ (КРИТИЧНО — інакше парсер знайде 0) ═══

Модель і yearRange мають існувати на ЄВРОПЕЙСЬКОМУ вторинному ринку у вказані роки — НЕ глобально (US/Korea/Asia не рахуються, ми возимо з ЄС). Деякі марки вийшли в Європу пізно:
• Genesis — продається в Європі ЛИШЕ з ~2021 (G80/G70/GV70/GV80). G80 2016-2020 існує в Кореї/США, але НЕ в ЄС.
• Інші «молоді в ЄС» бренди (BYD, Nio, відроджений MG, Polestar з 2020) — лише останні роки.

ЖОРСТКЕ ПРАВИЛО (перевизначає інструкцію «показати з feasibilityWarning»):
1. Якщо роки доступності марки в ЄС НЕ перетинаються з year-вікном клієнта — ПОВНІСТЮ ВИКИНЬ цю марку зі списку. НЕ показуй її навіть із попередженням. Заміни її іншою РЕАЛЬНОЮ альтернативою. (Genesis при year_to=2020 → взагалі не пропонуй Genesis, бо в ЄС його там 0.)
2. yearRange ЗАВЖДИ має бути валідним: yearFrom ≤ yearTo. НІКОЛИ не виводь інвертований діапазон типу "2021-2020" — якщо після застосування обмежень yearFrom вийшов більший за yearTo, діапазон ПОРОЖНІЙ → ця модель НЕ підходить → викинь її і візьми іншу.
Краще релевантна марка з реальними авто, ніж «правильна на папері», якої немає на ринку ЄС.

═══ ВАРІАТИВНІСТЬ — НЕ ПОВТОРЮЙ ТИПОВІ ПАРИ ═══

Канонічні «очевидні» пари по сегментах (їх легко вгадати з тренувальних даних):
• Молодіжне спортивне: Golf GTI + Civic Type R + Toyota GR86/Yaris
• Сімейне €30-40k: Skoda Octavia + VW Passat + Toyota Corolla
• Преміум €40-60k: BMW 5er + Mercedes E-Class + Audi A6
• SUV сімейне: Skoda Kodiaq + Hyundai Tucson + Toyota RAV4
• Compact €15-25k: Skoda Fabia + VW Polo + Hyundai i20
• Бізнес-седан: BMW 5er + Mercedes E + Audi A6 (та сама трійка для будь-якого «бізнес»)

ПРАВИЛО (жорстке): **МІНІМУМ 2 з 3 пропозицій мають бути НЕ-канонічними** для цього сегменту. Сінглова канонічна пропозиція — окей як «безпечний дефолт», але інші 2 — обов'язково з-поза очевидних.

Альтернативи замість канонічних (приклади заміни):
• замість Civic Type R → MINI JCW, Hyundai i30 N, Ford Focus ST, Renault Megane RS, Cupra Leon
• замість Skoda Octavia → Mazda 6, Volvo V40/V60, Kia Ceed/ProCeed, Seat Leon, Peugeot 508
• замість BMW 5er / Mercedes E → Volvo S90/V90, Lexus ES/IS, Kia Stinger, Genesis G70/G80 (ТІЛЬКИ для year ≥2021 — раніше в ЄС не продавався)
• замість Skoda Kodiaq → Mazda CX-5, Subaru Forester, Volvo XC60, Lexus NX, Ford Kuga
• замість VW Polo → Renault Clio, Mazda 2, Seat Ibiza, Peugeot 208

ВИБІР НЕ-канонічного варіанту обґрунтовуй конкретно (а не «теж непогана»): рідкісніший на ринку = менше падає в ціні; нижчий пробіг по сегменту; недооцінений за надійністю; нюанс комплектації що зустрічається саме тут.

ПЕРЕВІРКА ПЕРЕД ВИВОДОМ: коли вже згенерував 3 пропозиції — перерахуй, чи всі 3 НЕ з очевидної канонічної трійки. Якщо так — заміни одну на не-канонічну.

whyRecommended (РІВНО 2 короткі речення, ~25 слів кожне): одне про конкретну характеристику+перевагу, друге про репутацію (ADAC/Euro NCAP/J.D. Power) АБО ринок України.
concerns (1 коротке речення, мʼяко): загальний нюанс класу. Без сум ремонтів, без кодів моторів, без слів "проблема/ремонт/ризик".
model_search = назва моделі lowercase, БЕЗ префіксу марки, БЕЗ маркера покоління (B8, B9, F30, G20, W213, E46, C8 тощо — це КОДИ платформ, а не модель). Приклади: "Audi A7" → "a7"; "BMW 3 Series Touring" → "3er"; "Mercedes C-Class" → "c-klasse"; "Volvo V60" → "v60"; "VW Passat B9" → "passat"; "BMW X5 G05" → "x5". Підбирай ВИКЛЮЧНО код базової моделі — покоління визначається через yearRange.

КУЗОВНІ ВАРІАНТИ (3 Door, 5 Door, Estate, Touring, Avant, Sportback, Coupé, Convertible). НЕ пиши їх у model_search — це body_type, не модель:
• "MINI Cooper 3 Door" → model_search="cooper" (body_type обирається окремо як Hatchback)
• "MINI Cooper 5 Door" → model_search="cooper"
• "Audi A4 Avant" → model_search="a4"
• "BMW 3 Series Touring" → model_search="3er" (виняток: AS24 розрізняє Touring окремою категорією, проте slug "3er" повертає й Touring — фільтр body_type=Estate далі звузить)

ВИНЯТОК — ПЕРФОРМАНС-ВАРІАНТИ (AMG / M / RS / S-line / GT). Тут цифра після літери — це trim, не покоління. Зберігай повну назву:
• "Mercedes E63 AMG" → model_search="e 63" (НЕ "e-klasse" — клієнт хоче конкретно AMG-версію)
• "Mercedes C63 AMG" → model_search="c 63"
• "BMW M5" → model_search="m5"
• "BMW M3 Competition" → model_search="m3"
• "Audi RS6" → model_search="rs6"
• "Audi S3" → model_search="s3"
• "VW Golf R" → model_search="golf r"
Якщо клієнт назвав AMG/M/RS — пропонуй ці моделі з повним trim. Базовий клас (E-Klasse, 5er) — для не-перформанс запитів.

Поверни ТІЛЬКИ JSON-масив з РІВНО 3 об'єктами (без markdown, без тексту до/після):
[{"make":"BMW","model_display":"X5","model_search":"x5","yearRange":"2019-2020","priceRange":"44000-50000","whyRecommended":"...","concerns":"...","confidence":"high","budgetFit":"over","overBy":7000,"feasibilityWarning":null}]`

  const freeTextBlock = body.freeText?.trim()
    ? `\n\nВІЛЬНИЙ ОПИС КЛІЄНТА (ГОЛОВНЕ джерело — переважає над структурованими параметрами): "${body.freeText.trim()}"

ОБРОБКА ВІЛЬНОГО ОПИСУ:
• ЯКЩО клієнт назвав конкретну марку+модель (напр. "Audi A7", "BMW X5", "Volvo V60") — це ЖОРСТКА ВИМОГА. ПЕРША пропозиція = саме ця модель (підбери відповідне покоління/рік під бюджет). Інші 2 — прямі конкуренти ТОГО Ж КУЗОВА І КЛАСУ, а не випадкові авто з меню. Приклади: BMW X5 → Audi Q7 / Mercedes GLE / Porsche Cayenne / Volvo XC90 (великі преміум-SUV); Audi A7 → Mercedes CLS / BMW 6 Gran Coupé; Volvo V60 → Audi A4 Avant / BMW 3 Touring. НІКОЛИ не давай як альтернативу авто іншого кузова/сегмента (седан замість SUV, хетч замість універсала тощо) — навіть якщо воно є в меню.
• МАСОВИЙ ВАРІАНТ за замовчуванням: якщо клієнт назвав модель БЕЗ кузова/покоління — бери НАЙПОШИРЕНІШЕ на ринку ЄС тіло й покоління, а НЕ рідкісний/найновіший варіант. Напр. "BMW M5" → седан F90 (2018+, їх сотні), а НЕ Touring F91 2022+ (одиниці); "RS6" → Avant (звичайний кузов цієї моделі); "M3" → седан/купе, а не рідкісний. Рідкісний кузов/покоління — лише якщо клієнт його явно назвав ("M5 Touring", "універсал"). Вузький рідкісний варіант = майже завжди 0-1 результат.
• ЯКЩО названа тільки марка (напр. "Audi") без моделі — всі 3 пропозиції = моделі цієї марки.
• Витягни з тексту: рік ("свіжа" = 2022-2025; "не старе" = 2020+), бюджет ("до 30к", "20-25"), кузов, об'єм, паливо, комплектацію.
• Слова на кшталт "свіжа/нова/freshe" = пріоритет на роки 2022-2025 у межах бюджету.`
    : ""

  // Fetch inventory context + popularity signal in parallel with prompt building
  const inventoryContextPromise = fetchInventoryContext(prefs)
  const popularPromise = fetchPopularModels()

  const { text: inventoryContext, keys: inventoryKeys, floors: inventoryFloors } = await inventoryContextPromise
  const popularBlock = await popularPromise
  const inventoryBlock = inventoryContext
    ? `\n\n${inventoryContext}

ЯК КОРИСТУВАТИСЯ МЕНЮ КАНДИДАТІВ (важливо):
• Це ФАКТИЧНО наявні зараз авто за параметрами клієнта — не вигадані. ПРІОРИТЕТНО обирай пропозиції З ЦЬОГО МЕНЮ: так клієнт точно знайде те, що ти порадиш.
• Моделі з більшою кількістю "шт" — надійніший вибір (реально є з чого вибрати). Ціни/роки в меню РЕАЛЬНІ — звіряй з ними свій priceRange замість оцінок з памʼяті.
• ЛІКВІДНІСТЬ: уникай моделей з дуже малою наявністю (1-3 "шт") — клієнту мало реального вибору і складно знайти потрібну комплектацію. Не роби їх пропозицією, якщо є відповідні моделі того ж класу з більшою кількістю "шт". (Виняток — клієнт сам назвав саме цю модель.)
• Можеш додати 1 пропозицію ПОЗА меню ТІЛЬКИ якщо вона явно краще пасує запиту і ти впевнений, що вона є на ринку ЄС у цьому бюджеті. Решта — з меню.
• Якщо меню тонке/порожнє (рідкісний сегмент) — тоді користуйся знаннями ринку як зазвичай, але чесно.`
    : ""

  // When budget is missing, DO NOT force a synthetic 20-40k EUR range — that
  // makes Claude pick unrealistic prices for premium suggestions (e.g. Porsche
  // 718 Cayman at €23k turnkey, which the model itself acknowledges as
  // "практично нереальна комбінація"). Instead, let Claude propose prices
  // anchored to actual market rates for the cars it recommends.
  const hasBudget = !!(prefs.budget_min || prefs.budget_max)
  const prefsBlock = prefsDesc.join("\n") ||
    "Не вказані. Запропонуй 3 моделі різного класу та користуйся СВОЇМИ знаннями про реальний ринок — priceRange має відповідати справжнім turnkey-цінам моделей, які ти пропонуєш (НЕ занижуй під уявний бюджет)."

  const userMessage =
    `Параметри клієнта:\n${prefsBlock}` +
    freeTextBlock +
    inventoryBlock +
    (popularBlock ? `\n\n${popularBlock}` : "") +
    `\n\nВАЖЛИВО ПРО ЦІНИ:
• Бюджет клієнта — у TURNKEY (фінал в Україні).
• Формула: turnkey = EU × 1.38 + 4500 (мито+акциз+ПДВ+комісія+доставка+реєстрація).
• Орієнтуйся на свої знання про ринок Німеччини/Швеції 2015-2026: типові EU-ціни моделі/року + вищенаведена формула = твій priceRange.
${hasBudget
  ? `• Бюджет клієнта вказаний (див. вище). Порівнюй свій priceRange з ним і виставляй budgetFit чесно. Якщо модель реально дорожча — використовуй "over" + feasibilityWarning з рекомендацією альтернатив у бюджеті.`
  : `• Бюджет НЕ вказаний клієнтом. Пиши РЕАЛЬНІ ринкові ціни моделей. budgetFit:"fits" для всіх, overBy:0, feasibilityWarning:null — не пиши "над бюджетом" коли бюджету немає.`}

ФОРМАТ ВІДПОВІДІ: ТІЛЬКИ JSON-масив, що починається з [ і закінчується ]. Без тексту до/після, без markdown ${"```"}, без уточнюючих питань. Якщо параметрів недостатньо — здогадайся розумно і поверни 3 пропозиції. Перший символ відповіді МУСИТЬ бути [.`

  // ── Start streaming response ───────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const abort = new AbortController()
      const timeout = setTimeout(() => abort.abort(), 35_000)

      try {
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            // Temperature 1.0 + the variability rule in the prompt pushes the
            // model off canonical "Golf GTI / Civic Type R" combos. Default
            // (~1.0) was already this — making it explicit so any future
            // tuning is intentional, not accidental.
            temperature: 1.0,
            stream: true,
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userMessage }],
          }),
          signal: abort.signal,
        })

        if (!claudeRes.ok) {
          const errBody = await claudeRes.text().catch(() => "")
          const { logError } = await import("@/lib/logger")
          await logError({
            source: "ai", level: "error",
            msg: `Claude suggest HTTP ${claudeRes.status}`,
            details: { body: errBody.slice(0, 400), endpoint: "ai-picker/suggest" },
          })
          controller.enqueue(sseEvent(encoder, {
            type: "fallback",
            fallback: "ai_unavailable",
            message: "AI зараз недоступний — шукаємо за вашими параметрами.",
          }))
          controller.close()
          return
        }

        // ── Stream Claude SSE → parse suggestions → re-emit ─────────────────
        const reader = claudeRes.body!.getReader()
        const dec = new TextDecoder()
        let lineBuf = ""
        let textAccum = ""
        let sentCount = 0
        let overCount = 0 // picks the AI itself flagged as over the client's budget
        // `grounded` is now a SOFT LABEL, not a gate. Our parse-history is an
        // incomplete sample of the EU market, so "not in our pool" does NOT mean
        // "not on the market" — gating on it produced false "thin" banners and
        // single-suggestion results for common segments (e.g. sporty €60k). We
        // show all 3 picks and only flag genuine infeasibility (all over budget).
        const hasMenu = inventoryKeys.size > 0
        const isGroundedSugg = (rawSugg: any): boolean =>
          hasMenu && inventoryKeys.has(groundingKey(rawSugg.make, rawSugg.model_display ?? rawSugg.model_search ?? rawSugg.model ?? ""))

        // ── Global feasibility backstop ──────────────────────────────────────
        // An OFF-MENU pick the client never named, priced below its real market
        // floor, is a GENERATION ERROR — the Škoda Superb Combi case: AI invents
        // it at "21-26k" turnkey for a 25k budget when the Estate floor is ~33k,
        // the user approves, the parser (correctly) returns 0 → confusing banner.
        // The over-budget CARD is legitimate ONLY when the client explicitly
        // named the model (honest +€X badge). Otherwise drop it — but only with a
        // sufficient real sample + tolerance, so we never false-drop a feasible
        // model on a thin / expensive-skewed pool sample (the pool is incomplete;
        // PRICE evidence we HAVE is a positive signal, unlike mere absence).
        const namedKeys = new Set(
          (prefs.pairs ?? []).filter(p => p?.make && p?.model)
            .map(p => groundingKey(p!.make as string, p!.model as string)),
        )
        const FLOOR_MIN_SAMPLE = 6
        const FLOOR_TOLERANCE = 1.15
        const isOverBudgetGenError = (rawSugg: any): boolean => {
          if (!prefs.budget_max) return false // no budget → nothing to exceed
          const key = groundingKey(rawSugg.make, rawSugg.model_display ?? rawSugg.model_search ?? rawSugg.model ?? "")
          if (namedKeys.has(key)) return false // client named it → honest over-budget card is OK
          const f = inventoryFloors.get(key)
          if (!f || f.n < FLOOR_MIN_SAMPLE) return false // too little real data to judge → let it through
          return f.floorTk > prefs.budget_max * FLOOR_TOLERANCE
        }
        // Over-budget un-named picks are buffered (not hard-dropped): we prefer
        // in-budget picks, but if EVERY pick is over budget we release these so
        // the user never gets a blank screen — flagged honestly via the banner.
        const heldOver: any[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          lineBuf += dec.decode(value, { stream: true })
          const lines = lineBuf.split("\n")
          lineBuf = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (raw === "[DONE]") continue

            try {
              const event = JSON.parse(raw)

              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                textAccum += event.delta.text
                const { complete, remaining } = extractCompleteSuggestions(textAccum)
                textAccum = remaining
                // `complete` contains ONLY newly-parsed objects on this call
                // (textAccum was just stripped of their bytes). Iterate the
                // whole array — do NOT .slice(sentCount), because sentCount
                // counts globally across calls and would always skip the
                // 2nd+ suggestion. Cap at 3 to match the system-prompt count.
                for (const rawSugg of complete) {
                  if (sentCount >= 3) break
                  if (rawSugg && typeof rawSugg === "object" && rawSugg.make) {
                    const mapped: any = mapRawSuggestion(rawSugg, prefs)
                    if (!isUsableSuggestion(mapped)) continue // skip un-parseable (bad years / not-in-EU brand)
                    const grounded = isGroundedSugg(rawSugg)
                    if (isOverBudgetGenError(rawSugg)) { // un-named, real floor over budget → hold, release only if nothing else survives
                      heldOver.push({ ...mapped, grounded: hasMenu ? grounded : undefined })
                      continue
                    }
                    controller.enqueue(sseEvent(encoder, { type: "suggestion", suggestion: { ...mapped, grounded: hasMenu ? grounded : undefined } }))
                    sentCount++
                    if (mapped.budgetFit === "over") overCount++
                  }
                }
              }

              if (event.type === "message_stop") {
                // Flush any remaining partial content
                if (textAccum.trim()) {
                  try {
                    const cleaned = textAccum.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
                    const match = cleaned.match(/\{[\s\S]*\}/)
                    if (match) {
                      const rawSugg = JSON.parse(match[0])
                      const mapped2: any = rawSugg?.make ? mapRawSuggestion(rawSugg, prefs) : null
                      if (mapped2 && sentCount < 3 && isUsableSuggestion(mapped2)) {
                        const grounded = isGroundedSugg(rawSugg)
                        const payload2 = { ...mapped2, grounded: hasMenu ? grounded : undefined }
                        if (isOverBudgetGenError(rawSugg)) {
                          heldOver.push(payload2)
                        } else {
                          controller.enqueue(sseEvent(encoder, { type: "suggestion", suggestion: payload2 }))
                          sentCount++
                          if (mapped2.budgetFit === "over") overCount++
                        }
                      }
                    }
                  } catch { /* incomplete JSON, ignore */ }
                }
                // NEVER blank: if every pick was held as over-budget, release
                // them so the user still sees options (honestly flagged below).
                // Prefer in-budget picks; these surface only when nothing fit.
                let releasedOver = false
                if (sentCount === 0 && heldOver.length > 0) {
                  for (const h of heldOver) {
                    if (sentCount >= 3) break
                    controller.enqueue(sseEvent(encoder, { type: "suggestion", suggestion: h }))
                    sentCount++
                  }
                  releasedOver = true
                }
                // Honest scarcity banner — client gave a budget and either EVERY
                // shown pick is over it (e.g. "Urus за €50k") or we had to release
                // over-budget picks because nothing fit. NOT for a merely-thin pool.
                if (hasBudget && sentCount > 0 && (overCount === sentCount || releasedOver)) {
                  controller.enqueue(sseEvent(encoder, { type: "thin", reason: "over_budget", shown: sentCount }))
                }
                controller.enqueue(sseEvent(encoder, { type: "done" }))
              }

              if (event.type === "error") {
                const { logError } = await import("@/lib/logger")
                await logError({
                  source: "ai", level: "error",
                  msg: `Claude stream error: ${event.error?.type}`,
                  details: { message: event.error?.message, endpoint: "ai-picker/suggest" },
                })
                controller.enqueue(sseEvent(encoder, {
                  type: "fallback",
                  fallback: "ai_unavailable",
                  message: "AI зараз недоступний.",
                }))
              }
            } catch { /* malformed SSE event, skip */ }
          }
        }
      } catch (e: any) {
        const isAbort = e?.name === "AbortError"
        const { logError } = await import("@/lib/logger")
        await logError({
          source: "ai", level: "error",
          msg: isAbort ? "Claude suggest stream timeout (35s)" : `Claude suggest stream error: ${e?.message}`,
          stack: e?.stack,
          details: { endpoint: "ai-picker/suggest" },
        })
        controller.enqueue(sseEvent(encoder, {
          type: "fallback",
          fallback: "ai_unavailable",
          message: "AI зараз недоступний — шукаємо за вашими параметрами.",
        }))
      } finally {
        clearTimeout(timeout)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
