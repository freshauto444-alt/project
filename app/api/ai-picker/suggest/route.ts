import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { lookupPriceGuide } from "@/lib/constants"

// ═══════════════════════════════════════════════════════════════════════════════
//  AI Car Suggestion Endpoint — v2
//  Strategy: DB-first (real inventory matching user filters exactly).
//  Claude only fills gaps when DB has < 5 models that match strict constraints.
//  Price bounds are intersected with user budget so suggestions never exceed it.
// ═══════════════════════════════════════════════════════════════════════════════

interface CarSuggestion {
  make: string
  model: string
  yearRange: string
  priceRange: string
  whyRecommended: string
  concerns: string
  searchParams: {
    make: string
    model: string
    // Variant hint: for BMW "540d" when model is "5er", for Mercedes "C220d" when model is "c-klasse".
    // Used for client-side filtering since AS24 only supports series-level model slugs.
    model_variant?: string
    year_from: number
    year_to?: number
    budget_min?: number
    budget_max?: number
    fuel?: string
    transmission?: string
    body_type?: string
    drive?: string
  }
}

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
    purpose_body_types?: string[]
  }
  answers?: { questionId: string; selected: string[]; custom: string }[]
  freeText?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("[suggest:claude] ANTHROPIC_API_KEY not found")
    return ""
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  })
  const data = await res.json()
  if (data.error) {
    console.error("[suggest:claude] API error:", JSON.stringify(data.error))
    return ""
  }
  return data.content?.[0]?.text?.trim() ?? ""
}

interface DbModelStats {
  make: string
  model: string
  count: number
  minPrice: number
  maxPrice: number
  medianPrice: number
  minYear: number
  maxYear: number
  bodyTypes: Set<string>
  sampleFuel: string | null
}

// Strip trim/variant suffixes so the parser can find the base model.
// AS24/Bytbil expect slugs like "passat", not "passat alltrack".
// Display name keeps the full variant; only the SEARCH model is normalized.
const TRIM_SUFFIXES = [
  "alltrack", "combi", "kombi", "estate", "touring", "variant", "avant",
  "country tourer", "tourer", "sportback", "shooting brake", "cross country",
  "crosstourer", "allroad", "scout", "wagon", "sw", "break",
  "xdrive", "4motion", "4matic", "quattro", "sedan", "saloon",
  "gran coupe", "gran turismo", "coupe", "cabrio", "cabriolet", "convertible",
  "hatchback", "limousine", "li", "active tourer", "gran tourer",
]

// Brand-specific: engine variant → base model series slug used on AS24.
// BMW: 320d/330i/318i/M340i → 3er, 418d/420i → 4er, 520d/540d/M550i → 5er, etc.
// Mercedes: C200/C220d/C43 → c-klasse, E220d → e-klasse, etc.
function normalizeBmwModel(m: string): string | null {
  // Match "320d", "m340i", "540 d", "m5 cs" etc. Extract leading digit of the series.
  const match = m.match(/^(?:m\s*)?(\d)(\d{0,2})\s*[a-z]?/i)
  if (match) {
    const series = match[1]
    // BMW M-series keep as is: m2, m3, m4, m5, m8
    if (/^m\s*\d$/i.test(m) || /^m(2|3|4|5|8)\b/i.test(m)) {
      const mMatch = m.match(/^m\s*(\d)/i)
      return mMatch ? `m${mMatch[1]}` : null
    }
    return `${series}er`
  }
  // X1/X3/X5/X6/X7, Z4, iX, i4, i7, i8 — keep first token
  const xMatch = m.match(/^(x\d|z\d|i\d|ix)/i)
  if (xMatch) return xMatch[1].toLowerCase()
  return null
}

function normalizeMercedesModel(m: string): string | null {
  // "C200", "C220d", "C43 amg", "E220d" → "c-klasse" / "e-klasse"
  const cls = m.match(/^([a-z])\s*\d/i)
  if (cls) {
    const letter = cls[1].toLowerCase()
    if ("acegs".includes(letter)) return `${letter}-klasse`
  }
  // CLA, CLS, CLK
  const cl = m.match(/^(cla|cls|clk|glc|gle|gls|gla|glb|glk|amg gt|amg)/i)
  if (cl) return cl[1].toLowerCase().replace(" ", "-")
  return null
}

function normalizeAudiModel(m: string): string | null {
  // "A4 Avant", "A6 45 TFSI", "Q5 Sportback" → a4, a6, q5
  const match = m.match(/^(a\d|q\d|rs\d|s\d|e-tron|tt|r8)/i)
  return match ? match[1].toLowerCase() : null
}

// Extract an engine-variant hint from a model display name.
// BMW "540d xDrive" → "540"; "M340i" → "m340"; "320d Sedan" → "320"
// Mercedes "C220d" → "c220"; "E350" → "e350"
// Audi "A6 45 TFSI" → "a6 45" (keeps the power number)
// Returns lowercase string, or empty if no variant detected.
function extractVariant(model: string, make?: string): string {
  const m = (model || "").toLowerCase().trim()
  if (!m) return ""
  const brand = (make || "").toLowerCase()

  if (brand.includes("bmw")) {
    // 320d, 330i, 540d, M340i, M5 Competition
    const mMatch = m.match(/^m\s*(\d{1,3})/i)
    if (mMatch) return `m${mMatch[1]}`
    const numMatch = m.match(/^(\d{3})\s*[a-z]?/)
    if (numMatch) return numMatch[1]
    return ""
  }

  if (brand.includes("mercedes") || brand.includes("benz")) {
    // C220d, E350, GLC 300, CLA 200
    const letterNum = m.match(/^([a-z]{1,3})\s*(\d{2,3})/i)
    if (letterNum) return `${letterNum[1]}${letterNum[2]}`
    return ""
  }

  // No specific variant extraction for other brands (Audi A4, VW Passat etc. already slug-level)
  return ""
}

function normalizeModelForSearch(model: string, make?: string): string {
  let m = (model || "").toLowerCase().trim()
  if (!m) return m

  // Brand-specific shortcuts — try these first
  const brand = (make || "").toLowerCase()
  if (brand.includes("bmw")) {
    const bmw = normalizeBmwModel(m)
    if (bmw) return bmw
  } else if (brand.includes("mercedes") || brand.includes("benz")) {
    const mb = normalizeMercedesModel(m)
    if (mb) return mb
  } else if (brand.includes("audi")) {
    const au = normalizeAudiModel(m)
    if (au) return au
  }

  // Generic suffix stripping
  const sorted = [...TRIM_SUFFIXES].sort((a, b) => b.length - a.length)
  for (const s of sorted) {
    const re = new RegExp(`\\b${s}\\b`, "gi")
    m = m.replace(re, "").trim()
  }
  // Drop trailing engine tags like "45 tfsi", "220 d", "2.0 tdi", "e-hybrid"
  m = m.replace(/\b\d+(\.\d)?\s*(tfsi|tdi|tsi|fsi|cdi|bluetec|hdi|dci|hybrid|e-hybrid|phev|mhev|d|i|t)\b/gi, "")
  m = m.replace(/\s+/g, " ").trim()
  if (!m) m = (model || "").toLowerCase().split(/\s+/)[0] ?? ""
  return m
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// ── Body type compatibility: does this model exist in the requested body? ──
// Key = make:model_slug, value = set of supported body types.
// Used to reject AI suggestions where Claude hallucinates Estate/SUV variants
// that don't actually exist (e.g. "Seat Tarraco Estate" — Tarraco is SUV-only).
//
// For models NOT in this list, we trust the AI (no filter).
// Normalized keys use the same slug as normalizeModelForSearch.
const MODEL_BODY_TYPES: Record<string, Set<string>> = {
  // SUV-only — no Estate version exists
  "seat:tarraco": new Set(["SUV"]),
  "seat:ateca": new Set(["SUV"]),
  "seat:arona": new Set(["SUV"]),
  "volkswagen:tiguan": new Set(["SUV"]),
  "volkswagen:touareg": new Set(["SUV"]),
  "volkswagen:t-roc": new Set(["SUV"]),
  "volkswagen:t-cross": new Set(["SUV"]),
  "volkswagen:id.4": new Set(["SUV"]),
  "skoda:kodiaq": new Set(["SUV"]),
  "skoda:karoq": new Set(["SUV"]),
  "skoda:kamiq": new Set(["SUV"]),
  "toyota:rav4": new Set(["SUV"]),
  "toyota:c-hr": new Set(["SUV"]),
  "toyota:land cruiser": new Set(["SUV"]),
  "hyundai:tucson": new Set(["SUV"]),
  "hyundai:santa fe": new Set(["SUV"]),
  "hyundai:kona": new Set(["SUV"]),
  "kia:sportage": new Set(["SUV"]),
  "kia:sorento": new Set(["SUV"]),
  "mazda:cx-5": new Set(["SUV"]),
  "mazda:cx-30": new Set(["SUV"]),
  "nissan:qashqai": new Set(["SUV"]),
  "nissan:x-trail": new Set(["SUV"]),
  "peugeot:3008": new Set(["SUV"]),
  "peugeot:5008": new Set(["SUV"]),
  "peugeot:2008": new Set(["SUV"]),
  "ford:kuga": new Set(["SUV"]),
  "ford:puma": new Set(["SUV"]),
  "ford:explorer": new Set(["SUV"]),
  "bmw:x1": new Set(["SUV"]),
  "bmw:x2": new Set(["SUV"]),
  "bmw:x3": new Set(["SUV"]),
  "bmw:x4": new Set(["SUV"]),
  "bmw:x5": new Set(["SUV"]),
  "bmw:x6": new Set(["SUV"]),
  "bmw:x7": new Set(["SUV"]),
  "bmw:ix": new Set(["SUV"]),
  "audi:q2": new Set(["SUV"]),
  "audi:q3": new Set(["SUV"]),
  "audi:q4": new Set(["SUV"]),
  "audi:q5": new Set(["SUV"]),
  "audi:q7": new Set(["SUV"]),
  "audi:q8": new Set(["SUV"]),
  "mercedes-benz:glc": new Set(["SUV"]),
  "mercedes-benz:gle": new Set(["SUV"]),
  "mercedes-benz:gls": new Set(["SUV"]),
  "mercedes-benz:gla": new Set(["SUV"]),
  "mercedes-benz:glb": new Set(["SUV"]),
  "volvo:xc40": new Set(["SUV"]),
  "volvo:xc60": new Set(["SUV"]),
  "volvo:xc90": new Set(["SUV"]),
  "porsche:cayenne": new Set(["SUV"]),
  "porsche:macan": new Set(["SUV"]),
  "land rover:discovery": new Set(["SUV"]),
  "land rover:defender": new Set(["SUV"]),
  "land rover:range rover": new Set(["SUV"]),
  "jaguar:f-pace": new Set(["SUV"]),
  "jaguar:e-pace": new Set(["SUV"]),
  "lexus:nx": new Set(["SUV"]),
  "lexus:rx": new Set(["SUV"]),
  "tesla:model y": new Set(["SUV"]),
  "tesla:model x": new Set(["SUV"]),
  "dacia:duster": new Set(["SUV"]),
  "mini:countryman": new Set(["SUV"]),
  // Estate/Sedan capable (no SUV)
  "bmw:3er": new Set(["Sedan", "Estate"]),
  "bmw:5er": new Set(["Sedan", "Estate"]),
  "audi:a4": new Set(["Sedan", "Estate"]),
  "audi:a6": new Set(["Sedan", "Estate"]),
  "mercedes-benz:c-klasse": new Set(["Sedan", "Estate"]),
  "mercedes-benz:e-klasse": new Set(["Sedan", "Estate"]),
  "volkswagen:passat": new Set(["Sedan", "Estate"]),
  "volkswagen:arteon": new Set(["Sedan", "Estate"]),
  "skoda:octavia": new Set(["Sedan", "Estate"]),
  "skoda:superb": new Set(["Sedan", "Estate"]),
  "skoda:fabia": new Set(["Hatchback", "Estate"]),
  "volvo:v60": new Set(["Estate"]),
  "volvo:v90": new Set(["Estate"]),
  "volvo:s60": new Set(["Sedan"]),
  "volvo:s90": new Set(["Sedan"]),
  "opel:insignia": new Set(["Sedan", "Estate"]),
  "opel:astra": new Set(["Hatchback", "Estate"]),
  "peugeot:508": new Set(["Sedan", "Estate"]),
  "ford:focus": new Set(["Hatchback", "Estate"]),
  "ford:mondeo": new Set(["Sedan", "Estate"]),
}

function bodyTypeMatches(make: string, modelSlug: string, requestedBody: string): boolean {
  const key = `${make.toLowerCase()}:${modelSlug.toLowerCase()}`
  const known = MODEL_BODY_TYPES[key]
  if (!known) return true // unknown model — trust AI
  return known.has(requestedBody)
}

// Extract brand hints from user's freeText (both UA and EN variants).
// Returns canonical brand names as stored in `cars.make` column.
const BRAND_ALIASES: Record<string, string[]> = {
  "BMW": ["bmw", "бмв", "беха"],
  "Audi": ["audi", "ауді", "ауди"],
  "Mercedes-Benz": ["mercedes", "мерседес", "мерс", "benz", "бенц"],
  "Volkswagen": ["volkswagen", "vw", "фольксваген", "фольц", "фольк", "пасат", "passat"],
  "Volvo": ["volvo", "вольво"],
  "Skoda": ["skoda", "škoda", "шкода"],
  "Toyota": ["toyota", "тойота"],
  "Porsche": ["porsche", "порше"],
  "Seat": ["seat", "сеат"],
  "Opel": ["opel", "опель"],
  "Peugeot": ["peugeot", "пежо"],
  "Renault": ["renault", "рено"],
  "Ford": ["ford", "форд"],
  "Mazda": ["mazda", "мазда"],
  "Hyundai": ["hyundai", "хундай", "хюндай"],
  "Kia": ["kia", "кіа", "киа"],
  "Nissan": ["nissan", "ніссан", "нисан"],
  "Lexus": ["lexus", "лексус"],
  "Land Rover": ["land rover", "range rover", "ленд ровер", "ренж ровер"],
  "Jaguar": ["jaguar", "ягуар"],
  "Mini": ["mini cooper", "міні"],
  "Tesla": ["tesla", "тесла"],
  "Alfa Romeo": ["alfa", "альфа"],
  "Dacia": ["dacia", "дачія"],
  "Subaru": ["subaru", "субару"],
}

function extractBrandHints(freeText?: string): string[] {
  if (!freeText) return []
  const text = freeText.toLowerCase()
  const hits = new Set<string>()
  for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
    for (const alias of aliases) {
      if (text.includes(alias)) {
        hits.add(brand)
        break
      }
    }
  }
  return [...hits]
}

export async function POST(req: Request) {
  try {
    const body: SuggestRequest = await req.json()
    const prefs = body.preferences ?? {}

    const userMin = prefs.budget_min ?? 0
    const userMax = prefs.budget_max ?? 999999
    const bodyTypeFilter = prefs.body_type?.toLowerCase().trim() || null

    // Extract brand hints from freeText (e.g. "щось із ауді або бмв" → ["Audi", "BMW"])
    const brandHints = extractBrandHints(body.freeText)
    console.log("[suggest] brand hints from freeText:", brandHints)

    // ── Step 1: Query DB with STRICT filters matching user's criteria ────
    const dbStats = new Map<string, DbModelStats>()
    let strictMatchCount = 0

    try {
      const supabase = createClient(supabaseUrl, supabaseKey)

      let q = supabase
        .from("cars")
        .select("make, model, year, price, fuel, body_type")
        .not("price", "is", null)
        .not("make", "is", null)
        .not("model", "is", null)

      if (userMin > 0) q = q.gte("price", userMin)
      if (prefs.budget_max) q = q.lte("price", userMax)
      if (prefs.year_from) q = q.gte("year", prefs.year_from)
      if (prefs.year_to) q = q.lte("year", prefs.year_to)
      if (prefs.fuel) q = q.eq("fuel", prefs.fuel)
      if (prefs.body_type) q = q.eq("body_type", prefs.body_type)
      if (brandHints.length > 0) q = q.in("make", brandHints)

      const { data: strictData, error: strictErr } = await q.limit(1500)
      if (strictErr) console.error("[suggest] strict query error:", strictErr)

      const rows = strictData ?? []
      strictMatchCount = rows.length

      // Group by make+model
      const grouped = new Map<string, { make: string; model: string; prices: number[]; years: number[]; bodyTypes: Set<string>; fuel: string | null }>()
      for (const r of rows) {
        if (!r.make || !r.model || r.price == null) continue
        const key = `${r.make.toLowerCase()}|${r.model.toLowerCase()}`
        let g = grouped.get(key)
        if (!g) {
          g = { make: r.make, model: r.model, prices: [], years: [], bodyTypes: new Set(), fuel: r.fuel ?? null }
          grouped.set(key, g)
        }
        g.prices.push(r.price)
        if (r.year) g.years.push(r.year)
        if (r.body_type) g.bodyTypes.add(r.body_type)
      }

      for (const [key, g] of grouped) {
        if (g.prices.length < 1) continue
        g.prices.sort((a, b) => a - b)
        // Trim outliers 10%-90% when we have enough samples
        let trimmed = g.prices
        if (g.prices.length >= 5) {
          const a = Math.floor(g.prices.length * 0.1)
          const b = Math.max(a + 1, Math.ceil(g.prices.length * 0.9))
          trimmed = g.prices.slice(a, b)
        }
        dbStats.set(key, {
          make: g.make,
          model: g.model,
          count: g.prices.length,
          minPrice: trimmed[0],
          maxPrice: trimmed[trimmed.length - 1],
          medianPrice: median(trimmed),
          minYear: g.years.length ? Math.min(...g.years) : 0,
          maxYear: g.years.length ? Math.max(...g.years) : 0,
          bodyTypes: g.bodyTypes,
          sampleFuel: g.fuel,
        })
      }
    } catch (e) {
      console.error("[suggest] Supabase error:", e)
    }

    // ── Step 2: Build preferences description ───────────────────────────
    const prefsDesc: string[] = []
    if (prefs.budget_min || prefs.budget_max) {
      prefsDesc.push(`Бюджет: ${prefs.budget_min ?? "?"} - ${prefs.budget_max ?? "?"} EUR`)
    }
    if (prefs.fuel) prefsDesc.push(`Паливо: ${prefs.fuel}`)
    if (prefs.body_type) prefsDesc.push(`Кузов: ${prefs.body_type}`)
    if (prefs.year_from) prefsDesc.push(`Рік від: ${prefs.year_from}`)
    if (prefs.year_to) prefsDesc.push(`Рік до: ${prefs.year_to}`)
    if (prefs.transmission) prefsDesc.push(`КПП: ${prefs.transmission}`)
    if (prefs.drive) prefsDesc.push(`Привід: ${prefs.drive}`)
    const purposes = body.answers?.find(a => a.questionId === "purpose")?.selected ?? []
    if (purposes.length) prefsDesc.push(`Ціль: ${purposes.join(", ")}`)

    console.log("[suggest] prefs:", JSON.stringify(prefs))
    console.log("[suggest] DB strict match count:", strictMatchCount, "unique models:", dbStats.size)

    // ── Step 3: Select top DB-backed suggestions ────────────────────────
    // Rank by: count (popularity) * year recency bonus, and require price fits user window
    const dbCandidates = [...dbStats.values()]
      .filter(s => {
        // Already filtered by query, but re-check intersection
        return s.minPrice <= userMax && s.maxPrice >= userMin
      })
      .sort((a, b) => {
        // Prefer models with more samples (more inventory = more confidence)
        if (b.count !== a.count) return b.count - a.count
        return b.maxYear - a.maxYear
      })

    // Helper to build a suggestion from DB stats
    const buildFromDb = (s: DbModelStats): CarSuggestion => {
      // Intersect with user budget for precise bounds
      const pmin = Math.max(s.minPrice, userMin)
      const pmax = Math.min(s.maxPrice, userMax)
      const yFrom = s.minYear || prefs.year_from || 2018
      const yTo = s.maxYear || prefs.year_to || undefined
      const bodyStr = s.bodyTypes.size ? [...s.bodyTypes].join("/") : ""
      return {
        make: s.make,
        model: s.model,
        yearRange: yTo ? `${yFrom}-${yTo}` : `${yFrom}`,
        priceRange: `${Math.round(pmin)}-${Math.round(pmax)}`,
        whyRecommended: `В нашій базі ${s.count} ${s.count === 1 ? "авто" : "авто"} ${s.make} ${s.model} під ваші критерії${bodyStr ? ` (${bodyStr})` : ""}. Медіанна ціна ~${Math.round(s.medianPrice)} EUR.`,
        concerns: "Перевірте історію сервісу та комплектацію перед купівлею.",
        searchParams: {
          make: s.make,
          model: normalizeModelForSearch(s.model, s.make),
          model_variant: extractVariant(s.model, s.make) || undefined,
          year_from: yFrom,
          year_to: yTo,
          budget_min: Math.round(pmin),
          budget_max: Math.round(pmax),
          fuel: prefs.fuel || undefined,
          transmission: prefs.transmission || undefined,
          body_type: prefs.body_type || undefined,
          drive: prefs.drive || undefined,
        },
      }
    }

    // ── Hybrid mix: take max 2 from DB, let Claude freely propose the rest ──
    // Shuffle top-N DB candidates so repeated calls don't return identical list.
    const topN = Math.min(8, dbCandidates.length)
    const topPool = dbCandidates.slice(0, topN)
    // Fisher-Yates shuffle
    for (let i = topPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[topPool[i], topPool[j]] = [topPool[j], topPool[i]]
    }
    const DB_SLOTS = Math.min(2, topPool.length)
    const suggestions: CarSuggestion[] = topPool.slice(0, DB_SLOTS).map(buildFromDb)

    // ── Step 4: Always ask Claude for fresh suggestions (fills 3-5 slots) ──
    const needed = 5 - suggestions.length
    if (needed > 0) {
      const existingKeys = new Set(suggestions.map(s => `${s.make.toLowerCase()}|${s.model.toLowerCase()}`))

      // Tell Claude what we already have & strict constraints
      const existingText = suggestions.length
        ? `Вже вибрані з бази (НЕ повторюй):\n${suggestions.map(s => `- ${s.make} ${s.model} (${s.priceRange} EUR)`).join("\n")}`
        : "Наша база не має жодних авто під ці критерії — запропонуй РЕАЛЬНІ моделі які точно продаються в цьому бюджеті."

      const strictConstraints = [
        userMin > 0 && `Ціна ВІД ${userMin} EUR`,
        prefs.budget_max && `Ціна ДО ${userMax} EUR`,
        prefs.body_type && `Тип кузова: ТІЛЬКИ ${prefs.body_type} (SUV/Estate/Sedan/etc — строго)`,
        prefs.fuel && `Паливо: ТІЛЬКИ ${prefs.fuel}`,
        prefs.year_from && `Рік ВІД ${prefs.year_from}`,
        prefs.year_to && `Рік ДО ${prefs.year_to}`,
        brandHints.length > 0 && `МАРКИ: ТІЛЬКИ ${brandHints.join(" АБО ")} — клієнт прямо просив саме ці бренди, НЕ пропонуй інші!`,
      ].filter(Boolean).join("\n")

      // Nonce for variety: same params + different nonce should give different models
      const nonce = Math.random().toString(36).slice(2, 8)
      const varietyHint = `\n\nВАРІАНТ #${nonce} — запропонуй нові моделі які ще НЕ згадувалися, будь креативним, пропонуй менш очевидні варіанти.`

      const systemPrompt = `Ти — автоексперт з 15+ років підбору авто з Європи (Німеччина, Швеція). Клієнт Fresh Auto.

КРИТИЧНІ ПРАВИЛА:
1. Запропонуй РІВНО ${needed} ${needed === 1 ? "модель" : "моделі"} які ТОЧНО продаються в бюджеті клієнта.
2. ВСІ запропоновані моделі ПОВИННІ мати ціновий діапазон ПОВНІСТЮ всередині бюджету клієнта. НЕ виходь за межі.
3. Для кожної моделі вкажи ВУЗЬКИЙ реалістичний ціновий діапазон (різниця min-max не більше 35% від min). Не "22000-90000" — а "38000-46000".
4. Тип кузова МУСИТЬ точно відповідати:
   - SUV/позашляховик: ТІЛЬКИ X1/X3/X5, Q3/Q5/Q7, GLC/GLE, XC40/XC60/XC90, Tiguan/Touareg, RAV4, Tucson/Santa Fe, Tarraco/Ateca, Kodiaq, CX-5, 3008/5008
   - Estate/універсал: ТІЛЬКИ Passat Variant, Octavia Combi, A4/A6 Avant, 3er/5er Touring, E-Class Estate, V60/V90, Golf Variant, Superb Combi, Insignia Sports Tourer (НЕ Alltrack, НЕ Cross Country — це кросовер-універсали)
   - Sedan: седани
   НЕ плутай! Якщо сумніваєшся чи модель універсал чи SUV — НЕ пропонуй її.
5. В model_display НЕ повторюй марку. Правильно: "Passat Alltrack". Неправильно: "VW Passat Alltrack".
6. КРИТИЧНО — model_search має бути БАЗОВОЮ назвою моделі БЕЗ суфіксів комплектацій/кузова. Приклади:
   - "Passat Alltrack" → model_search: "passat"
   - "Superb Combi" → model_search: "superb"
   - "Insignia Country Tourer" → model_search: "insignia"
   - "A6 Avant" → model_search: "a6"
   - "3 Series Touring" → model_search: "3er"
   - "E-Class Estate" → model_search: "e-klasse"
   - "XC60 Cross Country" → model_search: "xc60"
   - "Octavia Combi" → model_search: "octavia"
   Універсальне правило: для пошуку використовуй slug як на AS24/Mobile.de (всі букви малі, без пробілів, без варіантів).
7. Достатньо вказати марку + модель + діапазон років + діапазон цін. НЕ обов'язково вказувати точну модифікацію двигуна.
8. Різноманітність: пропонуй моделі РІЗНИХ брендів, не 5 BMW поспіль.

СТРОГІ КРИТЕРІЇ КЛІЄНТА:
${strictConstraints}

${existingText}

Поверни ТІЛЬКИ JSON масив:
[
  {
    "make": "BMW",
    "model_display": "X3 xDrive20d",
    "model_search": "x3",
    "yearRange": "2020-2022",
    "priceRange": "42000-48000",
    "whyRecommended": "2-3 речення українською чому ця модель підходить клієнту.",
    "concerns": "1 речення про нюанси.",
    "body_type_match": "SUV"
  }
]`

      const freeTextNote = body.freeText?.trim()
        ? `\n\nДОДАТКОВО КЛІЄНТ НАПИСАВ: "${body.freeText.trim()}" — врахуй обов'язково!`
        : ""

      const userMessage = `Параметри клієнта:\n${prefsDesc.join("\n") || "Не вказані конкретні параметри"}${freeTextNote}${varietyHint}\n\nЗапропонуй ${needed} ${needed === 1 ? "модель" : "моделі"}.`

      const raw = await callClaude(systemPrompt, userMessage, 2000)
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              let modelDisplay = s.model_display ?? s.model ?? ""
              const make = s.make ?? ""
              if (modelDisplay.toLowerCase().startsWith(make.toLowerCase())) {
                modelDisplay = modelDisplay.slice(make.length).trim()
              }
              const key = `${make.toLowerCase()}|${modelDisplay.toLowerCase()}`
              if (existingKeys.has(key)) continue

              const parseRange = (str: string): [number, number] => {
                const parts = String(str ?? "").split("-").map(p => parseInt(p.replace(/\D/g, "")))
                return [parts[0] || 0, parts[1] || 0]
              }
              const [claimMin, claimMax] = parseRange(s.priceRange)
              const [yFrom, yTo] = parseRange(s.yearRange)

              // Intersect with user budget — ignore Claude's range if it exceeds it
              let finalMin = claimMin && claimMin >= userMin ? claimMin : userMin
              let finalMax = claimMax && claimMax <= userMax ? claimMax : userMax

              // If the claimed range doesn't overlap with user budget, check static guide and try to fit
              if (claimMax && claimMax < userMin) {
                // Claude suggested something below budget — skip
                continue
              }
              if (claimMin && claimMin > userMax) {
                // Claude suggested something above budget — skip
                continue
              }

              // Cross-check with static price guide
              const staticGuide = lookupPriceGuide(make, s.model_search ?? modelDisplay)
              if (staticGuide) {
                // If the entire static range is outside user budget — skip this model
                if (staticGuide.min > userMax || staticGuide.max < userMin) {
                  continue
                }
                // Tighten bounds to the intersection of static guide and user budget
                finalMin = Math.max(staticGuide.min, userMin, finalMin)
                finalMax = Math.min(staticGuide.max, userMax, finalMax || userMax)
              }

              if (finalMin > finalMax) continue

              suggestions.push({
                make,
                model: modelDisplay,
                yearRange: yTo ? `${yFrom}-${yTo}` : `${yFrom || prefs.year_from || 2018}`,
                priceRange: `${finalMin}-${finalMax}`,
                whyRecommended: s.whyRecommended ?? "",
                concerns: s.concerns ?? "",
                searchParams: {
                  make,
                  model: normalizeModelForSearch(s.model_search ?? modelDisplay, make),
                  model_variant: extractVariant(modelDisplay, make) || undefined,
                  year_from: yFrom > 1990 ? yFrom : prefs.year_from ?? 2018,
                  year_to: yTo > 1990 ? yTo : prefs.year_to ?? undefined,
                  budget_min: finalMin,
                  budget_max: finalMax,
                  fuel: prefs.fuel || undefined,
                  transmission: prefs.transmission || undefined,
                  body_type: prefs.body_type || undefined,
                  drive: prefs.drive || undefined,
                },
              })
              existingKeys.add(key)
              if (suggestions.length >= 5) break
            }
          }
        } catch (err) {
          console.error("[suggest] Claude JSON parse error:", err)
        }
      }
    }

    // ── Step 5: Final hard filter — no suggestion can exceed user budget ─
    const final = suggestions
      .filter(s => {
        const min = s.searchParams.budget_min ?? 0
        const max = s.searchParams.budget_max ?? 999999
        if (!(min <= userMax && max >= userMin)) return false

        // Body type sanity check — reject AI hallucinations like "Tarraco Estate"
        if (prefs.body_type) {
          const ok = bodyTypeMatches(s.make, s.searchParams.model, prefs.body_type)
          if (!ok) {
            console.log("[suggest] body_type rejected:", s.make, s.model, "→ needs", prefs.body_type)
            return false
          }
        }
        return true
      })
      .slice(0, 5)

    console.log("[suggest] returning", final.length, "suggestions (DB:", dbCandidates.slice(0, 5).length, ", AI fill:", final.length - Math.min(5, dbCandidates.length), ")")

    return NextResponse.json({
      suggestions: final,
      cachedCount: strictMatchCount,
      message: final.length === 0
        ? "Не знайдено рекомендацій під ці критерії. Спробуйте розширити бюджет або змінити фільтри."
        : undefined,
    })
  } catch (e) {
    console.error("[suggest] Error:", e)
    return NextResponse.json(
      { suggestions: [], message: "Виникла помилка. Спробуйте ще раз." },
      { status: 500 },
    )
  }
}
